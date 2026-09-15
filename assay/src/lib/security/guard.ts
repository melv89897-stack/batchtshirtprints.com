import { NextRequest, NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { z } from "zod";
import { requireUser, requireTwoFactorUser, AuthError } from "./auth";
import { ForbiddenError } from "./authorize";
import { parse, ValidationError } from "./validate";
import { enforceRateLimit, RateLimitError, limiters } from "./rate-limit";

/**
 * The spine of the security model. Every protected API route runs through
 * the same gauntlet, in order:
 *
 *   1. Authenticate — who is this?
 *   2. Two-factor   — required for money / bidding / listing actions
 *   3. Rate limit   — per-user, so one route can't be hammered
 *   4. Validate     — the request body is checked against a schema
 *   5. Handler      — your actual logic, with a trusted user + clean input
 *   6. Errors       — turned into safe responses that never leak internals
 *
 * Because it's one wrapper, no route can accidentally skip a layer.
 */
type GuardOptions<TBody> = {
  rateLimit?: keyof typeof limiters;
  requireTwoFactor?: boolean;
  bodySchema?: z.ZodSchema<TBody>;
};

type Handler<TBody> = (ctx: {
  req: NextRequest;
  user: User;
  body: TBody;
  ip: string;
}) => Promise<NextResponse> | Promise<Response>;

export function withGuard<TBody = unknown>(
  opts: GuardOptions<TBody>,
  handler: Handler<TBody>,
) {
  return async (req: NextRequest): Promise<Response> => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    try {
      // 1. Authenticate first so we can rate-limit per user.
      const user = opts.requireTwoFactor ? await requireTwoFactorUser() : await requireUser();

      // 2. Rate limit
      if (opts.rateLimit) {
        await enforceRateLimit(opts.rateLimit, user.id);
      }

      // 3. Validate body
      let body = undefined as TBody;
      if (opts.bodySchema) {
        const json = await req.json().catch(() => ({}));
        body = parse(opts.bodySchema, json);
      }

      // 4. Run the real handler with a trusted user + clean input
      return await handler({ req, user, body, ip });
    } catch (err) {
      return toSafeResponse(err);
    }
  };
}

/** Convert any thrown error into a safe HTTP response. Never leak stack traces. */
function toSafeResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    const status = err.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.reason, details: err.details }, { status: 403 });
  }
  if (err instanceof ValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof RateLimitError) {
    return NextResponse.json(
      { error: err.message },
      { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } },
    );
  }
  console.error("[guard] unhandled error", err);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
