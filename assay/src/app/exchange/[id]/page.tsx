import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  ChevronLeft,
  Gavel,
  Globe,
  Landmark,
  Lock,
  ScrollText,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security/auth";
import { Chip } from "@/components/ui/Chip";
import { Seal } from "@/components/ui/Seal";
import { Panel } from "@/components/ui/Section";
import { formatCents, formatMultiple, formatPercent } from "@/lib/format";
import { BidPanel } from "./BidPanel";
import { NdaGate } from "./NdaGate";
import { OwnerPanel } from "./OwnerPanel";
import { DocumentRoom } from "./DocumentRoom";
import { QAPanel } from "./QAPanel";
import { WatchButton } from "./WatchButton";

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const [listing, viewer] = await Promise.all([
    db.listing.findUnique({
      where: { id: params.id },
      include: {
        seller: { select: { id: true, displayName: true, reputationScore: true } },
        bids: {
          orderBy: { amountCents: "desc" },
          take: 20,
          include: { bidder: { select: { id: true, displayName: true } } },
        },
        documents: { select: { id: true, type: true, createdAt: true } },
        _count: { select: { bids: true } },
      },
    }),
    getCurrentUser(),
  ]);

  if (!listing) notFound();

  const isOwner = viewer?.id === listing.sellerId;
  const isAdmin = viewer?.role === "ADMIN";

  const [ndaRow, watchlistRow] = await Promise.all([
    viewer && !isOwner
      ? db.nda.findUnique({ where: { listingId_signerId: { listingId: listing.id, signerId: viewer.id } } })
      : Promise.resolve(null),
    viewer
      ? db.watchlistItem.findUnique({ where: { userId_listingId: { userId: viewer.id, listingId: listing.id } } })
      : Promise.resolve(null),
  ]);

  const ndaSigned = Boolean(ndaRow);
  const unlocked = isOwner || isAdmin || ndaSigned;
  const isAuction = listing.askType === "AUCTION";

  return (
    <div className="mx-auto max-w-[1080px] px-[22px] py-8">
      <Link href="/exchange" className="mb-4 inline-flex items-center gap-1 text-[13px] text-sub hover:text-ink">
        <ChevronLeft size={15} /> Back to Exchange
      </Link>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* LEFT column */}
        <div className="flex flex-col gap-5">
          {/* header */}
          <div className="rounded-card border border-line bg-surface p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {listing.status === "LIVE" && isAuction && (
                    <Chip tone="live" icon={Gavel}>LIVE AUCTION</Chip>
                  )}
                  {listing.status === "LIVE" && !isAuction && (
                    <Chip tone="ink" icon={Zap}>BUY IT NOW</Chip>
                  )}
                  {listing.status !== "LIVE" && <Chip tone="neutral">{listing.status.replace(/_/g, " ")}</Chip>}
                  <Chip tone="neutral">{listing.category}</Chip>
                </div>
                <h1 className="mt-1 font-display text-[30px] font-semibold tracking-tight text-ink">
                  {listing.codename}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-4 font-mono text-[13px] text-sub">
                  <span className="flex items-center gap-1.5">
                    <Globe size={13} />
                    {unlocked && listing.domain ? (
                      listing.domain
                    ) : (
                      <span className="select-none rounded bg-ink px-1.5 py-0.5 text-ink">████████.io</span>
                    )}
                  </span>
                  {unlocked && listing.realName && (
                    <span>
                      <span className="text-sub-light">Legal name:</span> {listing.realName}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 font-ui text-[12px] text-sub-light">
                  Listed by {listing.seller.displayName ?? "a verified seller"} · {listing.seller.reputationScore} rep
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Seal size={48} />
                {viewer && !isOwner && <WatchButton listingId={listing.id} initiallyWatching={Boolean(watchlistRow)} />}
              </div>
            </div>

            {!unlocked && viewer && !isOwner && <NdaGate listingId={listing.id} />}
            {!unlocked && !viewer && (
              <div className="mt-4 rounded-xl border border-dashed border-line bg-surface-alt p-4 text-[13px] text-sub">
                <Link href="/sign-in" className="font-semibold text-ink underline">
                  Sign in
                </Link>{" "}
                to sign the NDA and unlock this listing&apos;s identity and data room.
              </div>
            )}
            {unlocked && !isOwner && (
              <div className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-trust">
                <BadgeCheck size={16} /> NDA signed · full data room unlocked
              </div>
            )}
            {isOwner && (
              <div className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-sub">
                <ShieldCheck size={16} /> You own this listing.
              </div>
            )}
          </div>

          {/* verified metrics */}
          <Panel title="Verified metrics">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <Metric label="MRR" value={listing.mrrCents != null ? formatCents(listing.mrrCents) : "—"} />
              <Metric label="Growth (MoM)" value={formatPercent(listing.growthMoM)} />
              <Metric label="Gross margin" value={formatPercent(listing.grossMargin)} />
              <Metric label="Net churn" value={formatPercent(listing.netChurn)} />
              <Metric label="ARR multiple" value={formatMultiple(listing.arrMultiple)} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <HallmarkBadge ok={listing.stripeVerified} label="Stripe verified" />
              <HallmarkBadge ok={listing.analyticsVerified} label="Analytics verified" />
              <HallmarkBadge ok={listing.statementRedacted} label="Statement redacted" />
              <HallmarkBadge ok={listing.depositsMatched} label="Deposits matched" />
            </div>
          </Panel>

          {/* summary */}
          {listing.summary && (
            <Panel title="About this listing">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-soft">{listing.summary}</p>
            </Panel>
          )}

          {/* data room */}
          <Panel title="Data room">
            {unlocked ? (
              <DocumentRoom
                documents={listing.documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
              />
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-line bg-surface-alt p-5 text-[13px] text-sub">
                <Lock size={16} className="shrink-0 text-sub-light" />
                Sign the NDA above to open redacted statements and supporting documents.
              </div>
            )}
          </Panel>

          {/* Q&A */}
          <Panel title="Ask the seller">
            {unlocked && viewer ? (
              <QAPanel listingId={listing.id} viewerId={viewer.id} />
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-line bg-surface-alt p-5 text-[13px] text-sub">
                <ScrollText size={16} className="shrink-0 text-sub-light" />
                Sign the NDA to message the seller confidentially.
              </div>
            )}
          </Panel>
        </div>

        {/* RIGHT rail */}
        <div className="flex flex-col gap-4">
          {isOwner ? (
            <OwnerPanel
              listingId={listing.id}
              status={listing.status}
              endsAt={listing.endsAt ? listing.endsAt.toISOString() : null}
              hasBids={listing._count.bids > 0}
              stripeVerified={listing.stripeVerified}
              analyticsVerified={listing.analyticsVerified}
            />
          ) : (
            <BidPanel
              listingId={listing.id}
              currentBidCents={listing.currentBidCents}
              bidIncrementCents={listing.bidIncrementCents}
              endsAt={listing.endsAt ? listing.endsAt.toISOString() : null}
              buyNowPriceCents={listing.buyNowPriceCents}
              reservePriceCents={listing.reservePriceCents}
              bidCount={listing._count.bids}
              viewer={{
                signedIn: Boolean(viewer),
                kycVerified: viewer?.kycStatus === "VERIFIED",
                proofOfFundsVerified: viewer?.proofOfFundsStatus === "VERIFIED",
                ndaSigned,
              }}
            />
          )}

          <Panel title="Transparent bid history">
            {listing.bids.length === 0 ? (
              <div className="text-sm text-sub">No bids yet.</div>
            ) : (
              <div className="flex flex-col">
                {listing.bids.map((b, i) => {
                  const mine = b.bidderId === viewer?.id;
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center justify-between py-2.5 ${
                        i < listing.bids.length - 1 ? "border-b border-line-soft" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${mine ? "bg-live" : "bg-sub-light"}`} />
                        <span className={`text-[13px] ${mine ? "font-bold text-live" : "font-medium text-ink"}`}>
                          {mine ? "You" : b.bidder.displayName ?? "Bidder"}
                        </span>
                        <span className="text-[11px] text-sub-light">{b.createdAt.toLocaleDateString()}</span>
                      </div>
                      <span className="font-mono text-[13.5px] font-semibold text-ink">{formatCents(b.amountCents)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <div className="rounded-card border border-[#E8DABB] bg-gold-bg p-4 text-center">
            <Landmark size={16} className="mx-auto mb-1.5 text-gold" />
            <div className="text-[12px] leading-relaxed text-ink-soft">
              Winning funds route straight into Assay Escrow and release only after handover is confirmed.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-[.4px] text-sub">{label}</div>
      <div className="mt-0.5 font-mono text-xl font-semibold tracking-tight text-ink">{value}</div>
    </div>
  );
}

function HallmarkBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[12.5px] font-semibold ${
        ok ? "border-[#CDE6DD] bg-trust-bg text-ink" : "border-line bg-surface-alt text-sub-light"
      }`}
    >
      <BadgeCheck size={13} className={ok ? "text-trust" : "text-sub-light"} />
      {label}
      {!ok && <span className="text-[10.5px] font-normal">(pending)</span>}
    </span>
  );
}
