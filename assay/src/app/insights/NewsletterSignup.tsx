"use client";

import { useState } from "react";
import { ArrowRight, BadgeCheck, Mail } from "lucide-react";

/**
 * Cosmetic-only signup form — there is no newsletter backend/API in this
 * build, so this simply gives optimistic client-side feedback rather than
 * pretending to persist anything.
 */
export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-[20px] bg-ink px-8 py-8 text-center text-white">
      <div className="pointer-events-none absolute left-1/2 -top-[50px] h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-[#9C7A3C]/[.12]" />
      <div className="relative">
        <div className="mb-3.5 flex justify-center">
          <div className="flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-white/10">
            <Mail size={22} className="text-[#C9A961]" />
          </div>
        </div>
        <h2 className="mb-2 font-display text-2xl font-semibold">Get the Index every month.</h2>
        <p className="mx-auto mb-[22px] max-w-[420px] text-sm leading-relaxed text-white/70">
          The numbers, the movers, and the deals — the report founders and buyers read before they make a move.
          Free.
        </p>
        {subscribed ? (
          <div className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#3FBF95]">
            <BadgeCheck size={18} /> You&apos;re on the list — first issue lands next month.
          </div>
        ) : (
          <form
            className="mx-auto flex max-w-[440px] flex-wrap justify-center gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.includes("@")) setSubscribed(true);
            }}
          >
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              type="email"
              className="min-w-[200px] flex-1 rounded-[11px] border border-white/20 bg-white/[.08] px-4 py-3 text-sm text-white outline-none placeholder:text-white/40"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-[7px] rounded-[11px] bg-gold px-5 py-3 text-sm font-semibold text-white"
            >
              Subscribe <ArrowRight size={15} strokeWidth={2.3} />
            </button>
          </form>
        )}
        <div className="mt-3.5 text-[11.5px] text-white/45">Free forever · unsubscribe anytime · no spam</div>
      </div>
    </div>
  );
}
