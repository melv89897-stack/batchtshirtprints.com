import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "trust" | "live" | "gold" | "ink" | "neutral" | "dark";

const TONES: Record<Tone, string> = {
  trust: "bg-trust-bg text-trust border-[#CDE6DD]",
  live: "bg-live-bg text-live border-[#EAD2D2]",
  gold: "bg-gold-bg text-gold border-[#E8DABB]",
  ink: "bg-ink text-white border-ink",
  neutral: "bg-line-soft text-ink-soft border-line",
  dark: "bg-white/[.08] text-white border-white/[.16]",
};

export function Chip({
  children,
  tone = "neutral",
  icon: Icon,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-ui text-[12.5px] font-semibold ${TONES[tone]}`}
    >
      {Icon && <Icon size={13} strokeWidth={2.3} />}
      {children}
    </span>
  );
}
