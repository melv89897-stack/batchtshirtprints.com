import Link from "next/link";
import {
  BadgeCheck,
  Gavel,
  Landmark,
  Lock,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { Chip } from "@/components/ui/Chip";
import { formatCents, formatMultiple, timeLeft } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = { category?: string };

export default async function ExchangePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const category = searchParams.category;

  const [listings, categoryRows] = await Promise.all([
    db.listing.findMany({
      where: {
        status: "LIVE",
        category: category ?? undefined,
      },
      select: {
        id: true,
        codename: true,
        category: true,
        askType: true,
        reservePriceCents: true,
        buyNowPriceCents: true,
        currentBidCents: true,
        bidIncrementCents: true,
        endsAt: true,
        mrrCents: true,
        growthMoM: true,
        arrMultiple: true,
        stripeVerified: true,
        analyticsVerified: true,
        statementRedacted: true,
        depositsMatched: true,
        _count: { select: { bids: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.listing.findMany({
      where: { status: "LIVE" },
      select: { category: true },
      distinct: ["category"],
    }),
  ]);

  const categories = categoryRows.map((c) => c.category).sort();

  return (
    <div className="mx-auto max-w-[1080px] px-[22px] py-10">
      {/* Trust banner */}
      <div className="relative mb-8 overflow-hidden rounded-card bg-brand p-7 text-white">
        <div className="absolute -right-8 -top-8 h-44 w-44 rounded-full bg-[#9C7A3C]/[.14]" />
        <div className="mb-1 flex items-center gap-2 text-[11.5px] font-bold tracking-[1.5px] text-[#C9A961]">
          <BadgeCheck size={14} /> THE ASSAY STANDARD
        </div>
        <div className="mb-1 max-w-xl font-display text-[22px] font-medium leading-snug">
          Nothing sells here until it&apos;s been proven real.
        </div>
        <p className="mb-5 max-w-xl text-[13.5px] leading-relaxed text-white/70">
          We assay every company the way a mint assays gold — tested for purity before it carries a hallmark.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: BadgeCheck, t: "Metric-verified", d: "Live Stripe & analytics, cross-checked against redacted bank deposits." },
            { icon: ShieldCheck, t: "KYC-gated buyers", d: "Every bidder passes identity + proof-of-funds before a paddle lifts." },
            { icon: Landmark, t: "Escrow-protected", d: "Funds lock in escrow; released only after a 7-day inspection." },
          ].map((p) => (
            <div key={p.t} className="flex items-start gap-2.5">
              <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-white/10">
                <p.icon size={16} color="#C9A961" strokeWidth={2.2} />
              </div>
              <div>
                <div className="text-[13.5px] font-bold">{p.t}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-white/60">{p.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] font-semibold tracking-tight text-ink">The Exchange</h1>
          <p className="mt-1 text-[13.5px] text-sub">Verified SaaS companies, sold under sealed conditions.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <CategoryPill label="All" href="/exchange" active={!category} />
          {categories.map((c) => (
            <CategoryPill key={c} label={c} href={`/exchange?category=${encodeURIComponent(c)}`} active={category === c} />
          ))}
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-10 text-center text-sm text-sub">
          No live listings{category ? ` in "${category}"` : ""} right now. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryPill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3.5 py-1.5 font-ui text-[12.5px] font-semibold transition ${
        active ? "border-ink bg-ink text-white" : "border-line bg-surface text-sub hover:border-brand hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

type ListingRow = {
  id: string;
  codename: string;
  category: string;
  askType: string; // "AUCTION" | "BUY_NOW"
  reservePriceCents: number | null;
  buyNowPriceCents: number | null;
  currentBidCents: number;
  bidIncrementCents: number;
  endsAt: Date | null;
  mrrCents: number | null;
  growthMoM: number | null;
  arrMultiple: number | null;
  stripeVerified: boolean;
  analyticsVerified: boolean;
  statementRedacted: boolean;
  depositsMatched: boolean;
  _count: { bids: number };
};

function ListingCard({ listing: l }: { listing: ListingRow }) {
  const isAuction = l.askType === "AUCTION";
  const reserveMet = l.reservePriceCents ? l.currentBidCents >= l.reservePriceCents : true;

  return (
    <Link
      href={`/exchange/${l.id}`}
      className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_8px_28px_rgba(20,50,75,.08)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Lock size={12} className="text-sub-light" />
            <span className="truncate font-display text-[17px] font-semibold text-ink">{l.codename}</span>
          </div>
          <div className="mt-0.5 text-xs text-sub">{l.category}</div>
        </div>
        {isAuction ? (
          <Chip tone="live" icon={Gavel}>LIVE</Chip>
        ) : (
          <Chip tone="ink" icon={Zap}>BUY NOW</Chip>
        )}
      </div>

      <div className="flex items-center justify-between rounded-[10px] border border-line-soft bg-surface-alt px-3.5 py-3">
        <div>
          <div className="font-ui text-[11px] font-semibold uppercase tracking-[.4px] text-sub">MRR</div>
          <div className="mt-0.5 font-mono text-xl font-semibold tracking-tight text-ink">
            {l.mrrCents != null ? formatCents(l.mrrCents) : "—"}
          </div>
          {l.growthMoM != null && (
            <div className="mt-0.5 text-[11px] text-sub-light">
              {l.growthMoM >= 0 ? "+" : ""}
              {(l.growthMoM * 100).toFixed(1)}% MoM
            </div>
          )}
        </div>
        <TrendingUp size={20} className="text-trust" strokeWidth={2} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {l.stripeVerified && (
          <Chip tone="trust" icon={BadgeCheck}>Stripe verified</Chip>
        )}
        {l.analyticsVerified && (
          <Chip tone="trust" icon={ShieldCheck}>Analytics verified</Chip>
        )}
        {l.depositsMatched && (
          <Chip tone="gold" icon={Landmark}>Deposits matched</Chip>
        )}
        {l.arrMultiple != null && <Chip tone="neutral">{formatMultiple(l.arrMultiple)} ARR</Chip>}
      </div>

      <div className="h-px bg-line-soft" />

      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[.4px] text-sub">
            {isAuction ? "Current bid" : "Buy It Now"}
          </div>
          <div className="mt-0.5 font-mono text-xl font-semibold tracking-tight text-ink">
            {isAuction ? formatCents(l.currentBidCents) : formatCents(l.buyNowPriceCents ?? 0)}
          </div>
          {isAuction && (
            <div className={`mt-0.5 text-[11px] font-semibold ${reserveMet ? "text-trust" : "text-live"}`}>
              {reserveMet ? "Reserve met" : "Reserve not met"} · {l._count.bids} bids
            </div>
          )}
        </div>
        {isAuction && l.endsAt && (
          <div className="text-right">
            <div className="text-[11px] font-semibold text-sub">Ends</div>
            <div className="font-mono text-sm font-semibold text-ink">{timeLeft(l.endsAt)}</div>
          </div>
        )}
      </div>
    </Link>
  );
}
