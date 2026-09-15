import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/security/auth";
import { requestKycVerification } from "@/lib/security/kyc";

export async function POST() {
  try {
    const user = await requireUser();
    const updated = await requestKycVerification(user);
    return NextResponse.json({ ok: true, kycStatus: updated.kycStatus });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
