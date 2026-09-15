"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle, CheckCircle2, Scale } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Resolution = "REFUND_BUYER" | "RELEASE_SELLER" | "SPLIT";

/** Admin's decision panel — requires a note before any resolution button is enabled. */
export function ResolveDisputeActions({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<Resolution | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAct = note.trim().length > 0 && loading === null;

  async function resolve(resolution: Resolution) {
    setLoading(resolution);
    setError(null);
    const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disputeId, resolution, note: note.trim() }),
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
    <div className="rounded-card border border-line bg-surface p-6">
      <div className="mb-1 text-[11.5px] font-bold uppercase tracking-[1.2px] text-sub">Decision</div>
      <p className="mb-4 text-[13px] text-sub">
        Apply the fairest outcome based on both sides' statements and the verified record. A note is
        required — it's recorded with the resolution.
      </p>
      <textarea
        required
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Explain the reasoning behind this decision…"
        className="mb-4 min-h-[90px] w-full resize-y rounded-[11px] border border-line bg-surface-alt p-3.5 font-ui text-sm leading-relaxed text-ink outline-none focus:border-brand"
      />
      {error && <p className="mb-3 text-sm text-live">{error}</p>}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Button kind="danger" icon={XCircle} disabled={!canAct} onClick={() => resolve("REFUND_BUYER")}>
          {loading === "REFUND_BUYER" ? "Refunding…" : "Refund buyer"}
        </Button>
        <Button kind="ghost" icon={Scale} disabled={!canAct} onClick={() => resolve("SPLIT")}>
          {loading === "SPLIT" ? "Applying…" : "Split"}
        </Button>
        <Button kind="primary" icon={CheckCircle2} disabled={!canAct} onClick={() => resolve("RELEASE_SELLER")}>
          {loading === "RELEASE_SELLER" ? "Releasing…" : "Release to seller"}
        </Button>
      </div>
      {!note.trim() && (
        <p className="mt-3 text-xs text-sub-light">Type a note above to enable the decision buttons.</p>
      )}
    </div>
  );
}
