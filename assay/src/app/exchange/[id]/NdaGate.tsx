"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { readActionError, type ActionError } from "./twoFactor";

export function NdaGate({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);

  async function signNda() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/nda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      if (!res.ok) {
        setError(await readActionError(res));
        return;
      }
      router.refresh();
    } catch {
      setError({ message: "Network error — please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-[#E8DABB] bg-gold-bg p-4">
      <div className="flex items-start gap-3">
        <ScrollText size={18} className="mt-0.5 shrink-0 text-gold" />
        <div className="flex-1">
          <div className="text-[13.5px] font-bold text-ink">Name & domain are sealed</div>
          <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">
            Sign a one-click digital NDA to reveal the company identity, live URL, and full data room. Verified
            metrics below are already open.
          </div>
          <div className="mt-3">
            <Button kind="gold" icon={ScrollText} disabled={loading} onClick={signNda}>
              {loading ? "Signing…" : "Sign NDA & reveal identity"}
            </Button>
          </div>
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
        </div>
      </div>
    </div>
  );
}
