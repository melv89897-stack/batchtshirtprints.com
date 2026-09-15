import { BadgeCheck } from "lucide-react";

/** The hallmark seal — struck on every verified listing, like a hallmark stamped on assayed gold. */
export function Seal({ size = 44 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full text-[#FBF6EA] shrink-0"
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 32% 28%, #C9A961, #9C7A3C 62%, #7C5E2A)",
        border: `${Math.max(2, size * 0.045)}px solid #EFE2C4`,
        boxShadow: "inset 0 1px 2px rgba(255,255,255,.4), 0 2px 6px rgba(0,0,0,.22)",
      }}
    >
      <BadgeCheck size={size * 0.5} strokeWidth={2.2} />
    </div>
  );
}

export function Wordmark({ dark = false, size = "text-[26px]" }: { dark?: boolean; size?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-gold to-[#7C5E2A]">
        <BadgeCheck size={18} color="#FBF6EA" strokeWidth={2.4} />
      </div>
      <span className={`font-display font-semibold tracking-wide ${size} ${dark ? "text-white" : "text-ink"}`}>
        Assay
      </span>
    </div>
  );
}
