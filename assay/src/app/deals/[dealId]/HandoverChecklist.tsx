"use client";

import { useState } from "react";
import { Check, CreditCard, FileText, GitBranch, Globe, Server } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Section";

type Item = {
  id: string;
  label: string;
  description: string | null;
  done: boolean;
};

function iconFor(label: string) {
  const l = label.toLowerCase();
  if (l.includes("github") || l.includes("repo")) return GitBranch;
  if (l.includes("host") || l.includes("infra") || l.includes("aws") || l.includes("vercel")) return Server;
  if (l.includes("domain")) return Globe;
  if (l.includes("stripe") || l.includes("billing")) return CreditCard;
  return FileText;
}

export function HandoverChecklist({
  dealId,
  items,
  canToggle,
}: {
  dealId: string;
  items: Item[];
  /** Only the seller (or an admin) may confirm a handover item, per the API's own rule. */
  canToggle: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState(items);

  async function toggle(itemId: string, done: boolean) {
    setBusyId(itemId);
    setError(null);
    try {
      const res = await fetch(`/api/escrow/${dealId}/handover-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, done }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not update that item.");
        return;
      }
      setLocalItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, done } : it)));
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const doneCount = localItems.filter((i) => i.done).length;

  return (
    <Panel title="Handover checklist">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[12.5px] text-sub">
          {canToggle
            ? "Confirm each asset transfer as you complete it."
            : "The seller confirms each asset transfer. Funds release only once every item is done and inspection closes."}
        </p>
        <span className="shrink-0 font-mono text-[13px] font-semibold text-brand">
          {doneCount}/{localItems.length}
        </span>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-[#EAD2D2] bg-live-bg px-3 py-2 text-[12.5px] font-medium text-live">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        {localItems.map((it) => {
          const Icon = iconFor(it.label);
          const busy = busyId === it.id;
          const content = (
            <>
              <div
                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 ${
                  it.done ? "border-trust bg-trust" : "border-line bg-white"
                }`}
              >
                {it.done && <Check size={13} color="#fff" strokeWidth={3.5} />}
              </div>
              <Icon size={18} className={it.done ? "text-trust" : "text-sub"} strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-ink">{it.label}</div>
                {it.description && <div className="text-xs text-sub">{it.description}</div>}
              </div>
              <Chip tone={it.done ? "trust" : "neutral"}>{it.done ? "Confirmed" : "Pending"}</Chip>
            </>
          );

          const rowClasses = `flex items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left ${
            it.done ? "border-[#CDE6DD] bg-trust-bg" : "border-line bg-surface-alt"
          }`;

          return canToggle ? (
            <button
              key={it.id}
              disabled={busy}
              onClick={() => toggle(it.id, !it.done)}
              className={`${rowClasses} disabled:opacity-60`}
            >
              {content}
            </button>
          ) : (
            <div key={it.id} className={rowClasses}>
              {content}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
