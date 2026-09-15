"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Buyer's form to raise a dispute. Submitting freezes the deal immediately. */
export function RaiseDisputeForm({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = reason.trim().length > 0 && reason.trim().length < 10;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId, reason: reason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-card border border-[#EAD2D2] bg-live-bg p-6">
      <div className="mb-1 flex items-center gap-2">
        <AlertTriangle size={18} className="text-live" />
        <h2 className="font-display text-lg font-semibold text-ink">Raise a dispute</h2>
      </div>
      <p className="mb-5 text-[13.5px] leading-relaxed text-sub">
        The moment you submit, the funds freeze. Nothing is released to the seller until an Assay
        reviewer resolves this.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <textarea
          required
          minLength={10}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe the problem with specifics — dates, what was promised vs. delivered…"
          className="min-h-[110px] resize-y rounded-[11px] border border-line bg-surface p-3.5 font-ui text-sm leading-relaxed text-ink outline-none focus:border-brand"
        />
        {tooShort && <p className="text-xs text-live">At least 10 characters.</p>}
        {error && <p className="text-sm text-live">{error}</p>}
        <div>
          <Button
            kind="danger"
            icon={Snowflake}
            type="submit"
            disabled={loading || reason.trim().length < 10}
          >
            {loading ? "Submitting…" : "Submit & freeze funds"}
          </Button>
        </div>
      </form>
    </div>
  );
}
