# Assay

**The verified exchange for SaaS & subscription apps.**
The others are an upload box. Assay is the verifier.

A full-stack Next.js marketplace for buying and selling SaaS/subscription
businesses: sealed public listings, KYC + NDA-gated data rooms, live
auctions with anti-snipe, escrow-backed handover with a 7-day inspection
window, disputes, and a redaction studio for burning-in redacted financial
statements.

This app was scaffolded from a design/product package (prototypes + a
starter security architecture) into a real, working codebase.

## Stack

- **Next.js 14 (App Router) + TypeScript + Tailwind**
- **Prisma + SQLite** (`prisma/schema.prisma`) — see "Deviations" below
- **A from-scratch auth layer**: bcrypt password hashing, JWT session cookie
  (httpOnly + sameSite=strict), real TOTP two-factor (`otplib` + QR setup)
- **`stripe` SDK** for live, read-only revenue verification
- Zod validation, an in-memory rate limiter, and an append-only audit log
  on every money/document/permission-sensitive action

## Getting started

```bash
cd assay
npm install
cp .env.example .env
# generate a real secret and paste it into .env as AUTH_SECRET:
openssl rand -base64 48

npx prisma migrate dev --name init
npm run db:seed      # demo accounts + listings, see below
npm run dev
```

Open http://localhost:3000.

### Demo accounts (from `npm run db:seed`)

All passwords: `password123!`

| Email | Role |
|---|---|
| `admin@assay.demo` | Admin / dispute reviewer |
| `seller@assay.demo` | Seller with 4 listings (one live auction with bids, one sold-and-disputed deal) |
| `buyer@assay.demo` | Buyer — leading bidder on the flagship listing, has an active dispute |
| `buyer2@assay.demo` | Second bidder |

None of the seeded accounts have two-factor enabled yet — set it up at
`/account/security` before bidding, listing, or moving money, since those
actions require it.

## Deviations from the original starter package, and why

The starter package specified Postgres + Clerk + Stripe Connect + Persona +
S3/R2 + Upstash Redis. None of those services are provisioned in the
environment this was built in, so — matching the same reasoning already
used elsewhere in this repo for the sibling BATCH app — every piece was
either built as a real, from-scratch equivalent, or shipped as a clearly
labeled swappable stub:

| Concern | Starter plan | This build |
|---|---|---|
| Database | Postgres (Supabase/Neon) | **SQLite**, one file, zero services. Two-line change (`provider` + `DATABASE_URL`) to go back to Postgres — nothing else depends on a Postgres-only feature. |
| Auth | Clerk | **From-scratch**: bcrypt (cost 12) + JWT-in-httpOnly-cookie sessions + real TOTP 2FA. No password is ever stored in plaintext; `tokenVersion` lets a password change invalidate every other session instantly. |
| Rate limiting | Upstash Redis | **In-memory sliding window** (`src/lib/security/rate-limit.ts`). Correct for the single-instance deployment this is; swap the module for Redis behind the same `enforceRateLimit()` call if you scale to multiple instances. |
| Document storage | S3/R2 + presigned URLs | **Local encrypted-at-rest-equivalent disk storage** outside the public web root (`storage/private/`), served through an authenticated, NDA-gate-checked, hash-verified Next.js route instead of a presigned URL — same security properties, different transport. Swap `src/lib/security/storage.ts` for S3/R2 to scale beyond one machine. |
| Live revenue verification | Stripe Connect | **Real integration** (`src/lib/security/revenue.ts`) — this one isn't stubbed, because it's read-only (summing a connected account's recent charges) and carries none of the money-transmission risk the two items below do. Requires `STRIPE_SECRET_KEY` and a seller's Stripe Connect account id (see "What's stubbed and why" below). |

## What's still stubbed on purpose — read this before going further

Two pieces of this app touch real regulatory risk, and are **deliberately
left as swappable stubs** (`ESCROW_MODE=stub`, `KYC_MODE=stub` in `.env`)
rather than wired to live money movement or live identity verification:

- **Escrow** (`src/lib/security/escrow.ts`) — holding a buyer's money until
  handover completes is a money-transmission activity in most
  jurisdictions. The full state machine (fund → secure → handover →
  7-day inspection → release, or refund, or dispute-freeze) is completely
  real and testable against the database; it just never calls a real
  payments API. The two `// TODO` lines in that file are where a real
  Stripe Connect transfer/refund would go once a lawyer has signed off.
- **KYC** (`src/lib/security/kyc.ts`) — same caution for identity
  verification. `KYC_MODE=stub` (default) auto-approves so every other
  screen can be exercised end to end; `KYC_MODE=manual` requires an admin
  to approve from `/admin/verifications`; `KYC_MODE=persona` is the real-
  provider adapter shape, ready to fill in once a KYC vendor contract and
  compliance review are in place.

**Do not flip `ESCROW_MODE`/`KYC_MODE` to a live provider, and do not take
this app's escrow/KYC flow live with real users' money or identities,
without an independent security review and legal counsel on
money-transmission, escrow, and data-privacy obligations first.** The
original design package said the same thing, and it's still true.

## Architecture notes

- **Security is layered, and every layer runs on the server.** A disabled
  button in the UI is not security. `src/lib/security/guard.ts`'s
  `withGuard()` wraps every sensitive API route in: authenticate → require
  2FA (if configured) → rate limit → validate the body against a Zod schema
  → run the handler → convert any error into a response that never leaks
  internals. `src/lib/security/authorize.ts` holds the actual "is this user
  allowed to do this, right now?" checks (NDA gate, bid eligibility,
  listing ownership, deal-party checks, admin checks) — these are
  re-checked at the moment of action, never assumed from earlier state.
- **Money is always integer cents.** Never a float, anywhere.
- **Every money movement, document access, and permission change writes to
  `AuditLog`** (append-only — never updated or deleted).
- **The public feed only ever shows a codename.** `realName`/`domain`/the
  document data room only appear once the viewer has signed the NDA for
  that specific listing (or is the seller/an admin) — enforced in
  `src/app/api/listings/[id]/route.ts` and `assertCanAccessDataRoom()`.

## Build order this followed

1. Database schema + seed data
2. Security layer (auth, 2FA, authorization, rate limiting, validation, audit)
3. Escrow / KYC / document-storage / revenue-verification adapters
4. Shared design system (tokens lifted from the brand board prototype)
5. Auth pages + all API routes
6. Every screen: landing, pricing, insights, marketplace feed + listing
   detail + bidding + NDA gate + data room, escrow/handover deal room,
   redaction studio, buyer + seller dashboards, dispute resolution, admin

---

*This is an engineering build, not legal or financial advice. Get an
independent security review and legal counsel on money-transmission,
escrow, and data-privacy obligations before taking this live with real
users' money or identities.*
