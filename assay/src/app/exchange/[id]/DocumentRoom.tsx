"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, ShieldCheck } from "lucide-react";

type Doc = {
  id: string;
  type: "BANK_STATEMENT" | "PROFIT_LOSS" | "CONTRACT" | "OTHER";
  createdAt: string;
};

const TYPE_LABEL: Record<Doc["type"], string> = {
  BANK_STATEMENT: "Redacted bank statement",
  PROFIT_LOSS: "Profit & loss statement",
  CONTRACT: "Contract",
  OTHER: "Document",
};

export function DocumentRoom({ documents }: { documents: Doc[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface-alt p-5 text-center text-sm text-sub">
        The seller hasn&apos;t uploaded any documents to this data room yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {documents.map((doc) => {
        const open = openId === doc.id;
        return (
          <div key={doc.id} className="overflow-hidden rounded-xl border border-line">
            <button
              onClick={() => setOpenId(open ? null : doc.id)}
              className="flex w-full items-center gap-3 bg-surface-alt px-4 py-3 text-left"
            >
              <FileText size={17} className="shrink-0 text-sub" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-ink">{TYPE_LABEL[doc.type]}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-sub-light">
                  <ShieldCheck size={11} className="text-trust" />
                  Redacted · uploaded {new Date(doc.createdAt).toLocaleDateString()}
                </div>
              </div>
              {open ? <ChevronUp size={16} className="text-sub" /> : <ChevronDown size={16} className="text-sub" />}
            </button>
            {open && (
              <div className="border-t border-line bg-ink/[.02] p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/documents/${doc.id}`}
                  alt={TYPE_LABEL[doc.type]}
                  className="mx-auto max-h-[520px] w-full rounded-lg border border-line object-contain"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
