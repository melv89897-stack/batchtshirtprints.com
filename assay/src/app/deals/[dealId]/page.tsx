import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, Landmark, ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security/auth";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Section";
import { formatCents, timeLeft } from "@/lib/format";
import { HandoverChecklist } from "./HandoverChecklist";
import { ConfirmHandoverButton } from "./ConfirmHandoverButton";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "gold" | "trust" | "live" | "ink" | "dark"> = {
  FUNDS_PENDING: "neutral",
  FUNDS_SECURED: "gold",
  TRANSFERRING: "gold",
  INSPECTION: "trust",
  RELEASED: "trust",
  DISPUTED: "live",
  REFUNDED: "neutral",
} as const;

const STATUS_LABEL: Record<string, string> = {
  FUNDS_PENDING: "Funds pending",
  FUNDS_SECURED: "Funds secured in escrow",
  TRANSFERRING: "Assets transferring",
  INSPECTION: "Inspection window",
  RELEASED: "Funds released",
  DISPUTED: "Disputed",
  REFUNDED: "Refunded",
};

export default async function DealRoomPage({ params }: { params: { dealId: string } }) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Blocked>
        <Link href="/sign-in" className="font-semibold text-ink underline">
          Sign in
        </Link>{" "}
        to view this deal room.
      </Blocked>
    );
  }

  const deal = await db.escrowDeal.findUnique({
    where: { id: params.dealId },
    include: {
      handoverItems: true,
      disputes: { orderBy: { createdAt: "desc" } },
      listing: { select: { id: true, codename: true, realName: true } },
      buyer: { select: { id: true, displayName: true } },
      seller: { select: { id: true, displayName: true } },
    },
  });

  if (!deal) {
    return <Blocked>Deal not found.</Blocked>;
  }

  const isBuyer = deal.buyerId === user.id;
  const isSeller = deal.sellerId === user.id;
  const isAdmin = user.role === "ADMIN";
  const isParty = isBuyer || isSeller || isAdmin;

  if (!isParty) {
    return <Blocked>You don&apos;t have access to this deal.</Blocked>;
  }

  const canToggle = isSeller || isAdmin;
  const allDone = deal.handoverItems.length > 0 && deal.handoverItems.every((i) => i.done);
  const canConfirmHandover =
    isBuyer && allDone && !["INSPECTION", "RELEASED", "DISPUTED", "REFUNDED"].includes(deal.status);
  const netToSeller = deal.amountCents - deal.platformFeeCents;

  return (
    <div className="mx-auto max-w-[1080px] px-[22px] py-8">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Chip tone={STATUS_TONE[deal.status]}>{STATUS_LABEL[deal.status] ?? deal.status}</Chip>
        <Chip tone="neutral">{deal.listing.codename}</Chip>
      </div>
      <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink">Deal room</h1>
      <p className="mt-1 text-[13.5px] text-sub">
        Buyer <strong className="text-ink">{isBuyer ? "you" : deal.buyer.displayName ?? "Buyer"}</strong> · Seller{" "}
        <strong className="text-ink">{isSeller ? "you" : deal.seller.displayName ?? "Seller"}</strong>
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* LEFT */}
        <div className="flex flex-col gap-5">
          {deal.status === "DISPUTED" ? (
            <Panel title="Handover checklist">
              <div className="flex items-start gap-3 rounded-xl border border-[#EAD2D2] bg-live-bg p-4">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-live" />
                <div>
                  <div className="text-[13.5px] font-bold text-ink">This deal is under dispute</div>
                  <div className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                    Funds are frozen until a neutral Assay reviewer resolves it. The handover checklist is paused.
                  </div>
                  <Link
                    href={`/deals/${deal.id}/dispute`}
                    className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink underline"
                  >
                    View dispute <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>
            </Panel>
          ) : (
            <HandoverChecklist
              dealId={deal.id}
              canToggle={canToggle}
              items={deal.handoverItems.map((i) => ({
                id: i.id,
                label: i.label,
                description: i.description,
                done: i.done,
              }))}
            />
          )}

          {deal.disputes.length > 0 && deal.status !== "DISPUTED" && (
            <Panel title="Dispute history">
              <div className="flex flex-col gap-2">
                {deal.disputes.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5 text-[13px]">
                    <span className="text-ink-soft">{d.reason.slice(0, 80)}</span>
                    <Chip tone={d.status === "RESOLVED" ? "trust" : "gold"}>{d.status.replace(/_/g, " ")}</Chip>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-4">
          <div className="rounded-card bg-brand p-5 text-white">
            <div className="flex items-center gap-1.5 text-[11.5px] font-bold tracking-[1px] text-[#C9A961]">
              <Landmark size={14} /> ESCROW
            </div>
            <div className="mt-2 font-mono text-[28px] font-semibold tracking-tight">{formatCents(deal.amountCents)}</div>
            <div className="mt-1 text-[12.5px] text-white/65">Held safely by Assay Escrow</div>
            <div className="my-4 h-px bg-white/10" />
            <div className="flex items-center justify-between py-1 text-[13px]">
              <span className="text-white/70">Platform fee</span>
              <span className="font-mono font-semibold">{formatCents(deal.platformFeeCents)}</span>
            </div>
            <div className="flex items-center justify-between py-1 text-[13px]">
              <span className="text-white/70">Net to seller</span>
              <span className="font-mono font-semibold">{formatCents(netToSeller)}</span>
            </div>
          </div>

          {deal.status === "INSPECTION" && (
            <Panel title="7-day inspection">
              <div className="font-mono text-2xl font-semibold text-ink">{timeLeft(deal.inspectionEndsAt)}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-sub">
                The buyer may raise a dispute during this window. Otherwise funds release automatically to the seller.
              </p>
              {isBuyer && (
                <Link
                  href={`/deals/${deal.id}/dispute`}
                  className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-live"
                >
                  <ShieldAlert size={14} /> Raise a dispute
                </Link>
              )}
            </Panel>
          )}

          {canConfirmHandover && (
            <Panel title="Confirm receipt">
              <p className="mb-3 text-xs leading-relaxed text-sub">
                Every asset has been marked transferred. Confirm you&apos;ve received everything to start the 7-day
                inspection window.
              </p>
              <ConfirmHandoverButton dealId={deal.id} />
            </Panel>
          )}

          {deal.status === "RELEASED" && (
            <div className="rounded-card border border-[#CDE6DD] bg-trust-bg p-4 text-center text-[13px] font-semibold text-trust">
              Funds released to the seller
              {deal.fundsReleasedAt ? ` on ${deal.fundsReleasedAt.toLocaleDateString()}` : ""}.
            </div>
          )}
          {deal.status === "REFUNDED" && (
            <div className="rounded-card border border-line bg-surface-alt p-4 text-center text-[13px] font-semibold text-sub">
              Funds were refunded to the buyer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Blocked({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-[22px] py-24 text-center">
      <div className="mb-3 text-sub-light">
        <ShieldAlert size={32} className="mx-auto" />
      </div>
      <p className="text-[15px] text-sub">{children}</p>
    </div>
  );
}
