import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSessionCookie } from "@/lib/security/auth";
import { parse, ValidationError, signupSchema } from "@/lib/security/validate";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";

const TRIAL_DAYS = 14;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  try {
    await enforceRateLimit("auth", ip);
    const body = parse(signupSchema, await req.json().catch(() => ({})));

    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(body.password);
    const user = await db.user.create({
      data: {
        email: body.email,
        passwordHash,
        displayName: body.displayName,
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    await createSessionCookie(user);
    await audit({ action: "auth.signup", actorId: user.id, ipAddress: ip });

    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof RateLimitError)
      return NextResponse.json({ error: err.message }, { status: 429 });
    console.error("[auth/signup]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
