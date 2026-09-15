"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  Undo2,
  Trash2,
  Download,
  ShieldCheck,
  Info,
  MousePointer2,
  Check,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { wrap } from "@/components/ui/Section";

type Rect = { x: number; y: number; w: number; h: number };
type DocType = "BANK_STATEMENT" | "PROFIT_LOSS" | "CONTRACT" | "OTHER";

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "BANK_STATEMENT", label: "Bank statement" },
  { value: "PROFIT_LOSS", label: "Profit & loss" },
  { value: "CONTRACT", label: "Contract" },
  { value: "OTHER", label: "Other" },
];

// Cap the internal canvas resolution so huge phone-camera photos stay fast
// to draw on and cheap to hash/upload — 1600px is plenty for a statement.
const MAX_DIM = 1600;

export default function RedactionStudioPage() {
  return (
    <Suspense fallback={<div className={`${wrap} py-16 text-sm text-sub`}>Loading…</div>}>
      <RedactionStudio />
    </Suspense>
  );
}

function RedactionStudio() {
  const searchParams = useSearchParams();
  const listingId = searchParams.get("listingId");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const [hasImage, setHasImage] = useState(false);
  const [dims, setDims] = useState({ w: 1000, h: 700 });
  const [rects, setRects] = useState<Rect[]>([]);
  const [draft, setDraft] = useState<Rect | null>(null);

  const [docType, setDocType] = useState<DocType>("BANK_STATEMENT");
  const [exportResult, setExportResult] = useState<{ dataUrl: string; sha256: string } | null>(null);
  const [uploadState, setUploadState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; documentId: string }
    | { status: "error"; message: string }
    | { status: "twofactor" }
  >({ status: "idle" });

  // Redraw the flattened base image + every committed redaction bar + the
  // in-progress drag box. This is the ONLY place pixels are written, so
  // "burn in" (canvas.toDataURL) always matches what's on screen.
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.fillStyle = "#0A0A0A";
    for (const r of rects) ctx.fillRect(r.x, r.y, r.w, r.h);
    if (draft) {
      ctx.fillStyle = "rgba(10,10,10,.55)";
      ctx.fillRect(draft.x, draft.y, draft.w, draft.h);
      ctx.strokeStyle = "#8A2B2B";
      ctx.lineWidth = 2;
      ctx.strokeRect(draft.x, draft.y, draft.w, draft.h);
    }
  }, [rects, draft]);

  useEffect(() => {
    render();
  }, [render]);

  function toCanvasPoint(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const box = canvas.getBoundingClientRect();
    const scaleX = canvas.width / box.width;
    const scaleY = canvas.height / box.height;
    return { x: (e.clientX - box.left) * scaleX, y: (e.clientY - box.top) * scaleY };
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    const p = toCanvasPoint(e);
    startRef.current = p;
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !startRef.current) return;
    const p = toCanvasPoint(e);
    const s = startRef.current;
    setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  }
  function commitDraft() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setDraft((d) => {
      if (d && d.w > 6 && d.h > 6) {
        setRects((rs) => [...rs, d]);
      }
      return null;
    });
    setExportResult(null);
    setUploadState({ status: "idle" });
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      imageRef.current = img;
      setDims({ w, h });
      setRects([]);
      setDraft(null);
      setHasImage(true);
      setExportResult(null);
      setUploadState({ status: "idle" });
    };
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  }

  function undo() {
    setRects((rs) => rs.slice(0, -1));
    setExportResult(null);
    setUploadState({ status: "idle" });
  }
  function clearAll() {
    setRects([]);
    setExportResult(null);
    setUploadState({ status: "idle" });
  }

  async function handleExport() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    render();
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1] ?? "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    setExportResult({ dataUrl, sha256 });
    setUploadState({ status: "idle" });
  }

  async function handleUpload() {
    if (!exportResult || !listingId) return;
    setUploadState({ status: "loading" });
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          type: docType,
          sha256: exportResult.sha256,
          dataUrl: exportResult.dataUrl,
        }),
      });
      const data = await res.json();
      if (res.status === 403 && data.code === "TWO_FACTOR_REQUIRED") {
        setUploadState({ status: "twofactor" });
        return;
      }
      if (!res.ok) {
        setUploadState({ status: "error", message: data.error ?? "Something went wrong." });
        return;
      }
      setUploadState({ status: "success", documentId: data.documentId });
    } catch {
      setUploadState({ status: "error", message: "Network error. Try again." });
    }
  }

  return (
    <div className={`${wrap} py-8`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-[26px] font-semibold tracking-tight text-ink">Redact, then prove.</h1>
        <Chip tone="gold" icon={Lock}>
          Seller-only tool
        </Chip>
      </div>
      <p className="mb-6 max-w-xl text-sm leading-relaxed text-sub">
        Drag across account numbers, routing, and personal info to lay down black bars. Your deposit history stays
        visible so buyers can verify revenue. Export burns the redaction permanently into the file.
      </p>

      {!listingId && (
        <div className="mb-6 flex items-start gap-3 rounded-card border border-[#E8DABB] bg-gold-bg p-4 text-sm text-ink-soft">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-gold" />
          <div>
            This tool needs a listing to attach the redacted document to. Open it from your{" "}
            <Link href="/dashboard/seller" className="font-semibold text-ink underline">
              seller dashboard
            </Link>
            , or{" "}
            <Link href="/sell/new" className="font-semibold text-ink underline">
              create a new listing
            </Link>{" "}
            first.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
        {/* canvas panel */}
        <div className="rounded-card border border-line bg-surface p-4">
          <div className="mb-3.5 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-[11px] border border-ink bg-ink px-4.5 py-2.5 text-sm font-semibold text-white hover:bg-ink-soft">
              <Upload size={15} strokeWidth={2.2} />
              Upload statement
              <input type="file" accept="image/*" onChange={onFileChange} className="hidden" />
            </label>
            <div className="flex-1" />
            <Button kind="ghost" icon={Undo2} onClick={undo} disabled={!rects.length}>
              Undo last redaction
            </Button>
            <Button kind="danger" icon={Trash2} onClick={clearAll} disabled={!rects.length}>
              Clear all
            </Button>
          </div>

          {hasImage ? (
            <div className="relative overflow-hidden rounded-[10px] border border-line bg-white">
              <canvas
                ref={canvasRef}
                width={dims.w}
                height={dims.h}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={commitDraft}
                onMouseLeave={commitDraft}
                className="block h-auto w-full cursor-crosshair"
              />
            </div>
          ) : (
            <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-line bg-surface-alt text-center text-sm text-sub">
              <Upload size={22} className="text-sub-light" />
              Upload a statement image to begin redacting.
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 text-xs text-sub">
            <MousePointer2 size={14} />
            Click and drag across any sensitive field to redact it. {rects.length} bar{rects.length === 1 ? "" : "s"}{" "}
            placed.
          </div>
        </div>

        {/* side panel */}
        <div className="flex flex-col gap-4">
          <div className="rounded-card border border-line bg-surface p-5">
            <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[1.2px] text-sub">Export</div>
            <p className="mb-3.5 text-xs leading-relaxed text-sub">
              Redaction is flattened into the pixels — there&rsquo;s no hidden layer for a buyer to peel back.
            </p>
            <Button
              kind="primary"
              icon={Download}
              onClick={handleExport}
              disabled={!hasImage || !rects.length}
              className="w-full"
            >
              Burn in &amp; export
            </Button>

            {exportResult && (
              <div className="mt-4 flex flex-col gap-3 border-t border-line-soft pt-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-trust">
                  <Check size={14} strokeWidth={3} /> Flattened &amp; hashed
                </div>
                <div className="break-all rounded-[8px] bg-surface-alt p-2 font-mono text-[10.5px] text-sub">
                  sha256:{exportResult.sha256}
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-ink">Document type</span>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as DocType)}
                    className="rounded-[9px] border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                  >
                    {DOC_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>

                <Button
                  kind="gold"
                  icon={ShieldCheck}
                  onClick={handleUpload}
                  disabled={!listingId || uploadState.status === "loading"}
                  className="w-full"
                >
                  {uploadState.status === "loading" ? "Uploading…" : "Save to listing"}
                </Button>

                {uploadState.status === "success" && (
                  <p className="text-xs font-semibold text-trust">Redacted document saved to the listing.</p>
                )}
                {uploadState.status === "error" && <p className="text-xs text-live">{uploadState.message}</p>}
                {uploadState.status === "twofactor" && (
                  <p className="text-xs text-live">
                    Uploading documents requires two-factor authentication.{" "}
                    <Link href="/account/security" className="font-semibold underline">
                      Enable it
                    </Link>{" "}
                    and try again.
                  </p>
                )}
                {!listingId && (
                  <p className="text-xs text-sub">Open this tool from a listing to enable saving.</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-card border border-line bg-surface p-5">
            <div className="mb-2.5 flex items-center gap-2">
              <ShieldCheck size={16} className="text-trust" />
              <span className="text-[13.5px] font-bold text-ink">How buyers trust it</span>
            </div>
            {[
              "Bars are burned in on export — permanent, not a movable overlay",
              "File is hashed on upload to detect tampering",
              "Visible deposits are reconciled against your Stripe payouts",
              "Only then does the listing earn the “Deposits matched” hallmark",
            ].map((t) => (
              <div key={t} className="flex items-start gap-2.5 py-1.5">
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-trust" />
                <span className="text-xs leading-relaxed text-ink-soft">{t}</span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2.5 rounded-card border border-[#E8DABB] bg-gold-bg p-4">
            <Info size={15} className="mt-0.5 shrink-0 text-gold" />
            <p className="text-xs leading-relaxed text-ink-soft">
              Redact account number, routing number, address, and tax ID. Leave dates, transaction counts, and
              deposit amounts visible — that&rsquo;s your proof of revenue.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
