import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Dispute } from "@prisma/client";
import { getCurrentUser } from "@/lib/security/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/format";
import { Chip } from "@/components/ui/Chip";
import {
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Check,
  Clock,
  User as UserIcon,
  Building2,
  Scale,
  AlertTriangle,
  CircleDollarSign,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { RaiseDisputeForm } from "./RaiseDisputeForm";
import { SellerRespondForm } from "./SellerRespondForm";
import { ResolveDisputeActions } from "./ResolveDisputeActions";

function dealStatusChip(status: string) {
  switch (status) {
    case "DISPUTED":
      return { tone: "live" as const, icon: Snowflake, label: "Funds frozen — disputed" };
    case "INSPECTION":
      return { tone: "gold" as const, icon: Clock, label: "Inspection window" };
    case "TRANSFERRING":
      return { tone: "gold" as const, icon: Clock, label: "Handover in progress" };
    case "RELEASED":
      return { tone: "trust" as const, icon: CheckCircle2, label: "Funds released to seller" };
    case "REFUNDED":
      return { tone: "trust" as const, icon: CheckCircle2, label: "Funds refunded to buyer" };
    default:
      return { tone: "neutral" as const, icon: ShieldCheck, label: status };
  }
}

const RESOLUTION_COPY: Record<
  NonNullable<Dispute["resolution"]>,
  { label: string; tone: "live" | "trust" | "gold"; icon: typeof XCircle }
> = {
  REFUND_BUYER: { label: "Refunded to the buyer", tone: "live", icon: XCircle },
  RELEASE_SELLER: { label: "Released to the seller", tone: "trust", icon: CheckCircle2 },
  SPLIT: { label: "Split between both sides", tone: "gold", icon: Scale },
};

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function DisputePage({ params }: { params: { dealId: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const deal = await db.escrowDeal.findUnique({
    where: { id: params.dealId },
    include: {
      handoverItems: true,
      disputes: { orderBy: { createdAt: "desc" } },
      listing: { select: { codename: true } },
      buyer: { select: { id: true, displayName: true } },
      seller: { select: { id: true, displayName: true } },
    },
  });

  if (!deal) notFound();

  const isBuyer = user.id === deal.buyerId;
  const isSeller = user.id === deal.sellerId;
  const isAdmin = user.role === "ADMIN";

  if (!isBuyer && !isSeller && !isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-[22px] py-24 text-center">
        <ShieldAlert className="mx-auto mb-4 text-live" size={30} />
        <h1 className="mb-2 font-display text-xl font-semibold text-ink">Access denied</h1>
        <p className="text-sm text-sub">You don&rsquo;t have access to this deal.</p>
      </div>
    );
  }

  const latestDispute = deal.disputes[0] ?? null;
  const activeDispute = deal.disputes.find((d) => d.status !== "RESOLVED") ?? null;
  const status = dealStatusChip(deal.status);

  return (
    <div className="mx-auto max-w-[900px] px-[22px] py-12">
      <Link
        href={`/deals/${deal.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-sub hover:text-ink"
      >
        <ArrowLeft size={14} /> Back to deal
      </Link>

      {/* header / escrow anchor */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-brand p-6 text-white">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-white/10">
            <CircleDollarSign size={22} className="text-gold" />
          </div>
          <div>
            <div className="text-[11.5px] font-bold uppercase tracking-[1px] text-white/60">
              {deal.listing.codename}
            </div>
            <div className="font-mono text-2xl font-semibold tracking-tight">
              {formatCents(deal.amountCents)}
            </div>
          </div>
        </div>
        <Chip tone={status.tone} icon={status.icon}>
          {status.label}
        </Chip>
      </div>

      <h1 className="mb-5 font-display text-2xl font-semibold text-ink">Dispute resolution</h1>

      {/* -------- an active (non-resolved) dispute exists -------- */}
      {activeDispute && (
        <div className="flex flex-col gap-5">
          {/* seller */}
          {isSeller && activeDispute.status === "OPEN" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-card border border-[#EFD9AE] bg-gold-bg p-4">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-gold" />
                <div>
                  <div className="text-[13.5px] font-bold text-ink">The buyer raised a dispute</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                    Your payout is paused. Respond with your side — an Assay reviewer will decide.
                  </p>
                </div>
              </div>
              <div className="rounded-card border border-line bg-surface p-6">
                <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[1.2px] text-sub">
                  Buyer&rsquo;s reason
                </div>
                <p className="text-[13.5px] leading-relaxed text-ink-soft">{activeDispute.reason}</p>
              </div>
              <div className="rounded-card border border-line bg-surface p-6">
                <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[1.2px] text-sub">
                  Your response
                </div>
                <SellerRespondForm disputeId={activeDispute.id} />
              </div>
            </div>
          )}

          {isSeller && activeDispute.status === "SELLER_RESPONDED" && (
            <div className="rounded-card border border-line bg-surface p-6">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold text-trust">
                <Check size={16} strokeWidth={3} /> Response submitted — awaiting the Assay reviewer&rsquo;s decision.
              </div>
            </div>
          )}

          {/* admin */}
          {isAdmin && (
            <div className="flex flex-col gap-5">
              <div className="rounded-card border border-line bg-surface p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11.5px] font-bold uppercase tracking-[1.2px] text-sub">
                    Case file · {deal.listing.codename}
                  </div>
                  <Chip tone="live" icon={Snowflake}>
                    {formatCents(deal.amountCents)} frozen
                  </Chip>
                </div>

                <div className="mb-4 flex items-start gap-2.5 rounded-[12px] border border-[#CDE6DD] bg-trust-bg p-4">
                  <ShieldCheck size={17} className="mt-0.5 shrink-0 text-trust" />
                  <div className="text-[12.5px] leading-relaxed text-ink-soft">
                    <strong>Verified record on file:</strong> handover checklist{" "}
                    {deal.handoverItems.filter((i) => i.done).length}/{deal.handoverItems.length}{" "}
                    confirmed. This is judged against the verified record — not just claims.
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-[12px] border border-line p-4">
                    <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink">
                      <UserIcon size={15} className="text-live" /> Buyer&rsquo;s claim
                    </div>
                    <p className="text-[13px] leading-relaxed text-ink-soft">{activeDispute.reason}</p>
                  </div>
                  <div className="rounded-[12px] border border-line p-4">
                    <div className="mb-2 flex items-center gap-2 text-[13px] font-bold text-ink">
                      <Building2 size={15} className="text-brand" /> Seller&rsquo;s response
                    </div>
                    <p
                      className={`text-[13px] leading-relaxed ${
                        activeDispute.sellerResponse ? "text-ink-soft" : "text-sub-light"
                      }`}
                    >
                      {activeDispute.sellerResponse ?? "Awaiting seller response…"}
                    </p>
                  </div>
                </div>

                <div className="text-[11.5px] font-bold uppercase tracking-[1.2px] text-sub">
                  Handover items
                </div>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {deal.handoverItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-[13px] text-ink-soft">
                      {item.done ? (
                        <Check size={14} className="text-trust" strokeWidth={3} />
                      ) : (
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-line" />
                      )}
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>

              <ResolveDisputeActions disputeId={activeDispute.id} />
            </div>
          )}

          {/* buyer waiting view (or seller/admin combos not covered above) */}
          {isBuyer && (
            <div className="rounded-card border border-line bg-surface p-6">
              <div className="mb-1 text-[11.5px] font-bold uppercase tracking-[1.2px] text-sub">
                Dispute in progress
              </div>
              <p className="mb-5 text-[13px] text-sub">Your money is safe. Here&rsquo;s what happens next.</p>
              <DisputeSteps dispute={activeDispute} />
            </div>
          )}

          {/* seller/admin fallback if neither branch above matched (shouldn't normally happen) */}
          {!isSeller && !isAdmin && !isBuyer && null}
        </div>
      )}

      {/* -------- no active dispute -------- */}
      {!activeDispute && (
        <div className="flex flex-col gap-5">
          {latestDispute && latestDispute.status === "RESOLVED" && (
            <ResolvedSummary dispute={latestDispute} />
          )}

          {isBuyer && (deal.status === "INSPECTION" || deal.status === "TRANSFERRING") && (
            <RaiseDisputeForm dealId={deal.id} />
          )}

          {!(isBuyer && (deal.status === "INSPECTION" || deal.status === "TRANSFERRING")) &&
            !latestDispute && (
              <div className="rounded-card border border-dashed border-line bg-surface p-11 text-center">
                <ShieldCheck className="mx-auto mb-3 text-sub-light" size={26} />
                <div className="mb-1 font-display text-lg font-semibold text-ink">
                  No dispute has been raised on this deal
                </div>
                <p className="mx-auto max-w-sm text-[13.5px] leading-relaxed text-sub">
                  If the buyer raises a dispute during handover or inspection, it will appear here.
                </p>
                <Link
                  href={`/deals/${deal.id}`}
                  className="mt-4 inline-block text-sm font-semibold text-ink hover:underline"
                >
                  Back to the deal
                </Link>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

function DisputeSteps({ dispute }: { dispute: Dispute }) {
  const steps = [
    { t: "Dispute raised", d: dispute.reason, done: true },
    { t: "Funds frozen in escrow", d: "The seller cannot be paid.", done: true },
    {
      t: "Seller responds",
      d: dispute.status === "SELLER_RESPONDED" ? "Response received." : "Awaiting the seller's side.",
      done: dispute.status === "SELLER_RESPONDED",
    },
    { t: "Assay reviews", d: "A neutral reviewer weighs both sides against the verified record.", done: false },
    { t: "Decision applied", d: "Funds refunded, released, or split.", done: false },
  ];
  return (
    <div className="flex flex-col">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-3.5">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                s.done ? "border-trust bg-trust" : "border-line bg-surface"
              }`}
            >
              {s.done ? <Check size={12} className="text-white" strokeWidth={3.5} /> : <span className="h-1.5 w-1.5 rounded-full bg-line" />}
            </div>
            {i < steps.length - 1 && <div className={`w-0.5 flex-1 min-h-[26px] ${s.done ? "bg-trust" : "bg-line"}`} />}
          </div>
          <div className="pb-[18px]">
            <div className={`text-sm font-semibold ${s.done ? "text-ink" : "text-sub"}`}>{s.t}</div>
            <div className="mt-0.5 text-[12.5px] text-sub-light">{s.d}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResolvedSummary({ dispute }: { dispute: Dispute }) {
  const resolution = dispute.resolution ? RESOLUTION_COPY[dispute.resolution] : null;
  return (
    <div className="rounded-card border border-line bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[11.5px] font-bold uppercase tracking-[1.2px] text-sub">Dispute resolved</div>
        {resolution && (
          <Chip tone={resolution.tone} icon={resolution.icon}>
            {resolution.label}
          </Chip>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-[12px] font-bold text-sub">Buyer&rsquo;s reason · {fmtDate(dispute.createdAt)}</div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{dispute.reason}</p>
        </div>
        <div>
          <div className="text-[12px] font-bold text-sub">
            Seller&rsquo;s response{dispute.respondedAt ? ` · ${fmtDate(dispute.respondedAt)}` : ""}
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
            {dispute.sellerResponse ?? "No response was submitted before resolution."}
          </p>
        </div>
        <div>
          <div className="text-[12px] font-bold text-sub">
            Resolution{dispute.resolvedAt ? ` · ${fmtDate(dispute.resolvedAt)}` : ""}
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{dispute.resolutionNote}</p>
        </div>
      </div>
    </div>
  );
}
