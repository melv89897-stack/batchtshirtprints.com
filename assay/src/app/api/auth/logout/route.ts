import { NextResponse } from "next/server";
import { destroySessionCookie, getCurrentUser } from "@/lib/security/auth";
import { audit } from "@/lib/security/audit";

export async function POST() {
  const user = await getCurrentUser();
  destroySessionCookie();
  if (user) await audit({ action: "auth.logout", actorId: user.id });
  return NextResponse.json({ ok: true });
}
