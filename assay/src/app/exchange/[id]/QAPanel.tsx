"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Message = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; displayName: string | null };
};

export function QAPanel({ listingId, viewerId }: { listingId: string; viewerId: string | null }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/messages?listingId=${encodeURIComponent(listingId)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not load the Q&A thread.");
        return;
      }
      setMessages(json.messages);
    } catch {
      setError("Network error loading messages.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, body: draft.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not send that message.");
        return;
      }
      setDraft("");
      await load();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5 text-sub">
        <MessageCircle size={14} />
        <span className="text-xs">Private to the seller, this buyer, and admins.</span>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-[#EAD2D2] bg-live-bg px-3 py-2 text-[12.5px] font-medium text-live">
          {error}
        </div>
      )}

      <div className="mb-4 flex max-h-80 flex-col gap-2.5 overflow-y-auto">
        {messages === null ? (
          <div className="text-sm text-sub">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-surface-alt p-4 text-center text-sm text-sub">
            No questions yet. Ask the seller anything before you bid.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender.id === viewerId;
            return (
              <div
                key={m.id}
                className={`rounded-xl border px-3.5 py-2.5 ${
                  mine ? "border-[#CDE6DD] bg-trust-bg" : "border-line bg-surface-alt"
                }`}
              >
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-ink">
                    {mine ? "You" : m.sender.displayName ?? "Member"}
                  </span>
                  <span className="text-[11px] text-sub-light">
                    {new Date(m.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="whitespace-pre-wrap text-[13.5px] text-ink-soft">{m.body}</div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask a question…"
          className="flex-1 rounded-[9px] border border-line px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
        <Button kind="primary" icon={Send} disabled={sending || !draft.trim()} onClick={send}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
