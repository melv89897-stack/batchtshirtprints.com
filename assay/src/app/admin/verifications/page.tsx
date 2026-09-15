import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/security/auth";
import { db } from "@/lib/db";
import { Chip } from "@/components/ui/Chip";
import { ArrowLeft, ShieldCheck, Clock } from "lucide-react";
import { ApproveButtons } from "./ApproveButtons";

export default async function AdminVerificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "ADMIN") redirect("/");

  const pendingUsers = await db.user.findMany({
    where: { OR: [{ kycStatus: "PENDING" }, { proofOfFundsStatus: "PENDING" }] },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-[1080px] px-[22px] py-12">
      <Link href="/admin" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-sub hover:text-ink">
        <ArrowLeft size={14} /> Admin
      </Link>
      <h1 className="mb-2 font-display text-2xl font-semibold text-ink">Verifications</h1>
      <p className="mb-8 text-sm text-sub">
        Pending identity (KYC) and proof-of-funds requests. Only relevant when <code>KYC_MODE=manual</code> — the
        default stub mode auto-verifies, so this is usually empty.
      </p>

      {pendingUsers.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-11 text-center">
          <ShieldCheck className="mx-auto mb-3 text-sub-light" size={26} />
          <div className="font-display text-lg font-semibold text-ink">Nothing pending</div>
          <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-sub">
            No user currently has a KYC or proof-of-funds request awaiting approval.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pendingUsers.map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface p-5"
            >
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="font-display text-[15px] font-semibold text-ink">
                    {u.displayName ?? u.email}
                  </span>
                  <span className="text-[12.5px] text-sub-light">{u.email}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {u.kycStatus === "PENDING" && (
                    <Chip tone="gold" icon={Clock}>
                      KYC pending
                    </Chip>
                  )}
                  {u.proofOfFundsStatus === "PENDING" && (
                    <Chip tone="gold" icon={Clock}>
                      Proof of funds pending
                    </Chip>
                  )}
                </div>
              </div>
              <ApproveButtons
                userId={u.id}
                kycPending={u.kycStatus === "PENDING"}
                proofOfFundsPending={u.proofOfFundsStatus === "PENDING"}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
