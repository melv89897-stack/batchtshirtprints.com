import { z } from "zod";

/**
 * Every value that enters the server from a browser is validated here first.
 * Assume all input is hostile until proven otherwise.
 */

export const placeBidSchema = z.object({
  listingId: z.string().min(1),
  amountCents: z.number().int().positive().max(1_000_000_000_00), // sanity ceiling
  isProxyMax: z.boolean().optional().default(false),
});

export const createListingSchema = z.object({
  codename: z.string().min(2).max(80),
  category: z.string().min(2).max(80),
  realName: z.string().min(1).max(120).optional(),
  domain: z.string().max(255).optional(),
  summary: z.string().max(4000).optional(),
  askType: z.enum(["AUCTION", "BUY_NOW"]),
  reservePriceCents: z.number().int().positive().optional(),
  buyNowPriceCents: z.number().int().positive().optional(),
  bidIncrementCents: z.number().int().positive().optional(),
  mrrCents: z.number().int().nonnegative().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export const signNdaSchema = z.object({
  listingId: z.string().min(1),
});

export const uploadDocumentSchema = z.object({
  listingId: z.string().min(1),
  type: z.enum(["BANK_STATEMENT", "PROFIT_LOSS", "CONTRACT", "OTHER"]),
  sha256: z.string().length(64),
  dataUrl: z.string().startsWith("data:image/png;base64,"),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10, "Use at least 10 characters."),
  displayName: z.string().min(1).max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().optional(),
});

export const totpVerifySchema = z.object({
  code: z.string().length(6),
});

export const sendMessageSchema = z.object({
  listingId: z.string().min(1),
  body: z.string().min(1).max(4000),
});

export const createDisputeSchema = z.object({
  dealId: z.string().min(1),
  reason: z.string().min(10).max(4000),
});

export const respondDisputeSchema = z.object({
  disputeId: z.string().min(1),
  response: z.string().min(10).max(4000),
});

export const resolveDisputeSchema = z.object({
  disputeId: z.string().min(1),
  resolution: z.enum(["REFUND_BUYER", "RELEASE_SELLER", "SPLIT"]),
  note: z.string().min(1).max(4000),
});

export const handoverItemToggleSchema = z.object({
  itemId: z.string().min(1),
  done: z.boolean(),
});

/** Parse or throw a clean 400-friendly error. */
export function parse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues.map((i) => i.message).join("; ");
    throw new ValidationError(msg);
  }
  return result.data;
}

export class ValidationError extends Error {}
