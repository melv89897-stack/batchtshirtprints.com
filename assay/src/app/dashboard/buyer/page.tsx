import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Eye, Gavel, Landmark, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security/auth";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Section";
import { formatCents } from "@/lib/format";
import { VerificationButtons } from "./VerificationButtons";

export const dynamic = "force-dynamic";

export default async function BuyerDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [bids, watchlist, deals] = await Promise.all([
    db.bid.findMany({
      where: { bidderId: user.id },
      include: { listing: true },
      orderBy: { createdAt: "desc" },
    }),
    db.watchlistItem.findMany({
      where: { userId: user.id },
      include: { listing: true },
      orderBy: { createdAt: "desc" },
    }),
    db.escrowDeal.findMany({
      where: { buyerId: user.id },
      include: { listing: { select: { codename: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // One row per listing you've bid on, most recent bid amount, leading or outbid.
  const byListing = new Map<string, (typeof bids)[number]>();
  for (const b of bids) {
    if (!byListing.has(b.listingId) || b.amountCents > byListing.get(b.listingId)!.amountCents) {
      byListing.set(b.listingId, b);
    }
  }
  const activeBids = Array.from(byListing.values());

  return (
    <div className="mx-auto max-w-[1080px] px-[22px] py-10">
      <h1 className="mb-6 font-display text-[28px] font-semibold tracking-tight text-ink">Buyer dashboard</h1>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          <Panel title="Your bids">
            {activeBids.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-surface-alt p-6 text-center text-sm text-sub">
                No bids yet.{" "}
                <Link href="/exchange" className="font-semibold text-ink underline">
                  Browse the exchange
                </Link>
                .
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {activeBids.map((b) => {
                  const leading = b.amountCents >= b.listing.currentBidCents;
                  return (
                    <Link
                      key={b.id}
                      href={`/exchange/${b.listingId}`}
                      className="flex items-center justify-between rounded-xl border border-line px-4 py-3 hover:border-brand"
                    >
                      <div>
                        <div className="font-display text-[15px] font-semibold text-ink">{b.listing.codename}</div>
                        <div className="mt-0.5 text-xs text-sub">Your bid: {formatCents(b.amountCents)}</div>
                      </div>
                      <Chip tone={leading ? "trust" : "live"} icon={Gavel}>
                        {leading ? "Leading" : "Outbid — re-bid"}
                      </Chip>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Watchlist">
            {watchlist.length === 0 ? (
              <div className="text-sm text-sub">Nothing on your watchlist yet.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {watchlist.map((w) => (
                  <Link
                    key={w.id}
                    href={`/exchange/${w.listingId}`}
                    className="flex items-center justify-between rounded-xl border border-line px-4 py-3 hover:border-brand"
                  >
                    <div className="flex items-center gap-2">
                      <Eye size={14} className="text-sub-light" />
                      <span className="text-[14px] font-medium text-ink">{w.listing.codename}</span>
                    </div>
                    <span className="font-mono text-sm text-sub">{formatCents(w.listing.currentBidCents)}</span>
                  </Link>
                ))}
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
          <Panel title="Verification status">
            <div className="mb-4 flex flex-col gap-2">
              <StatusRow label="Identity (KYC)" verified={user.kycStatus === "VERIFIED"} status={user.kycStatus} />
              <StatusRow
                label="Proof of funds"
                verified={user.proofOfFundsStatus === "VERIFIED"}
                status={user.proofOfFundsStatus}
              />
            </div>
            <VerificationButtons
              kycVerified={user.kycStatus === "VERIFIED"}
              proofOfFundsVerified={user.proofOfFundsStatus === "VERIFIED"}
            />
            <p className="mt-3 text-xs leading-relaxed text-sub">
              Both are required, along with a signed NDA, before you can bid.
            </p>
          </Panel>

          <div className="flex items-center gap-2 rounded-card border border-line bg-surface p-4 text-[13px] text-ink-soft">
            <BadgeCheck size={16} className="shrink-0 text-gold" />
            Reputation score: <span className="font-mono font-semibold text-ink">{user.reputationScore}</span>
          </div>

          <div className="rounded-card border border-[#E8DABB] bg-gold-bg p-4 text-center">
            <Landmark size={16} className="mx-auto mb-1.5 text-gold" />
            <div className="text-[12px] leading-relaxed text-ink-soft">
              Bidding is never paywalled on Assay — only verification-gated.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, verified, status }: { label: string; verified: boolean; status: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-soft">{label}</span>
      <Chip tone={verified ? "trust" : "neutral"} icon={ShieldCheck}>
        {status}
      </Chip>
    </div>
  );
}
