import { NextResponse } from "next/server";
import { withGuard } from "@/lib/security/guard";
import { uploadDocumentSchema } from "@/lib/security/validate";
import { assertCanManageListing } from "@/lib/security/authorize";
import { storeRedactedDocument } from "@/lib/security/storage";

/**
 * Upload a REDACTED document from the redaction studio. The client sends the
 * final burned-in PNG as a data URL — nothing enters the server before it's
 * been redacted in the browser (see /redaction-studio). Rate-limited: this
 * is an expensive, sensitive write.
 */
export const POST = withGuard(
  { rateLimit: "upload", requireTwoFactor: true, bodySchema: uploadDocumentSchema },
  async ({ user, body }) => {
    await assertCanManageListing(user, body.listingId);

    const base64 = body.dataUrl.split(",")[1] ?? "";
    const bytes = Buffer.from(base64, "base64");

    const documentId = await storeRedactedDocument({
      listingId: body.listingId,
      type: body.type,
      bytes,
      uploaderId: user.id,
    });

    return NextResponse.json({ ok: true, documentId });
  },
);
