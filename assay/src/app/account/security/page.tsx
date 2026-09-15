import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/security/auth";
import { Chip } from "@/components/ui/Chip";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { TwoFactorPanel } from "./TwoFactorPanel";

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="mx-auto max-w-xl px-[22px] py-16">
      <h1 className="mb-2 font-display text-2xl font-semibold text-ink">Account security</h1>
      <p className="mb-8 text-sm text-sub">
        Two-factor authentication is required before you can bid, list a company, or move any money.
      </p>

      <div className="mb-6 flex items-center gap-2">
        {user.twoFactorEnabled ? (
          <Chip tone="trust" icon={ShieldCheck}>
            Two-factor enabled
          </Chip>
        ) : (
          <Chip tone="live" icon={ShieldAlert}>
            Two-factor not enabled
          </Chip>
        )}
      </div>

      <TwoFactorPanel initiallyEnabled={user.twoFactorEnabled} />
    </div>
  );
}
