"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function VerificationButtons({
  kycVerified,
  proofOfFundsVerified,
}: {
  kycVerified: boolean;
  proofOfFundsVerified: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function request(path: string) {
    setLoading(path);
    await fetch(path, { method: "POST" });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {!kycVerified && (
        <Button kind="primary" disabled={loading === "kyc"} onClick={() => request("/api/verification/kyc")}>
          {loading === "kyc" ? "Requesting…" : "Complete identity verification (KYC)"}
        </Button>
      )}
      {!proofOfFundsVerified && (
        <Button
          kind="ghost"
          disabled={loading === "funds"}
          onClick={() => request("/api/verification/proof-of-funds")}
        >
          {loading === "funds" ? "Requesting…" : "Verify proof of funds"}
        </Button>
      )}
    </div>
  );
}
