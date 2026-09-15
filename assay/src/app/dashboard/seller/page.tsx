import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, FileImage, Gavel, Landmark, Plus, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security/auth";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { formatCents } from "@/lib/format";
import { StripeConnectForm } from "./StripeConnectForm";

export const dynamic = "force-dynamic";

export default async function SellerDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [listings, deals] = await Promise.all([
    db.listing.findMany({
      where: { sellerId: user.id },
      include: {
        bids: { orderBy: { amountCents: "desc" }, take: 1 },
        _count: { select: { bids: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.escrowDeal.findMany({
      where: { sellerId: user.id },
      include: { listing: { select: { codename: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1080px] px-[22px] py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink">Seller dashboard</h1>
        <Link href="/sell/new">
          <Button kind="gold" icon={Plus}>
            List a new company
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          <Panel title="Your listings">
            {listings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-surface-alt p-6 text-center text-sm text-sub">
                You haven&apos;t listed a company yet.{" "}
                <Link href="/sell/new" className="font-semibold text-ink underline">
                  Start here.
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {listings.map((l) => {
                  const highBid = l.bids[0]?.amountCents ?? l.currentBidCents;
                  return (
                    <div key={l.id} className="rounded-xl border border-line p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Link href={`/exchange/${l.id}`} className="font-display text-[16px] font-semibold text-ink hover:underline">
                              {l.codename}
                            </Link>
                            <Chip tone="neutral">{l.status.replace(/_/g, " ")}</Chip>
                          </div>
                          <div className="mt-1 text-xs text-sub">{l.category}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-lg font-semibold text-ink">{formatCents(highBid)}</div>
                          <div className="text-xs text-sub">{l._count.bids} bids</div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <HallmarkChip ok={l.stripeVerified} label="Stripe verified" />
                        <HallmarkChip ok={l.analyticsVerified} label="Analytics verified" />
                        <HallmarkChip ok={l.statementRedacted} label="Statement redacted" />
                        <HallmarkChip ok={l.depositsMatched} label="Deposits matched" />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3 text-[13px] font-semibold">
                        <Link href={`/exchange/${l.id}`} className="inline-flex items-center gap-1 text-ink underline">
                          <Gavel size={13} /> Manage listing
                        </Link>
                        {!l.statementRedacted && (
                          <Link
                            href={`/redaction-studio?listingId=${l.id}`}
                            className="inline-flex items-center gap-1 text-ink underline"
                          >
                            <FileImage size={13} /> Redact a statement
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Deals in escrow">
            {deals.length === 0 ? (
              <div className="text-sm text-sub">No deals in escrow yet.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {deals.map((d) => (
                  <Link
                    key={d.id}
                    href={`/deals/${d.id}`}
                    className="flex items-center justify-between rounded-xl border border-line px-4 py-3 hover:border-brand"
                  >
                    <div>
                      <div className="text-[14px] font-semibold text-ink">{d.listing.codename}</div>
                      <div className="text-xs text-sub">{d.status.replace(/_/g, " ")}</div>
                    </div>
                    <div className="font-mono text-sm font-semibold text-ink">{formatCents(d.amountCents)}</div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Payout account">
            {user.stripeAccountId ? (
              <div className="flex items-center gap-2 text-sm text-trust">
                <ShieldCheck size={16} /> Stripe connected ({user.stripeAccountId})
              </div>
            ) : (
              <StripeConnectForm />
            )}
          </Panel>

          <div className="rounded-card border border-[#E8DABB] bg-gold-bg p-4 text-center">
            <Landmark size={16} className="mx-auto mb-1.5 text-gold" />
            <div className="text-[12px] leading-relaxed text-ink-soft">
              Assay takes a flat 10% deal fee at closing, out of escrow. Free to list.
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-card border border-line bg-surface p-4 text-[13px] text-ink-soft">
            <BadgeCheck size={16} className="shrink-0 text-gold" />
            Reputation score: <span className="font-mono font-semibold text-ink">{user.reputationScore}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HallmarkChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Chip tone={ok ? "trust" : "neutral"} icon={BadgeCheck}>
      {label}
      {!ok && " (pending)"}
    </Chip>
  );
}
