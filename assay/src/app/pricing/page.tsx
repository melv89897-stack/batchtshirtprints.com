import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Crown,
  Eye,
  Gavel,
  LineChart,
} from "lucide-react";
import { getCurrentUser } from "@/lib/security/auth";
import { Chip } from "@/components/ui/Chip";
import { wrap } from "@/components/ui/Section";
import type { MembershipTier } from "@prisma/client";

type TierKind = "ghost" | "primary" | "gold";

type Tier = {
  id: MembershipTier;
  name: string;
  price: string;
  cadence: string;
  icon: LucideIcon;
  highlight: boolean;
  tagline: string;
  features: string[];
  cta: string;
  href: string;
  kind: TierKind;
};

const TIERS: Tier[] = [
  {
    id: "FREE",
    name: "Free",
    price: "$0",
    cadence: "always free",
    icon: Eye,
    highlight: false,
    tagline: "Look around, stay in the loop.",
    features: ["Browse verified, sealed listings", "The Assay newsletter", "Basic market snapshot"],
    cta: "Start browsing",
    href: "/exchange",
    kind: "ghost",
  },
  {
    id: "PRO",
    name: "Pro",
    price: "$29.99",
    cadence: "per month",
    icon: LineChart,
    highlight: false,
    tagline: "All the data. Know the market cold.",
    features: [
      "Everything in Free",
      "The full Assay Index — multiples by category",
      "All graphs & tables — valuations, days-to-sale, demand heatmap",
      "Monthly movers & anonymized deal recaps",
      "Deal alerts — get pinged when a match lists",
      "“What's my app worth?” private valuation tracker",
      "Seller & buyer guides",
      "The book, free — “How to Sell Your SaaS or App”",
    ],
    cta: "Start 14-day free trial",
    href: "/sign-up",
    kind: "primary",
  },
  {
    id: "INSIDER",
    name: "Insider",
    price: "$59.99",
    cadence: "per month",
    icon: Crown,
    highlight: true,
    tagline: "See it first. Move before the crowd.",
    features: [
      "Everything in Pro",
      "Early access to the coming-soon pipeline",
      "First look at listings before they go public",
      "Priority verification — earn your hallmark faster",
      "Deeper due-diligence reports",
      "The monthly market briefing",
      "Priority support",
    ],
    cta: "Start 14-day free trial",
    href: "/sign-up",
    kind: "gold",
  },
];

const KIND_CLASSES: Record<TierKind, (highlight: boolean) => string> = {
  ghost: (highlight) =>
    `bg-transparent border ${highlight ? "border-white/30 text-white" : "border-line text-ink"}`,
  primary: () => "bg-ink border border-ink text-white",
  gold: () => "bg-gold border border-gold text-white",
};

const FEE_EXAMPLES: [string, string][] = [
  ["Sells for $100,000", "$10,000"],
  ["Sells for $500,000", "$50,000"],
  ["Sells for $1,000,000", "$100,000"],
];

const TIER_LABELS: Record<MembershipTier, string> = {
  FREE: "Free",
  PRO: "Pro",
  INSIDER: "Insider",
};

