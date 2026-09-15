import { BadgeCheck, Flame, LineChart, Sparkles, Users, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { formatCents, formatMultiple } from "@/lib/format";
import { Kicker, H2, Sub, Panel, wrap } from "@/components/ui/Section";
import { NewsletterSignup } from "./NewsletterSignup";

// ---------- data shaping ----------

type ClosedListing = {
  id: string;
  codename: string;
  category: string;
  mrrCents: number | null;
  arrMultiple: number | null;
  saleAmountCents: number | null;
  closedAt: Date;
};

async function loadInsights() {
  const [soldListings, releasedDeals, activeListings] = await Promise.all([
    db.listing.findMany({
      where: { status: "SOLD" },
      include: { escrowDeal: true },
    }),
    db.escrowDeal.findMany({
      where: { status: "RELEASED" },
      include: { listing: true },
    }),
    db.listing.findMany({
      where: { status: { in: ["LIVE", "PENDING_VERIFICATION"] } },
      select: {
        category: true,
        _count: { select: { bids: true, watchers: true } },
      },
    }),
  ]);

  // Merge SOLD listings and RELEASED escrow deals into one de-duplicated set
  // of "closed" listings — a listing can show up via either query (or both).
  const closedById = new Map<string, ClosedListing>();

  for (const l of soldListings) {
    const released = l.escrowDeal && l.escrowDeal.status === "RELEASED" ? l.escrowDeal : null;
    closedById.set(l.id, {
      id: l.id,
      codename: l.codename,
      category: l.category,
      mrrCents: l.mrrCents,
      arrMultiple: l.arrMultiple,
      saleAmountCents: released?.amountCents ?? l.buyNowPriceCents ?? (l.currentBidCents || null),
      closedAt: released?.fundsReleasedAt ?? l.updatedAt,
    });
  }
  for (const d of releasedDeals) {
    const existing = closedById.get(d.listing.id);
    closedById.set(d.listing.id, {
      id: d.listing.id,
      codename: d.listing.codename,
      category: d.listing.category,
      mrrCents: d.listing.mrrCents,
      arrMultiple: d.listing.arrMultiple,
      saleAmountCents: d.amountCents,
      closedAt: d.fundsReleasedAt ?? existing?.closedAt ?? d.updatedAt,
    });
  }

  const closed = Array.from(closedById.values());

  const multiples = closed.map((l) => l.arrMultiple).filter((v): v is number => v != null);
  const avgMultiple = multiples.length ? multiples.reduce((a, b) => a + b, 0) / multiples.length : null;

  const verifiedVolumeCents = closed.reduce((sum, l) => sum + (l.saleAmountCents ?? 0), 0);

  const byCategory = new Map<string, { count: number; multiples: number[]; volumeCents: number }>();
  for (const l of closed) {
    const cur = byCategory.get(l.category) ?? { count: 0, multiples: [], volumeCents: 0 };
    cur.count += 1;
    if (l.arrMultiple != null) cur.multiples.push(l.arrMultiple);
    if (l.saleAmountCents != null) cur.volumeCents += l.saleAmountCents;
    byCategory.set(l.category, cur);
  }
  const categoryStats = Array.from(byCategory.entries())
    .map(([category, v]) => ({
      category,
      count: v.count,
      avgMultiple: v.multiples.length ? v.multiples.reduce((a, b) => a + b, 0) / v.multiples.length : null,
      volumeCents: v.volumeCents,
    }))
    .sort((a, b) => b.count - a.count || (b.avgMultiple ?? 0) - (a.avgMultiple ?? 0));

  const recaps = [...closed]
    .sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime())
    .slice(0, 6);

  // Real buyer-interest signal from live listings: bids + watchlist adds per
  // category. Not a fabricated heatmap — just what buyers are actually doing.
  const interestByCategory = new Map<string, { listings: number; bids: number; watchers: number }>();
  for (const l of activeListings) {
    const cur = interestByCategory.get(l.category) ?? { listings: 0, bids: 0, watchers: 0 };
    cur.listings += 1;
    cur.bids += l._count.bids;
    cur.watchers += l._count.watchers;
    interestByCategory.set(l.category, cur);
  }
  const interestStats = Array.from(interestByCategory.entries())
    .map(([category, v]) => ({ category, ...v, signal: v.bids * 2 + v.watchers }))
    .sort((a, b) => b.signal - a.signal);

  return {
    dealsClosedCount: closed.length,
    avgMultiple,
    verifiedVolumeCents,
    categoriesRepresented: byCategory.size,
    categoryStats,
    recaps,
    interestStats,
  };
}

