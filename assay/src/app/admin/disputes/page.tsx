import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/security/auth";
import { db } from "@/lib/db";
import { Chip } from "@/components/ui/Chip";
import { formatCents } from "@/lib/format";
import { AlertTriangle, Scale, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

export default async function AdminDisputesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "ADMIN") redirect("/");

  const disputes = await db.dispute.findMany({
    where: { status: { not: "RESOLVED" } },
    include: { deal: { include: { listing: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-[1080px] px-[22px] py-12">
      <Link href="/admin" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-sub hover:text-ink">
        <ArrowLeft size={14} /> Admin
      </Link>
      <h1 className="mb-2 font-display text-2xl font-semibold text-ink">Open disputes</h1>
      <p className="mb-8 text-sm text-sub">
        {disputes.length} case{disputes.length === 1 ? "" : "s"} awaiting resolution.
      </p>

      {disputes.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface p-11 text-center">
          <ShieldCheck className="mx-auto mb-3 text-sub-light" size={26} />
          <div className="font-display text-lg font-semibold text-ink">No open disputes</div>
          <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-sub">
            Every case has been resolved. New disputes raised by buyers will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {disputes.map((d) => (
            <Link
              key={d.id}
              href={`/deals/${d.dealId}/dispute`}
              className="group flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-5 transition hover:border-ink"
            >
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-display text-[15px] font-semibold text-ink">{d.deal.listing.codename}</span>
                  <Chip tone={d.status === "OPEN" ? "live" : "gold"} icon={d.status === "OPEN" ? AlertTriangle : Scale}>
                    {d.status === "OPEN" ? "Awaiting seller" : "Awaiting decision"}
                  </Chip>
                </div>
                <p className="max-w-xl truncate text-[13px] text-sub">{d.reason}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm text-ink-soft">{formatCents(d.deal.amountCents)}</span>
                <ArrowRight size={17} className="shrink-0 text-sub-light transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
