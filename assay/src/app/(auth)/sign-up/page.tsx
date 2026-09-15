"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Seal } from "@/components/ui/Seal";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName: displayName || undefined }),
    });
    const data = await res.json();
    setLoading(false);
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
      <h1 className="mb-2 text-center font-display text-2xl font-semibold text-ink">Create your account</h1>
      <p className="mb-8 text-center text-sm text-sub">
        14-day free trial, full access. Cancel anytime.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Display name (optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-[11px] border border-line px-4 py-3 text-sm outline-none focus:border-brand"
        />
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
          placeholder="Password (min. 10 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-[11px] border border-line px-4 py-3 text-sm outline-none focus:border-brand"
        />
        {error && <p className="text-sm text-live">{error}</p>}
        <Button kind="gold" icon={ArrowRight} large type="submit" disabled={loading} className="w-full">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-sub">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-ink">
          Sign in
        </Link>
      </p>
    </div>
  );
}
