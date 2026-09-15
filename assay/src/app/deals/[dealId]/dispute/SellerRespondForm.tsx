"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Seller's form to respond to an OPEN dispute before the reviewer decides. */
export function SellerRespondForm({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/disputes/${disputeId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disputeId, response: response.trim() }),
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
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <textarea
        required
        minLength={10}
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Explain your side. Reference what was transferred and how it matches the verified record…"
        className="min-h-[110px] resize-y rounded-[11px] border border-line bg-surface p-3.5 font-ui text-sm leading-relaxed text-ink outline-none focus:border-brand"
      />
      {response.trim().length > 0 && response.trim().length < 10 && (
        <p className="text-xs text-live">At least 10 characters.</p>
      )}
      {error && <p className="text-sm text-live">{error}</p>}
      <div>
        <Button kind="primary" icon={MessageSquare} type="submit" disabled={loading || response.trim().length < 10}>
          {loading ? "Submitting…" : "Submit response"}
        </Button>
      </div>
    </form>
  );
}
