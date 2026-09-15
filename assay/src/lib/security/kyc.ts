import { db } from "@/lib/db";
import { audit } from "./audit";
import type { User } from "@prisma/client";

/**
 * Identity verification (KYC) and proof-of-funds gate bidding on both sides.
 * Real identity verification is a regulated activity in most jurisdictions
 * and needs its own compliance review before launch (see assay/README.md)
 * — so this ships as a swappable adapter rather than a live Persona/Stripe
 * Identity integration with no legal review behind it.
 *
 *   KYC_MODE=stub    (default) — auto-approves instantly. Lets every other
 *                     screen (bidding, NDA, escrow, disputes) be fully
 *                     exercised without a real verification vendor.
 *   KYC_MODE=manual  — requests sit PENDING until an admin approves them
 *                     from /admin/verifications. No auto-approval at all.
 *   KYC_MODE=persona — the real-provider adapter shape: fill in the fetch
 *                     call to Persona/Stripe Identity's inquiry API and flip
 *                     this on once a vendor contract + compliance review
 *                     are in place.
 */
function kycMode(): "stub" | "manual" | "persona" {
  const mode = process.env.KYC_MODE;
  return mode === "manual" || mode === "persona" ? mode : "stub";
}

export async function requestKycVerification(user: User): Promise<User> {
  const mode = kycMode();

  if (mode === "persona") {
    // TODO: call the real provider's inquiry-creation API and store its
    // reference id; verification then completes via that provider's webhook.
  }

  const kycStatus = mode === "stub" ? "VERIFIED" : "PENDING";
  const updated = await db.user.update({ where: { id: user.id }, data: { kycStatus } });

  await audit({
    action: "kyc.requested",
    actorId: user.id,
    targetType: "User",
    targetId: user.id,
    metadata: { mode, resultingStatus: kycStatus },
  });

  return updated;
}

export async function requestProofOfFunds(user: User): Promise<User> {
  const mode = kycMode();
  const proofOfFundsStatus = mode === "stub" ? "VERIFIED" : "PENDING";
  const updated = await db.user.update({ where: { id: user.id }, data: { proofOfFundsStatus } });

  await audit({
    action: "proof_of_funds.requested",
    actorId: user.id,
    targetType: "User",
    targetId: user.id,
    metadata: { mode, resultingStatus: proofOfFundsStatus },
  });

  return updated;
}

/** Admin approves a pending verification (KYC_MODE=manual path). */
export async function adminApproveVerification(
  admin: User,
  targetUserId: string,
  field: "kycStatus" | "proofOfFundsStatus",
): Promise<User> {
  if (admin.role !== "ADMIN") throw new Error("Admin access required.");
  const updated = await db.user.update({
    where: { id: targetUserId },
    data: { [field]: "VERIFIED" },
  });

  await audit({
    action: "verification.admin_approved",
    actorId: admin.id,
    targetType: "User",
    targetId: targetUserId,
    metadata: { field },
  });

  return updated;
}
