import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withGuard } from "@/lib/security/guard";
import { requireUser } from "@/lib/security/auth";
import { signNdaSchema as toggleSchema } from "@/lib/security/validate"; // shape is identical: { listingId }

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ watchlist: [] });

  const items = await db.watchlistItem.findMany({
    where: { userId: user.id },
    include: { listing: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ watchlist: items });
}

/** Toggle a listing on/off the signed-in user's watchlist. */
export const POST = withGuard({ bodySchema: toggleSchema }, async ({ user, body }) => {
  const existing = await db.watchlistItem.findUnique({
    where: { userId_listingId: { userId: user.id, listingId: body.listingId } },
  });

  if (existing) {
    await db.watchlistItem.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, watching: false });
  }

  await db.watchlistItem.create({ data: { userId: user.id, listingId: body.listingId } });
  return NextResponse.json({ ok: true, watching: true });
});
