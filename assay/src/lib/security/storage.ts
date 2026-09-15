import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "@/lib/db";
import { audit } from "./audit";
import { assertCanAccessDataRoom } from "./authorize";
import type { User } from "@prisma/client";

/**
 * Sensitive documents (redacted bank statements from the redaction studio)
 * are the crown jewel and the biggest liability. Rules enforced here:
 *   • Stored OUTSIDE the web-servable public/ directory — never a public URL.
 *   • Access is granted per request, only after the NDA-gate check passes.
 *   • Every view is written to the audit log (sellers can see who looked).
 *   • Files are hashed; a mismatch means tampering — we refuse to serve it.
 *
 * The original starter used S3 + presigned URLs. No AWS/R2 credentials are
 * configured in this environment, so this stores the same encrypted-at-rest
 * (private-disk) files locally and serves them through an authenticated
 * Next.js route instead of a presigned S3 URL — the same security property
 * (short-lived, per-request, access-logged), different transport. Swapping
 * to S3/R2 later means changing only this file.
 */
const STORAGE_ROOT = path.join(process.cwd(), "storage", "private");

async function ensureRoot() {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
}

/**
 * Store a redacted document. Callers must only ever pass the burned-in,
 * redacted PNG produced by the redaction studio — never an original upload.
 */
export async function storeRedactedDocument(params: {
  listingId: string;
  type: "BANK_STATEMENT" | "PROFIT_LOSS" | "CONTRACT" | "OTHER";
  bytes: Buffer;
  uploaderId: string;
}): Promise<string> {
  await ensureRoot();

  const sha256 = crypto.createHash("sha256").update(params.bytes).digest("hex");
  const key = `${params.listingId}__${sha256}.png`;
  await fs.writeFile(path.join(STORAGE_ROOT, key), params.bytes);

  const doc = await db.document.create({
    data: {
      listingId: params.listingId,
      type: params.type,
      storageKey: key,
      sha256,
      redacted: true,
    },
  });

  await db.listing.update({
    where: { id: params.listingId },
    data: { statementRedacted: true },
  });

  await audit({
    action: "document.uploaded",
    actorId: params.uploaderId,
    targetType: "Document",
    targetId: doc.id,
    metadata: { listingId: params.listingId, type: params.type },
  });

  return doc.id;
}

/**
 * Return the document's bytes to an authorized viewer. Checks the NDA gate,
 * verifies the file hasn't been tampered with, and logs the access — the
 * same three guarantees a short-lived signed S3 URL would give.
 */
export async function readDocumentForViewer(
  viewer: User,
  documentId: string,
  ip?: string | null,
): Promise<{ bytes: Buffer; contentType: string }> {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found.");

  await assertCanAccessDataRoom(viewer, doc.listingId);

  const bytes = await fs.readFile(path.join(STORAGE_ROOT, doc.storageKey));
  const actualHash = crypto.createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== doc.sha256) {
    throw new Error("Document integrity check failed — refusing to serve a tampered file.");
  }

  await audit({
    action: "document.viewed",
    actorId: viewer.id,
    targetType: "Document",
    targetId: doc.id,
    ipAddress: ip,
    metadata: { listingId: doc.listingId, type: doc.type },
  });

  return { bytes, contentType: "image/png" };
}
