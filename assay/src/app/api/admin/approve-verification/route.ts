import { NextResponse } from "next/server";
import { z } from "zod";
import { withGuard } from "@/lib/security/guard";
import { assertIsAdmin } from "@/lib/security/authorize";
import { adminApproveVerification } from "@/lib/security/kyc";

const approveVerificationSchema = z.object({
  userId: z.string().min(1),
  field: z.enum(["kycStatus", "proofOfFundsStatus"]),
});

/** Admin approves a user's pending KYC or proof-of-funds request (KYC_MODE=manual path). */
export const POST = withGuard(
  { requireTwoFactor: true, bodySchema: approveVerificationSchema },
  async ({ user, body }) => {
    assertIsAdmin(user);
    const updated = await adminApproveVerification(user, body.userId, body.field);
    return NextResponse.json({
      ok: true,
      user: { id: updated.id, kycStatus: updated.kycStatus, proofOfFundsStatus: updated.proofOfFundsStatus },
    });
  },
);
