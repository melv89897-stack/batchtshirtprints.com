"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Seal } from "@/components/ui/Seal";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, totpCode: totpCode || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.status === 403 && data.code === "TWO_FACTOR_REQUIRED") {
      setNeedsTwoFactor(true);
      return;
    }
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.push("/dashboard/buyer");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-8 flex justify-center">
        <Seal size={48} />
      </div>
      <h1 className="mb-8 text-center font-display text-2xl font-semibold text-ink">Sign in to Assay</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-[11px] border border-line px-4 py-3 text-sm outline-none focus:border-brand"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-[11px] border border-line px-4 py-3 text-sm outline-none focus:border-brand"
        />
        {needsTwoFactor && (
          <input
            type="text"
            required
            placeholder="6-digit authenticator code"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            className="rounded-[11px] border border-line px-4 py-3 text-sm outline-none focus:border-brand"
          />
        )}
        {error && <p className="text-sm text-live">{error}</p>}
        <Button kind="gold" icon={ArrowRight} large type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-sub">
        No account yet?{" "}
        <Link href="/sign-up" className="font-semibold text-ink">
          Start your free trial
        </Link>
      </p>
    </div>
  );
}
