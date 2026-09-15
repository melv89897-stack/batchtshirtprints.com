"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleDollarSign, Gavel, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { readActionError, type ActionError } from "./twoFactor";

type Props = {
  listingId: string;
  // "DRAFT" | "PENDING_VERIFICATION" | "LIVE" | "IN_ESCROW" | "SOLD" | "WITHDRAWN"
  status: string;
  endsAt: string | null;
  hasBids: boolean;
  stripeVerified: boolean;
  analyticsVerified: boolean;
};

export function OwnerPanel({ listingId, status, endsAt, hasBids, stripeVerified, analyticsVerified }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"publish" | "verify" | "accept" | null>(null);
  const [error, setError] = useState<ActionError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const auctionEnded = endsAt ? new Date(endsAt).getTime() <= Date.now() : false;

  async function call(action: "publish" | "verify" | "accept") {
    setBusy(action);
    setError(null);
    setNotice(null);
    const path =
      action === "publish"
        ? `/api/listings/${listingId}/publish`
        : action === "verify"
          ? `/api/listings/${listingId}/verify-revenue`
          : `/api/listings/${listingId}/accept-bid`;
    try {
      const res = await fetch(path, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(await readActionError(res));
        return;
      }
      if (action === "accept" && json.deal?.id) {
        router.push(`/deals/${json.deal.id}`);
        return;
      }
      setNotice(
        action === "publish"
          ? "Listing published and now live."
          : "Revenue verification refreshed.",
      );
      router.refresh();
    } catch {
      setError({ message: "Network error — please try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="mb-1 text-[11.5px] font-bold uppercase tracking-[1.2px] text-sub">Seller controls</div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Chip tone={stripeVerified ? "trust" : "neutral"} icon={ShieldCheck}>
          {stripeVerified ? "Stripe verified" : "Stripe unverified"}
        </Chip>
        <Chip tone={analyticsVerified ? "trust" : "neutral"} icon={ShieldCheck}>
          {analyticsVerified ? "Analytics verified" : "Analytics unverified"}
        </Chip>
      </div>

      {notice && (
        <div className="mb-3 rounded-lg border border-[#CDE6DD] bg-trust-bg px-3 py-2 text-[12.5px] font-semibold text-trust">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg border border-[#EAD2D2] bg-live-bg px-3 py-2 text-[12.5px] font-medium text-live">
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

      <div className="flex flex-col gap-2.5">
        {status === "DRAFT" && (
          <Button kind="primary" icon={Gavel} disabled={busy !== null} onClick={() => call("publish")}>
            {busy === "publish" ? "Publishing…" : "Publish listing"}
          </Button>
        )}

        <Button kind="ghost" icon={ShieldCheck} disabled={busy !== null} onClick={() => call("verify")}>
          {busy === "verify" ? "Verifying…" : "Verify live revenue"}
        </Button>

        {status === "LIVE" && auctionEnded && hasBids && (
          <Button kind="gold" icon={CircleDollarSign} disabled={busy !== null} onClick={() => call("accept")}>
            {busy === "accept" ? "Accepting…" : "Accept winning bid"}
          </Button>
        )}

        {status === "LIVE" && !auctionEnded && (
          <div className="text-center text-[12px] text-sub-light">The auction is still running.</div>
        )}
        {status === "LIVE" && auctionEnded && !hasBids && (
          <div className="text-center text-[12px] text-sub-light">Auction ended with no bids.</div>
        )}
        {status === "IN_ESCROW" && (
          <div className="text-center text-[12px] text-sub-light">This deal has moved into escrow.</div>
        )}
        {status === "SOLD" && (
          <div className="text-center text-[12px] text-sub-light">This listing has sold.</div>
        )}
      </div>
    </div>
  );
}
