"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function StripeConnectForm() {
  const router = useRouter();
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/account/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stripeAccountId: accountId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
      <p className="text-xs leading-relaxed text-sub">
        Enter your Stripe Connect account id (starts with <code className="font-mono">acct_</code>) so Assay can
        verify your live revenue. No real Stripe Connect OAuth app is configured in this environment — this is a
        direct-entry placeholder for that flow.
      </p>
      <input
        required
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        placeholder="acct_1234567890"
        className="rounded-[10px] border border-line px-3.5 py-2.5 font-mono text-sm outline-none focus:border-brand"
      />
      {error && <p className="text-xs text-live">{error}</p>}
      <Button kind="primary" type="submit" disabled={loading}>
        {loading ? "Saving…" : "Connect Stripe account"}
      </Button>
    </form>
  );
}
