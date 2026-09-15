"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Gavel, ShieldAlert, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { formatCents, timeLeft } from "@/lib/format";
import { readActionError, type ActionError } from "./twoFactor";

type Props = {
  listingId: string;
  currentBidCents: number;
  bidIncrementCents: number;
  endsAt: string | null; // ISO
  buyNowPriceCents: number | null;
  reservePriceCents: number | null;
  bidCount: number;
  /** Whether the signed-in viewer meets every prerequisite the server will re-check. */
  viewer: {
    signedIn: boolean;
    kycVerified: boolean;
    proofOfFundsVerified: boolean;
    ndaSigned: boolean;
  };
};

export function BidPanel({
  listingId,
  currentBidCents,
  bidIncrementCents,
  endsAt,
  buyNowPriceCents,
  reservePriceCents,
  bidCount,
  viewer,
}: Props) {
  const router = useRouter();
  const [, setTick] = useState(0);
  const [amount, setAmount] = useState<string>(String(currentBidCents + bidIncrementCents));
  const [isProxyMax, setIsProxyMax] = useState(false);
  const [loading, setLoading] = useState<"bid" | "buyNow" | null>(null);
  const [error, setError] = useState<ActionError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Recompute the "time left" display periodically without a network round-trip.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const endsAtDate = endsAt ? new Date(endsAt) : null;
  const ended = endsAtDate ? endsAtDate.getTime() <= Date.now() : false;
  const urgent = endsAtDate ? endsAtDate.getTime() - Date.now() < 2 * 60 * 1000 && !ended : false;
  const reserveMet = reservePriceCents ? currentBidCents >= reservePriceCents : true;
  const minimumNext = currentBidCents + bidIncrementCents;

  const canBid = viewer.signedIn && viewer.kycVerified && viewer.proofOfFundsVerified && viewer.ndaSigned && !ended;

  async function placeBid(amountCents: number, kind: "bid" | "buyNow") {
    setLoading(kind);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, amountCents, isProxyMax: kind === "bid" ? isProxyMax : false }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (typeof json.minimumCents === "number") {
          setError({ message: `Bid must be at least ${formatCents(json.minimumCents)}.` });
        } else {
          setError(await readActionError(res));
        }
        return;
      }
      setSuccess(
        json.antiSnipeExtended
          ? "Bid placed — anti-snipe extended the auction by 2 minutes."
          : "Bid placed.",
      );
      router.refresh();
    } catch {
      setError({ message: "Network error — please try again." });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className={`flex items-center justify-between px-5 py-3.5 text-white ${urgent ? "bg-live" : "bg-ink"}`}>
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold">
            <Clock size={14} /> {ended ? "Auction closed" : "Ends in"}
          </div>
          <div className="font-mono text-[17px] font-semibold tracking-wide">
            {endsAtDate ? timeLeft(endsAtDate) : "—"}
          </div>
        </div>

        <div className="p-5">
          <div className="text-[11.5px] font-semibold uppercase tracking-[.5px] text-sub">Current bid</div>
          <div className="mt-0.5 font-mono text-[32px] font-semibold tracking-tight text-ink">
            {formatCents(currentBidCents)}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {reservePriceCents != null && (
              <Chip tone={reserveMet ? "trust" : "live"}>{reserveMet ? "Reserve met" : "Reserve not met"}</Chip>
            )}
            <span className="text-xs text-sub">{bidCount} bids</span>
          </div>

          {success && (
            <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-[#CDE6DD] bg-trust-bg px-3 py-2 text-[12.5px] font-semibold text-trust">
              <Zap size={13} /> {success}
            </div>
          )}
          {error && (
            <div className="mt-3 rounded-lg border border-[#EAD2D2] bg-live-bg px-3 py-2 text-[12.5px] font-medium text-live">
              {error.message}
              {error.twoFactorRequired && (
                <>
                  {" "}
                  <Link href="/account/security" className="underline">
                    Enable two-factor authentication
                  </Link>
                  .
                </>
              )}
            </div>
          )}

          <div className="my-4.5 h-px bg-line-soft" />

          {!viewer.signedIn ? (
            <FrictionNote
              title="Sign in to bid"
              body="You'll need an account, ID verification, and proof of funds before your paddle lifts."
            >
              <Link href="/sign-in">
                <Button kind="primary" className="w-full">
                  Sign in
                </Button>
              </Link>
            </FrictionNote>
          ) : !viewer.ndaSigned ? (
            <FrictionNote
              title="Sign the NDA to bid"
              body="Bidding opens once you've signed the NDA above — that's what unlocks the full data room."
            />
          ) : !(viewer.kycVerified && viewer.proofOfFundsVerified) ? (
            <FrictionNote
              title="Verify to lift your paddle"
              body="Bidding requires ID verification (KYC) and proof of funds — this keeps trolls and fake bids out."
            >
              <Link href="/dashboard/buyer">
                <Button kind="primary" icon={ShieldAlert} className="w-full">
                  Complete buyer verification
                </Button>
              </Link>
            </FrictionNote>
          ) : ended ? (
            <div className="rounded-xl border border-dashed border-line bg-surface-alt p-4 text-center text-[13px] text-sub">
              This auction has closed.
            </div>
          ) : (
            <>
              <Button
                kind="danger"
                icon={Gavel}
                disabled={loading !== null}
                className="w-full"
                onClick={() => placeBid(Number(amount), "bid")}
              >
                {loading === "bid" ? "Placing…" : `Place bid · ${formatCents(Number(amount) || minimumNext)}`}
              </Button>

              <div className="mt-3">
                <div className="mb-1.5 text-[11.5px] font-semibold text-sub">Bid amount (cents)</div>
                <div className="flex gap-2">
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder={String(minimumNext)}
                    className="flex-1 rounded-[9px] border border-line px-3 py-2.5 font-mono text-sm outline-none focus:border-brand"
                  />
                </div>
                <label className="mt-2 flex items-center gap-2 text-[12px] text-sub">
                  <input
                    type="checkbox"
                    checked={isProxyMax}
                    onChange={(e) => setIsProxyMax(e.target.checked)}
                  />
                  Set as max proxy bid (auto-bids for you up to this ceiling)
                </label>
              </div>

              {buyNowPriceCents != null && (
                <div className="mt-3">
                  <Button
                    kind="gold"
                    icon={Zap}
                    disabled={loading !== null}
                    className="w-full"
                    onClick={() => placeBid(buyNowPriceCents, "buyNow")}
                  >
                    {loading === "buyNow" ? "Processing…" : `Buy It Now · ${formatCents(buyNowPriceCents)}`}
                  </Button>
                </div>
              )}
            </>
          )}

          <div className="mt-3 text-center text-[11px] leading-relaxed text-sub-light">
            Bid increment {formatCents(bidIncrementCents)} · Winning funds route straight to escrow
          </div>
        </div>
      </div>
    </div>
  );
}

function FrictionNote({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface-alt p-4">
      <div className="text-[13.5px] font-bold text-ink">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-sub">{body}</div>
      {children && <div className="mt-3.5">{children}</div>}
    </div>
  );
}
