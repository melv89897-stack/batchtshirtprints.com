import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, generateTotpSecret, totpQrCodeDataUrl, AuthError } from "@/lib/security/auth";

/** Generates a fresh TOTP secret and QR code. Not yet enabled — /verify flips it on. */
export async function POST() {
  try {
    const user = await requireUser();
    const secret = generateTotpSecret();
    await db.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
    const qrCodeDataUrl = await totpQrCodeDataUrl(user.email, secret);
    return NextResponse.json({ secret, qrCodeDataUrl });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error("[auth/2fa/setup]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
