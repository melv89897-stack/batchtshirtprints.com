import { NextRequest, NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/security/auth";
import { ForbiddenError } from "@/lib/security/authorize";
import { readDocumentForViewer } from "@/lib/security/storage";

/** Streams a redacted document's bytes to an authorized, NDA-gated viewer only. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const { bytes, contentType } = await readDocumentForViewer(user, params.id, ip);

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.reason }, { status: 403 });
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
