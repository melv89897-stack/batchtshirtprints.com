"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Landmark } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Field = "kycStatus" | "proofOfFundsStatus";

export function ApproveButtons({
  userId,
  kycPending,
  proofOfFundsPending,
}: {
  userId: string;
  kycPending: boolean;
  proofOfFundsPending: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Field | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve(field: Field) {
    setLoading(field);
    setError(null);
    const res = await fetch("/api/admin/approve-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, field }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        {kycPending && (
          <Button kind="ghost" icon={BadgeCheck} disabled={loading !== null} onClick={() => approve("kycStatus")}>
            {loading === "kycStatus" ? "Approving…" : "Approve KYC"}
          </Button>
        )}
        {proofOfFundsPending && (
          <Button kind="ghost" icon={Landmark} disabled={loading !== null} onClick={() => approve("proofOfFundsStatus")}>
            {loading === "proofOfFundsStatus" ? "Approving…" : "Approve proof of funds"}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-live">{error}</p>}
    </div>
  );
}
