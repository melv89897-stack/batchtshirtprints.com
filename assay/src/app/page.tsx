import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  Clock,
  CreditCard,
  Fingerprint,
  FileSearch,
  Gavel,
  GitBranch,
  Landmark,
  Layers,
  Lock,
  MessageSquareLock,
  Repeat,
  Scale,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { Seal } from "@/components/ui/Seal";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Kicker, H2, Sub, wrap, section } from "@/components/ui/Section";

const OTHERS = [
  "Sellers upload screenshots that can be edited",
  "Weak buyer checks — fake bidders slip through",
  "Bad actors face little penalty for hiding info",
  "Assets half-delivered, transfers dragged out",
  "Disputes end the moment funds are released",
];

const ASSAY = [
  "Revenue pulled live from Stripe — impossible to fake",
  "Assay reconciles it against real bank deposits",
  "Both buyers and sellers pass identity (KYC)",
  "Bad behavior follows you — reputation is earned",
  "Escrow releases in stages; disputes stay open through handover",
];

const STEPS = [
  {
    n: "01",
    icon: Lock,
    t: "Browse sealed",
    d: "Public listings show a codename, category, and Assay's verified badges — never the name, domain, or raw numbers.",
  },
  {
    n: "02",
    icon: Fingerprint,
    t: "Verify (KYC)",
    d: "Prove you're a real person through our identity partner. This keeps trolls, bots, and fake bidders out entirely.",
  },
  {
    n: "03",
    icon: ScrollText,
    t: "Sign the NDA",
    d: "One click unlocks the company's identity and the private, verified data room — and legally binds you not to misuse it.",
  },
  {
    n: "04",
    icon: Gavel,
    t: "Bid & close",
    d: "Place real bids backed by a refundable card hold. Win, and funds move into protected escrow.",
  },
];

const VERIFY = [
  {
    icon: CreditCard,
    t: "Live revenue",
    d: "Connected straight from Stripe or Paddle. Real-time MRR, customers, and payments — no uploaded screenshots.",
  },
  {
    icon: TrendingUp,
    t: "Cohort & churn",
    d: "Not just how much revenue, but how sticky. We show whether it's growing or quietly leaking.",
  },
  {
    icon: Users,
    t: "Customer concentration",
    d: "We flag it if one client is a large share of revenue — the hidden risk buyers deserve to see.",
  },
  {
    icon: FileSearch,
    t: "Traffic & ad-spend",
    d: "Is growth organic or bought? Connected analytics reveal the real story behind the numbers.",
  },
  {
    icon: GitBranch,
    t: "Code & security scan",
    d: "An automated health check of the codebase, so buyers aren't inheriting hidden debt or vulnerabilities.",
  },
  {
    icon: Scale,
    t: "Legal & IP ownership",
    d: "Confirms the seller actually owns the code, domain, and trademarks — free and clear to transfer.",
  },
];

const BUILT_FOR: [typeof Boxes, string][] = [
  [Boxes, "SaaS products"],
  [Layers, "Shopify apps"],
  [Repeat, "Subscription apps"],
  [MessageSquareLock, "Paid newsletters"],
  [GitBranch, "API & dev tools"],
  [Sparkles, "AI tools"],
];

const PROTECTED = [
  {
    icon: Landmark,
    t: "Milestone escrow",
    d: "Funds release in stages — part at handover, part after transition — so a buyer is never fully exposed at once.",
  },
  {
    icon: CheckCircle2,
    t: "Automated handover",
    d: "A guided checklist for GitHub, hosting, domain, and Stripe. Assets can't be half-delivered or quietly withheld.",
  },
  {
    icon: Clock,
    t: "7-day inspection",
    d: "After transfer, the buyer inspects before funds release. Disputes stay open through this window — not slammed shut at payment.",
  },
  {
    icon: Repeat,
    t: "Post-sale transition",
    d: "A structured 30-day handoff: the seller's playbook, customer intros, and founder calls so the business actually keeps running.",
  },
  {
    icon: Star,
    t: "Reputation that compounds",
    d: "Verified track records for both sides, earned from real completed deals. Good behavior earns trust, perks, and better deals next time.",
  },
  {
    icon: MessageSquareLock,
    t: "Private data-room Q&A",
    d: "Buyers ask the seller questions confidentially before bidding — logged, on the record, never public.",
  },
];

