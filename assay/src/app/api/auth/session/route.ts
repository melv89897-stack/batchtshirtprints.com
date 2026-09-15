import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      kycStatus: user.kycStatus,
      proofOfFundsStatus: user.proofOfFundsStatus,
      twoFactorEnabled: user.twoFactorEnabled,
      membershipTier: user.membershipTier,
      reputationScore: user.reputationScore,
    },
  });
}
