import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Kind = "primary" | "gold" | "ghost" | "light" | "danger";

const KINDS: Record<Kind, string> = {
  primary: "bg-ink text-white border-ink hover:bg-ink-soft",
  gold: "bg-gold text-white border-gold hover:brightness-110",
  ghost: "bg-transparent text-ink border-line hover:bg-surface-alt",
  light: "bg-white text-ink border-white hover:bg-white/90",
  danger: "bg-live text-white border-live hover:brightness-110",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  kind?: Kind;
  icon?: LucideIcon;
  large?: boolean;
};

export function Button({ children, kind = "primary", icon: Icon, large, className = "", ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-[11px] border font-ui font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        large ? "px-6 py-3.5 text-[15px]" : "px-4.5 py-2.5 text-sm"
      } ${KINDS[kind]} ${className}`}
    >
      {children}
      {Icon && <Icon size={large ? 18 : 16} strokeWidth={2.2} />}
    </button>
  );
}
