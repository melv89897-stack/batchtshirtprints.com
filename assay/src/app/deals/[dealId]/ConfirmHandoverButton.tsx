"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleDollarSign } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ConfirmHandoverButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/escrow/${dealId}/confirm-handover`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not confirm handover.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button kind="gold" icon={CircleDollarSign} disabled={loading} className="w-full" onClick={confirm}>
        {loading ? "Confirming…" : "Confirm handover received"}
      </Button>
      {error && <div className="mt-2 text-center text-[12.5px] font-medium text-live">{error}</div>}
    </div>
  );
}
