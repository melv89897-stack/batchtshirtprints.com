import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSessionCookie, verifyTotpCode } from "@/lib/security/auth";
import { parse, ValidationError, loginSchema } from "@/lib/security/validate";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";

// Generic errors throughout on purpose — never reveal whether the email
// exists, whether the password or the 2FA code was the wrong part.
const GENERIC_ERROR = "Invalid email, password, or code.";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  try {
    await enforceRateLimit("auth", ip);
    const body = parse(loginSchema, await req.json().catch(() => ({})));

    const user = await db.user.findUnique({ where: { email: body.email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    if (user.twoFactorEnabled) {
      if (!body.totpCode) {
        return NextResponse.json({ error: "TWO_FACTOR_REQUIRED", code: "TWO_FACTOR_REQUIRED" }, { status: 403 });
      }
      if (!user.totpSecret || !verifyTotpCode(user.totpSecret, body.totpCode)) {
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
      }
    }

    await createSessionCookie(user);
    await audit({ action: "auth.login", actorId: user.id, ipAddress: ip });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof RateLimitError)
      return NextResponse.json({ error: err.message }, { status: 429 });
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
