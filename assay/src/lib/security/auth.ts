import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import type { User } from "@prisma/client";

/**
 * Authentication layer. No third-party identity provider is configured in
 * this environment, so this is a self-contained, from-scratch implementation
 * rather than the Clerk wiring in the original starter — but it upholds the
 * same rule the starter's security doc leads with: never store a raw
 * password. Only a bcrypt hash (cost 12) ever touches the database.
 *
 * Session = a signed JWT {sub, tv} in an httpOnly + sameSite=strict (+secure
 * in production) cookie. `tv` (tokenVersion) lets a password change or
 * "sign out everywhere" instantly invalidate every existing session by
 * bumping the counter on the User row.
 */
const COOKIE_NAME = "assay_session";
const SESSION_DAYS = 7;
const BCRYPT_COST = 12;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is not configured — refusing to sign sessions.");
  }
  return new TextEncoder().encode(secret);
}

export class AuthError extends Error {
  constructor(
    public code: "UNAUTHENTICATED" | "TWO_FACTOR_REQUIRED" | "INVALID_TWO_FACTOR_CODE",
    message: string,
  ) {
    super(message);
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionCookie(user: Pick<User, "id" | "tokenVersion">): Promise<void> {
  const token = await new SignJWT({ tv: user.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function destroySessionCookie(): void {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

/** Returns the signed-in User row, or null. Verifies the JWT AND that its
 *  tokenVersion still matches the DB (so a password change kills old sessions). */
export async function getCurrentUser(): Promise<User | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  let payload;
  try {
    ({ payload } = await jwtVerify(token, secretKey()));
  } catch {
    return null;
  }

  const userId = payload.sub;
  if (typeof userId !== "string") return null;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  if (user.tokenVersion !== payload.tv) return null; // revoked (password change, etc.)

  return user;
}

/** Require a signed-in user or throw. Use at the top of every protected action. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("UNAUTHENTICATED", "You must be signed in.");
  return user;
}

/**
 * Require a signed-in user WITH 2FA enabled. Mandatory for anything that
 * places a bid, lists a company, or moves money.
 */
export async function requireTwoFactorUser(): Promise<User> {
  const user = await requireUser();
  if (!user.twoFactorEnabled) {
    throw new AuthError(
      "TWO_FACTOR_REQUIRED",
      "Enable two-factor authentication to continue.",
    );
  }
  return user;
}

// ---------- TOTP two-factor ----------

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export async function totpQrCodeDataUrl(email: string, secret: string): Promise<string> {
  const uri = authenticator.keyuri(email, "Assay", secret);
  return QRCode.toDataURL(uri);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}
