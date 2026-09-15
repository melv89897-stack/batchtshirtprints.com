import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/security/auth";
import { db } from "@/lib/db";
import { Users, BadgeCheck, Scale, ShieldCheck, ArrowRight } from "lucide-react";

export default async function AdminHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "ADMIN") redirect("/");

  const [totalUsers, liveListings, openDisputes, dealsInEscrow] = await Promise.all([
    db.user.count(),
    db.listing.count({ where: { status: "LIVE" } }),
    db.dispute.count({ where: { status: { not: "RESOLVED" } } }),
    db.escrowDeal.count({ where: { status: { notIn: ["RELEASED", "REFUNDED"] } } }),
  ]);

  const stats = [
    { label: "Total users", value: totalUsers, icon: Users },
    { label: "Live listings", value: liveListings, icon: BadgeCheck },
    { label: "Open disputes", value: openDisputes, icon: Scale },
    { label: "Deals in escrow", value: dealsInEscrow, icon: ShieldCheck },
  ];

  return (
    <div className="mx-auto max-w-[1080px] px-[22px] py-12">
      <h1 className="mb-2 font-display text-2xl font-semibold text-ink">Admin</h1>
      <p className="mb-8 text-sm text-sub">Platform operations — dispute resolution and identity verification.</p>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card border border-line bg-surface p-5">
            <s.icon size={18} className="mb-3 text-sub-light" strokeWidth={2.2} />
            <div className="font-mono text-2xl font-semibold text-ink">{s.value}</div>
            <div className="mt-1 text-[12.5px] text-sub">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/admin/disputes"
          className="group flex items-center justify-between rounded-card border border-line bg-surface p-6 transition hover:border-ink"
        >
          <div>
            <div className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-ink">
              <Scale size={18} className="text-live" /> Disputes
            </div>
            <p className="text-[13px] text-sub">Review open cases and resolve them.</p>
          </div>
          <ArrowRight size={18} className="shrink-0 text-sub-light transition group-hover:translate-x-0.5 group-hover:text-ink" />
        </Link>
        <Link
          href="/admin/verifications"
          className="group flex items-center justify-between rounded-card border border-line bg-surface p-6 transition hover:border-ink"
        >
          <div>
            <div className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-ink">
              <BadgeCheck size={18} className="text-gold" /> Verifications
            </div>
            <p className="text-[13px] text-sub">Approve pending KYC and proof-of-funds requests.</p>
          </div>
          <ArrowRight size={18} className="shrink-0 text-sub-light transition group-hover:translate-x-0.5 group-hover:text-ink" />
        </Link>
      </div>
    </div>
  );
}