export default function LandingPage() {
  return (
    <div>
      {/* HERO */}
      <div className="relative overflow-hidden bg-brand text-white">
        <div className="pointer-events-none absolute -right-20 -top-20 h-[340px] w-[340px] rounded-full bg-[#9C7A3C]/[.14]" />
        <div className="pointer-events-none absolute -left-16 -bottom-24 h-[260px] w-[260px] rounded-full bg-white/[.03]" />
        <div className={`${wrap} relative py-[84px] text-center sm:py-[92px]`}>
          <div className="mb-[22px] flex justify-center">
            <Seal size={54} />
          </div>
          <div className="mb-[18px] flex justify-center">
            <span className="font-ui text-[12px] font-bold uppercase tracking-[2px] text-[#C9A961]">
              The verified exchange for SaaS &amp; subscription apps
            </span>
          </div>
          <h1 className="mx-auto mb-5 max-w-[760px] font-display text-[32px] font-semibold leading-[1.1] tracking-tight sm:text-[46px]">
            You&apos;re not trusting the seller.
            <br />
            You&apos;re trusting the verification.
          </h1>
          <p className="mx-auto mb-8 max-w-[600px] text-[17px] leading-relaxed text-white/[.74]">
            Every other marketplace is an upload box — sellers post screenshots, buyers hope they&apos;re real.
            Assay independently verifies the numbers against the source, so proof replaces guesswork.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/exchange">
              <Button kind="gold" icon={ArrowRight} large>
                Browse verified companies
              </Button>
            </Link>
            <Link href="/sell/new">
              <Button kind="light" large>
                List your company
              </Button>
            </Link>
          </div>
          <div className="mt-[30px] flex flex-wrap justify-center gap-2.5">
            <Chip tone="dark" icon={Fingerprint}>
              Both sides KYC-verified
            </Chip>
            <Chip tone="dark" icon={Landmark}>
              Escrow-protected
            </Chip>
            <Chip tone="dark" icon={ShieldCheck}>
              Metrics reconciled by Assay
            </Chip>
          </div>
        </div>
      </div>

      {/* THE DIFFERENCE */}
      <div className={section}>
        <div className={wrap}>
          <Kicker>The Assay difference</Kicker>
          <H2>Proof, not screenshots.</H2>
          <Sub>
            Half of buyers spend under an hour checking a seller&apos;s claims — because on other platforms,
            checking is entirely their problem. Assay does the verification, and stakes its hallmark on it.
          </Sub>

          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
            <div className="rounded-[18px] border border-line bg-surface p-[26px]">
              <div className="mb-4 font-ui text-[13px] font-bold uppercase tracking-[.5px] text-sub">
                Other marketplaces
              </div>
              {OTHERS.map((t) => (
                <div key={t} className="flex items-start gap-[11px] py-[9px]">
                  <XCircle size={18} className="mt-[1px] shrink-0 text-live" />
                  <span className="text-[14px] leading-[1.45] text-ink-soft">{t}</span>
                </div>
              ))}
            </div>
            <div className="relative overflow-hidden rounded-[18px] bg-ink p-[26px] text-white">
              <div className="pointer-events-none absolute -right-[30px] -top-[30px] h-[140px] w-[140px] rounded-full bg-trust/[.18]" />
              <div className="relative mb-4 flex items-center gap-2">
                <span className="font-ui text-[13px] font-bold uppercase tracking-[.5px] text-[#C9A961]">
                  Assay
                </span>
                <BadgeCheck size={15} className="text-[#C9A961]" />
              </div>
              {ASSAY.map((t) => (
                <div key={t} className="relative flex items-start gap-[11px] py-[9px]">
                  <CheckCircle2 size={18} className="mt-[1px] shrink-0 text-[#3FBF95]" />
                  <span className="text-[14px] leading-[1.45] text-white/[.86]">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className={`${section} border-y border-line bg-surface`}>
        <div className={wrap}>
          <Kicker>How it works</Kicker>
          <H2>Sealed to the public. Open to the qualified.</H2>
          <Sub>
            Sensitive proof is never broadcast. It unlocks step by step, only for real, identified, legally-bound
            buyers.
          </Sub>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-line bg-surface-alt p-[22px]">
                <div className="mb-3.5 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-brand">
                    <s.icon size={19} strokeWidth={2.1} className="text-[#C9A961]" />
                  </div>
                  <span className="font-mono text-[13px] font-semibold text-sub-light">{s.n}</span>
                </div>
                <div className="mb-1.5 font-display text-[18px] font-semibold">{s.t}</div>
                <p className="text-[13px] leading-[1.5] text-sub">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WHAT WE VERIFY */}
      <div className={section}>
        <div className={wrap}>
          <Kicker>What we verify</Kicker>
          <H2>Six proofs behind every hallmark.</H2>
          <Sub>
            All proof, no opinion. We verify the business is real — we never set or suggest a price. The seller
            names their price; the market decides its worth.
          </Sub>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {VERIFY.map((v) => (
              <div key={v.t} className="rounded-2xl border border-line bg-surface p-5">
                <div className="mb-2.5 flex items-center gap-[11px]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#CDE6DD] bg-trust-bg">
                    <v.icon size={17} strokeWidth={2.2} className="text-trust" />
                  </div>
                  <span className="font-display text-[16.5px] font-semibold">{v.t}</span>
                </div>
                <p className="text-[13px] leading-[1.5] text-sub">{v.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-[18px] flex items-start gap-3 rounded-[14px] border border-[#E8DABB] bg-gold-bg px-5 py-4">
            <ShieldAlert size={18} className="mt-[1px] shrink-0 text-gold" />
            <p className="text-[13.5px] leading-[1.55] text-ink-soft">
              <strong>Optional deposit proof.</strong> Sellers who want maximum buyer confidence can add a redacted
              deposit record — account numbers and personal details blacked out, deposits reconciled to Stripe by
              Assay. We never collect tax returns or full statements. The less sensitive data we hold, the safer
              everyone is.
            </p>
          </div>
        </div>
      </div>

      {/* BUILT FOR */}
      <div className={`${section} border-y border-line bg-surface`}>
        <div className={wrap}>
          <Kicker>Built for</Kicker>
          <H2>Recurring-revenue software businesses.</H2>
          <Sub>
            If it runs on connectable, recurring revenue, Assay can verify it — and welcomes the modern assets the
            old brokers reject.
          </Sub>
          <div className="flex flex-wrap justify-center gap-2.5">
            {BUILT_FOR.map(([Icon, t]) => (
              <span
                key={t}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-alt px-4 py-2.5 text-sm font-semibold"
              >
                <Icon size={15} strokeWidth={2.2} className="text-brand" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* PROTECTED END TO END */}
      <div className={section}>
        <div className={wrap}>
          <Kicker>Protected end to end</Kicker>
          <H2>The deal is safe long after the gavel falls.</H2>
          <Sub>
            Most acquisitions struggle after the sale, not during it. Assay protects the whole journey — because a
            deal that closes badly helps no one.
          </Sub>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROTECTED.map((v) => (
              <div key={v.t} className="rounded-2xl border border-line bg-surface p-[22px]">
                <div className="mb-2.5 flex items-center gap-[11px]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand">
                    <v.icon size={17} strokeWidth={2.2} className="text-[#C9A961]" />
                  </div>
                  <span className="font-display text-[16.5px] font-semibold">{v.t}</span>
                </div>
                <p className="text-[13px] leading-[1.5] text-sub">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FINAL CTA */}
      <div className="relative overflow-hidden bg-brand text-center text-white">
        <div className="pointer-events-none absolute left-1/2 -top-[60px] h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-[#9C7A3C]/[.12]" />
        <div className={`${wrap} ${section} relative`}>
          <div className="mb-5 flex justify-center">
            <Seal size={50} />
          </div>
          <h2 className="mx-auto mb-3.5 max-w-xl font-display text-[28px] font-semibold tracking-tight sm:text-[34px]">
            Sell where the proof speaks for you.
          </h2>
          <p className="mx-auto mb-[30px] max-w-[540px] text-base leading-relaxed text-white/[.72]">
            Connect your metrics, earn the hallmark, and let verified buyers compete — on a platform built so both
            sides can trust the deal.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/sell/new">
              <Button kind="gold" icon={ArrowRight} large>
                List your company
              </Button>
            </Link>
            <Link href="/exchange">
              <Button kind="light" large>
                Browse the exchange
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