const GUIDES = [
  { t: "How to value your SaaS before selling", icon: LineChart },
  { t: "What buyers actually check in due diligence", icon: BadgeCheck },
  { t: "How to prepare your app for acquisition", icon: Zap },
];

function CategoryMultipleBar({
  category,
  value,
  max,
}: {
  category: string;
  value: number;
  max: number;
}) {
  const pct = Math.max(4, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-3 py-[7px]">
      <div className="w-[130px] shrink-0 text-[13px] font-medium text-ink-soft">{category}</div>
      <div className="relative h-[22px] flex-1 overflow-hidden rounded-md bg-line-soft">
        <div className="h-full rounded-md bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-[54px] shrink-0 text-right font-mono text-sm font-semibold text-ink">
        {formatMultiple(value)}
      </div>
    </div>
  );
}

export default async function InsightsPage() {
  const data = await loadInsights();
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const maxCategoryMultiple = Math.max(1, ...data.categoryStats.map((c) => c.avgMultiple ?? 0));

  return (
    <div className="pb-[72px] pt-10">
      <div className={wrap}>
        <div className="mb-8 flex items-center justify-between gap-3">
          <Kicker>The Assay Index</Kicker>
          <span className="font-mono text-[12.5px] text-sub">{monthLabel}</span>
        </div>

        {/* HERO — the index */}
        <div className="mb-6 overflow-hidden rounded-card border border-line">
          <div className="relative overflow-hidden bg-brand px-7 py-8 text-white sm:px-9">
            <div className="pointer-events-none absolute -right-10 -top-10 h-[200px] w-[200px] rounded-full bg-[#9C7A3C]/[.16]" />
            <div className="relative flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[1.5px] text-[#C9A961]">
              <Sparkles size={15} strokeWidth={2.3} /> Verified sale multiple
            </div>
            {data.avgMultiple != null ? (
              <>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="font-mono text-[44px] font-semibold tracking-tight sm:text-[48px]">
                    {formatMultiple(data.avgMultiple)}
                  </span>
                  <span className="text-sm text-white/60">average ARR multiple</span>
                </div>
                <p className="mt-2.5 max-w-[520px] text-sm leading-relaxed text-white/70">
                  The average verified SaaS on Assay has sold at <strong className="text-white">{formatMultiple(data.avgMultiple)} ARR</strong>,
                  computed live from {data.dealsClosedCount} independently verified, closed{" "}
                  {data.dealsClosedCount === 1 ? "deal" : "deals"} — never a survey or an estimate.
                </p>
              </>
            ) : (
              <p className="mt-3 max-w-[520px] text-sm leading-relaxed text-white/70">
                No Assay deals have closed yet. The Index will show a real, verified average ARR multiple the
                moment the first sale releases from escrow — nothing here is estimated in the meantime.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 bg-surface sm:grid-cols-4">
            {[
              ["Deals closed", String(data.dealsClosedCount)],
              ["Avg. multiple", formatMultiple(data.avgMultiple)],
              ["Verified volume", data.verifiedVolumeCents > 0 ? formatCents(data.verifiedVolumeCents) : "—"],
              ["Categories represented", String(data.categoriesRepresented)],
            ].map(([label, value], i) => (
              <div
                key={label}
                className={`border-t border-line px-5 py-4 ${i % 4 !== 3 ? "sm:border-r" : ""} ${
                  i % 2 === 0 ? "border-r" : ""
                }`}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[.4px] text-sub">{label}</div>
                <div className="mt-1 font-mono text-xl font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* MULTIPLES BY CATEGORY + DEALS BY CATEGORY */}
        <div className="mb-1 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Panel title="Valuation multiples by category">
            {data.categoryStats.length > 0 ? (
              <>
                {data.categoryStats
                  .filter((c) => c.avgMultiple != null)
                  .map((c) => (
                    <CategoryMultipleBar
                      key={c.category}
                      category={c.category}
                      value={c.avgMultiple as number}
                      max={maxCategoryMultiple}
                    />
                  ))}
                <div className="mt-2.5 text-[11.5px] text-sub-light">
                  × ARR · computed from every verified, closed Assay deal to date.
                  {data.categoryStats.length < 3 &&
                    " More categories will appear here as additional deals close."}
                </div>
              </>
            ) : (
              <p className="text-sm text-sub">
                Not enough closed deals yet to break multiples out by category. Check back once more sales
                close.
              </p>
            )}
          </Panel>
          <Panel title="Deals closed, by category">
            {data.categoryStats.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {data.categoryStats.map((c) => (
                  <div
                    key={c.category}
                    className="flex items-center gap-3 rounded-[11px] border border-[#CDE6DD] bg-trust-bg px-3.5 py-2.5"
                  >
                    <Flame size={17} className="shrink-0 text-trust" />
                    <div className="flex-1">
                      <div className="text-[13.5px] font-semibold">{c.category}</div>
                      <div className="text-[11.5px] text-sub">
                        {c.volumeCents > 0 ? `${formatCents(c.volumeCents)} verified volume` : "volume pending"}
                      </div>
                    </div>
                    <span className="font-mono text-[15px] font-semibold text-trust">
                      {c.count} {c.count === 1 ? "deal" : "deals"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-sub">No closed deals recorded yet.</p>
            )}
          </Panel>
        </div>

        {/* BUYER INTEREST SIGNAL */}
        <div className="mb-1">
          <Panel title="Buyer interest, by category">
            <p className="mb-3.5 -mt-1 text-[12.5px] text-sub">
              Real signal from the live exchange — bids placed and watchlist adds on currently listed
              companies, not a modeled forecast.
            </p>
            {data.interestStats.length > 0 ? (
              <div className="flex flex-col gap-2">
                {data.interestStats.map((c) => (
                  <div key={c.category} className="flex items-center gap-3 py-1">
                    <Users size={15} className="shrink-0 text-brand" />
                    <div className="w-[150px] shrink-0 text-[13px] font-medium text-ink-soft">
                      {c.category}
                    </div>
                    <span className="rounded-full border border-line bg-surface-alt px-2.5 py-0.5 font-mono text-[12px] text-ink-soft">
                      {c.listings} listed
                    </span>
                    <span className="rounded-full border border-[#E8DABB] bg-gold-bg px-2.5 py-0.5 font-mono text-[12px] text-gold">
                      {c.bids} bids
                    </span>
                    <span className="rounded-full border border-[#CDE6DD] bg-trust-bg px-2.5 py-0.5 font-mono text-[12px] text-trust">
                      {c.watchers} watching
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-sub">No live listings on the exchange yet.</p>
            )}
          </Panel>
        </div>
      </div>

      {/* DEAL RECAPS */}
      <div className={`${wrap} mt-8`}>
        <Kicker>Recent deal recaps</Kicker>
        <H2>What actually sold — and for how much.</H2>
        <Sub>
          Every recap below is a real, verified Assay deal. Company identity stays sealed — only the codename,
          category, and reconciled numbers are shown.
        </Sub>

        {data.recaps.length > 0 ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.recaps.map((r) => (
              <div key={r.id} className="rounded-2xl border border-line bg-surface p-[18px]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-sub">{r.category}</span>
                  <BadgeCheck size={15} className="text-gold" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold text-trust">
                    {r.saleAmountCents != null ? formatCents(r.saleAmountCents) : "—"}
                  </span>
                  <span className="text-[12.5px] text-sub">{formatMultiple(r.arrMultiple)}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-ink-soft">
                  {r.mrrCents != null ? `${formatCents(r.mrrCents)} MRR` : "MRR sealed"}
                </div>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-full border border-line bg-surface-alt px-2.5 py-1 font-mono text-[11px] text-sub">
                    {r.codename}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-sub">
            No deals have closed yet — the first recap will appear here the moment a sale releases from
            escrow.
          </div>
        )}
      </div>

      {/* GUIDES */}
      <div className={`${wrap} mt-9`}>
        <Kicker>Guides &amp; playbooks</Kicker>
        <H2>Learn the market before you move.</H2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map((g) => (
            <div key={g.t} className="rounded-2xl border border-line bg-surface p-5">
              <div className="mb-3.5 flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-brand">
                <g.icon size={18} strokeWidth={2.1} className="text-[#C9A961]" />
              </div>
              <div className="font-display text-[17px] font-semibold leading-[1.3]">{g.t}</div>
            </div>
          ))}
        </div>
      </div>

      {/* NEWSLETTER */}
      <div className={`${wrap} mt-9`}>
        <NewsletterSignup />
      </div>
    </div>
  );
}
