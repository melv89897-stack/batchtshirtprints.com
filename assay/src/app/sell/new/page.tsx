"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { wrap } from "@/components/ui/Section";

const CATEGORIES = [
  "SaaS",
  "Shopify App",
  "Subscription app",
  "Paid newsletter",
  "API & dev tools",
  "AI tools",
];

function dollarsToCents(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n * 100);
}

export default function NewListingPage() {
  const router = useRouter();
  const [codename, setCodename] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [realName, setRealName] = useState("");
  const [domain, setDomain] = useState("");
  const [summary, setSummary] = useState("");
  const [askType, setAskType] = useState<"AUCTION" | "BUY_NOW">("AUCTION");
  const [reservePrice, setReservePrice] = useState("");
  const [buyNowPrice, setBuyNowPrice] = useState("");
  const [bidIncrement, setBidIncrement] = useState("25000");
  const [mrr, setMrr] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setTwoFactorRequired(false);

    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codename,
        category,
        realName: realName || undefined,
        domain: domain || undefined,
        summary: summary || undefined,
        askType,
        reservePriceCents: dollarsToCents(reservePrice),
        buyNowPriceCents: askType === "BUY_NOW" ? dollarsToCents(buyNowPrice) : undefined,
        bidIncrementCents: dollarsToCents(bidIncrement),
        mrrCents: dollarsToCents(mrr),
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (res.status === 403 && data.code === "TWO_FACTOR_REQUIRED") {
      setTwoFactorRequired(true);
      return;
    }
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.push(`/exchange/${data.listing.id}`);
  }

  return (
    <div className={`${wrap} max-w-2xl py-12`}>
      <h1 className="mb-2 font-display text-2xl font-semibold text-ink">List your company</h1>
      <p className="mb-8 text-sm text-sub">
        Listing is free. Assay takes a flat 10% deal fee at closing, out of escrow — never up front.
      </p>

      {twoFactorRequired && (
        <div className="mb-6 flex items-start gap-3 rounded-card border border-[#EAD2D2] bg-live-bg p-4 text-sm text-ink-soft">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-live" />
          <div>
            Listing a company requires two-factor authentication.{" "}
            <Link href="/account/security" className="font-semibold text-ink underline">
              Set it up
            </Link>{" "}
            and try again.
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Codename (public)">
          <input
            required
            value={codename}
            onChange={(e) => setCodename(e.target.value)}
            placeholder="Project Halcyon"
            className={inputClass}
          />
        </Field>

        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Legal / company name (private until NDA)">
            <input value={realName} onChange={(e) => setRealName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Domain (private until NDA)">
            <input value={domain} onChange={(e) => setDomain(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <Field label="Summary">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className={inputClass}
          />
        </Field>

        <Field label="Sale type">
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="radio"
                checked={askType === "AUCTION"}
                onChange={() => setAskType("AUCTION")}
              />
              Auction
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="radio"
                checked={askType === "BUY_NOW"}
                onChange={() => setAskType("BUY_NOW")}
              />
              Buy It Now
            </label>
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Reserve price ($)">
            <input
              type="number"
              min="0"
              value={reservePrice}
              onChange={(e) => setReservePrice(e.target.value)}
              className={inputClass}
            />
          </Field>
          {askType === "BUY_NOW" && (
            <Field label="Buy It Now price ($)">
              <input
                type="number"
                min="0"
                value={buyNowPrice}
                onChange={(e) => setBuyNowPrice(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}
          {askType === "AUCTION" && (
            <Field label="Bid increment ($)">
              <input
                type="number"
                min="0"
                value={bidIncrement}
                onChange={(e) => setBidIncrement(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Monthly recurring revenue ($)">
            <input type="number" min="0" value={mrr} onChange={(e) => setMrr(e.target.value)} className={inputClass} />
          </Field>
          {askType === "AUCTION" && (
            <Field label="Auction ends">
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}
        </div>

        {error && <p className="text-sm text-live">{error}</p>}

        <Button kind="gold" icon={ArrowRight} large type="submit" disabled={loading} className="w-full">
          {loading ? "Creating listing…" : "Create draft listing"}
        </Button>
        <p className="text-center text-xs text-sub">
          Your listing starts as a draft. Publish it from the listing page once you&apos;re ready to go live.
        </p>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-[11px] border border-line px-4 py-3 text-sm text-ink outline-none focus:border-brand";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