export default async function PricingPage() {
  const user = await getCurrentUser();

  return (
    <div>
      {/* header */}
      <div className="px-[22px] pb-5 pt-14 text-center">
        <div className="mb-3.5 flex justify-center gap-2">
          <div className="h-px w-5 self-center bg-gold" />
          <span className="text-[11.5px] font-bold uppercase tracking-[2px] text-gold">Pricing</span>
          <div className="h-px w-5 self-center bg-gold" />
        </div>
        <h1 className="mx-auto mb-3 max-w-[620px] font-display text-[32px] font-semibold tracking-tight sm:text-[38px]">
          Free to try. Fair to sell.
        </h1>
        <p className="mx-auto max-w-[560px] text-[15.5px] leading-relaxed text-sub">
          Get everything free for 14 days. Keep the data for less than a dinner out. And when you sell — one
          simple fee, no surprises.
        </p>
        {user && (
          <div className="mt-4 flex justify-center">
            <Chip tone="gold" icon={Crown}>
              Your current plan: {TIER_LABELS[user.membershipTier]}
            </Chip>
          </div>
        )}
      </div>

      {/* tiers */}
      <div className={`${wrap} pb-5`}>
        <div className="grid grid-cols-1 items-start gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.id}
              className={`relative overflow-hidden rounded-[20px] border p-[26px] ${
                t.highlight
                  ? "-translate-y-1.5 border-ink bg-ink text-white shadow-[0_20px_50px_rgba(20,50,75,.22)]"
                  : "border-line bg-surface text-ink"
              }`}
            >
              {t.highlight && (
                <>
                  <div className="pointer-events-none absolute -right-[30px] -top-[30px] h-[130px] w-[130px] rounded-full bg-[#9C7A3C]/[.2]" />
                  <div className="absolute right-[18px] top-[18px]">
                    <span className="rounded-full bg-gradient-to-br from-[#C9A961] to-gold px-[11px] py-1 text-[11px] font-bold tracking-[.3px] text-[#231a08]">
                      MOST POPULAR
                    </span>
                  </div>
                </>
              )}
              <div
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${
                  t.highlight ? "bg-white/10" : "border border-line bg-surface-alt"
                }`}
              >
                <t.icon size={21} strokeWidth={2.1} className={t.highlight ? "text-[#C9A961]" : "text-brand"} />
              </div>
              <div className="font-display text-[22px] font-semibold">{t.name}</div>
              <div className={`mb-4 mt-0.5 text-[13px] ${t.highlight ? "text-white/60" : "text-sub"}`}>
                {t.tagline}
              </div>
              <div className="mb-5 flex items-baseline gap-[7px]">
                <span className="font-mono text-[34px] font-semibold tracking-tight">{t.price}</span>
                <span className={`text-[13px] ${t.highlight ? "text-white/55" : "text-sub-light"}`}>
                  {t.cadence}
                </span>
              </div>
              <Link href={t.href}>
                <button
                  className={`mb-[22px] flex w-full items-center justify-center gap-2 rounded-[11px] px-4 py-3 text-sm font-semibold ${KIND_CLASSES[t.kind](
                    t.highlight,
                  )}`}
                >
                  {t.cta}
                  {t.kind !== "ghost" && <ArrowRight size={15} strokeWidth={2.3} />}
                </button>
              </Link>
              <div className="flex flex-col gap-[11px]">
                {t.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <span
                      className={`mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
                        t.highlight ? "bg-[#3FBF95]/20" : "bg-trust-bg"
                      }`}
                    >
                      <Check size={11} strokeWidth={3.2} className={t.highlight ? "text-[#3FBF95]" : "text-trust"} />
                    </span>
                    <span className={`text-[13px] leading-[1.45] ${t.highlight ? "text-white/[.86]" : "text-ink-soft"}`}>
                      {f}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-[18px] text-center text-[12.5px] text-sub-light">
          14-day free trial on Pro &amp; Insider · cancel anytime · no card charged until day 15
        </div>
      </div>

      {/* the deal fee */}
      <div className={`${wrap} py-11`}>
        <div className="relative overflow-hidden rounded-[20px] bg-brand px-[30px] py-[34px] text-white">
          <div className="pointer-events-none absolute -right-[50px] -top-[50px] h-[220px] w-[220px] rounded-full bg-[#9C7A3C]/[.14]" />
          <div className="relative grid grid-cols-1 items-center gap-6 lg:grid-cols-[1fr_1px_1fr]">
            <div>
              <Chip tone="dark" icon={Gavel}>
                When a sale closes
              </Chip>
              <div className="my-3.5 font-display text-[26px] font-semibold tracking-tight sm:text-[30px]">
                One flat fee: <span className="text-[#C9A961]">10%</span>
              </div>
              <p className="max-w-[420px] text-sm leading-relaxed text-white/[.72]">
                Free to list. You only ever pay when your company actually sells — 10% of the final price, taken
                automatically out of escrow at closing. No listing fees, no hidden add-ons, no surprises.
              </p>
            </div>
            <div className="hidden h-full w-px bg-white/10 lg:block" />
            <div className="rounded-[14px] bg-white/[.06] p-5">
              <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[1px] text-white/55">
                What that looks like
              </div>
              {FEE_EXAMPLES.map(([a, b]) => (
                <div
                  key={a}
                  className="flex items-center justify-between border-b border-white/[.08] py-[9px] last:border-b-0"
                >
                  <span className="text-[13.5px] text-white/80">{a}</span>
                  <span className="font-mono text-[15px] font-semibold text-[#C9A961]">{b} fee</span>
                </div>
              ))}
              <div className="mt-3 text-[11.5px] leading-relaxed text-white/50">
                Escrow &amp; payment processing are shared by buyer and seller — standard practice, and part of
                what protects the deal.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* the book */}
      <div className={`${wrap} pb-[60px]`}>
        <div className="flex flex-wrap items-center gap-[22px] rounded-[18px] border border-line bg-surface p-[26px]">
          <div className="flex h-[100px] w-[76px] shrink-0 flex-col items-center justify-center rounded-lg bg-gradient-to-br from-brand to-ink p-2 text-center text-[#C9A961] shadow-[0_8px_20px_rgba(20,50,75,.2)]">
            <BookOpen size={20} />
            <span className="mt-1.5 font-display text-[10px] font-semibold leading-[1.2] text-white">
              How to Sell Your SaaS or App
            </span>
          </div>
          <div className="min-w-[220px] flex-1">
            <Chip tone="trust" icon={BookOpen}>
              The playbook
            </Chip>
            <div className="my-2.5 font-display text-xl font-semibold">
              &ldquo;How to Sell Your SaaS or App&rdquo;
            </div>
            <p className="text-[13.5px] leading-relaxed text-sub">
              The complete guide to preparing, valuing, and selling your software business the right way.{" "}
              <strong className="text-ink">Free with Pro &amp; Insider</strong> — or grab it on its own.
            </p>
          </div>
          <Link href="/sign-up">
            <button className="inline-flex items-center gap-2 rounded-[11px] bg-ink px-[18px] py-3 text-sm font-semibold text-white">
              Get the book <ArrowRight size={15} strokeWidth={2.3} />
            </button>
          </Link>
        </div>
      </div>

      <div className="flex justify-center pb-14">
        <Chip tone="gold" icon={Clock}>
          14-day free trial · no card charged until day 15
        </Chip>
      </div>
    </div>
  );
}
