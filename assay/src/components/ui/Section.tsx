import type { ReactNode } from "react";

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-center gap-2">
      <div className="h-px w-5 bg-gold" />
      <span className="font-ui text-[11.5px] font-bold uppercase tracking-[2px] text-gold">{children}</span>
      <div className="h-px w-5 bg-gold" />
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mx-auto mb-3 max-w-2xl text-center font-display text-[30px] font-semibold tracking-tight text-ink">
      {children}
    </h2>
  );
}

export function Sub({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto mb-10 max-w-xl text-center text-[15px] leading-relaxed text-sub">{children}</p>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4 rounded-card border border-line bg-surface p-6">
      <div className="mb-4 text-[11.5px] font-bold uppercase tracking-[1.2px] text-sub">{title}</div>
      {children}
    </div>
  );
}

export const wrap = "mx-auto max-w-[1080px] px-[22px]";
export const section = "py-[72px]";
