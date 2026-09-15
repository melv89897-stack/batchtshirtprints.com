import { z } from "zod";

/**
 * Validate environment variables at startup. Only the values every deploy
 * genuinely needs are required; money/KYC provider keys are optional because
 * ESCROW_MODE/KYC_MODE default to "stub" (see .env.example) until a legal
 * review clears real fund custody and identity verification.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  ESCROW_MODE: z.enum(["stub", "stripe"]).default("stub"),
  KYC_MODE: z.enum(["stub", "manual", "persona"]).default("stub"),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PERSONA_API_KEY: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed — refusing to start.");
}

export const env = parsed.data;
