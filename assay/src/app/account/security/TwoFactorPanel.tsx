"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function TwoFactorPanel({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setQrCodeDataUrl(data.qrCodeDataUrl);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setEnabled(true);
    setQrCodeDataUrl(null);
    router.refresh();
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setEnabled(false);
    setPassword("");
    router.refresh();
  }

  if (enabled) {
    return (
      <form onSubmit={disable} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
        <p className="text-sm text-sub">Enter your password to turn two-factor authentication off.</p>
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-[11px] border border-line px-4 py-3 text-sm outline-none focus:border-brand"
        />
        {error && <p className="text-sm text-live">{error}</p>}
        <Button kind="danger" type="submit" disabled={loading}>
          {loading ? "Disabling…" : "Disable two-factor"}
        </Button>
      </form>
    );
  }

  if (!qrCodeDataUrl) {
    return (
      <div className="rounded-card border border-line bg-surface p-6">
        <p className="mb-4 text-sm text-sub">
          Set up an authenticator app (Google Authenticator, 1Password, Authy) to enable two-factor
          authentication.
        </p>
        {error && <p className="mb-4 text-sm text-live">{error}</p>}
        <Button kind="gold" onClick={startSetup} disabled={loading}>
          {loading ? "Generating…" : "Set up two-factor"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
      <p className="text-sm text-sub">Scan this QR code with your authenticator app, then enter the 6-digit code it shows.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrCodeDataUrl} alt="Two-factor QR code" className="mx-auto h-40 w-40" />
      <input
        type="text"
        required
        placeholder="6-digit code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="rounded-[11px] border border-line px-4 py-3 text-center font-mono text-lg tracking-widest outline-none focus:border-brand"
      />
      {error && <p className="text-sm text-live">{error}</p>}
      <Button kind="gold" type="submit" disabled={loading}>
        {loading ? "Verifying…" : "Enable two-factor"}
      </Button>
    </form>
  );
}
