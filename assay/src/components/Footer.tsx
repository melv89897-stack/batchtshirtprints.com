import { BadgeCheck, ShieldCheck } from "lucide-react";
import { Chip } from "@/components/ui/Chip";

export function Footer() {
  return (
    <div className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-3.5 px-[22px] py-[30px]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-gold to-[#7C5E2A]">
            <BadgeCheck size={14} color="#FBF6EA" />
          </div>
          <span className="font-display text-[17px] font-semibold">Assay</span>
          <span className="ml-1.5 text-[12.5px] text-sub-light">
            The verified exchange for SaaS & subscription apps
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone="trust" icon={ShieldCheck}>
            Escrow-protected
          </Chip>
          <Chip tone="gold" icon={BadgeCheck}>
            Assay hallmark
          </Chip>
        </div>
      </div>
    </div>
  );
}
