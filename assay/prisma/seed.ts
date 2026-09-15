import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123!", 12);

  const admin = await db.user.upsert({
    where: { email: "admin@assay.demo" },
    update: {},
    create: {
      email: "admin@assay.demo",
      passwordHash: password,
      displayName: "Assay Reviewer",
      role: "ADMIN",
      kycStatus: "VERIFIED",
      proofOfFundsStatus: "VERIFIED",
      membershipTier: "INSIDER",
    },
  });

  const seller = await db.user.upsert({
    where: { email: "seller@assay.demo" },
    update: {},
    create: {
      email: "seller@assay.demo",
      passwordHash: password,
      displayName: "Priya (seller)",
      kycStatus: "VERIFIED",
      proofOfFundsStatus: "VERIFIED",
      membershipTier: "PRO",
      reputationScore: 42,
    },
  });

  const buyer = await db.user.upsert({
    where: { email: "buyer@assay.demo" },
    update: {},
    create: {
      email: "buyer@assay.demo",
      passwordHash: password,
      displayName: "Marcus (buyer)",
      kycStatus: "VERIFIED",
      proofOfFundsStatus: "VERIFIED",
      membershipTier: "INSIDER",
      reputationScore: 18,
    },
  });

  const buyerTwo = await db.user.upsert({
    where: { email: "buyer2@assay.demo" },
    update: {},
    create: {
      email: "buyer2@assay.demo",
      passwordHash: password,
      displayName: "Elena (buyer)",
      kycStatus: "VERIFIED",
      proofOfFundsStatus: "VERIFIED",
      membershipTier: "PRO",
    },
  });

  const listingsData = [
    {
      codename: "Project Halcyon",
      realName: "Halcyon Analytics",
      domain: "halcyonanalytics.io",
      category: "SaaS",
      summary: "B2B analytics dashboard for e-commerce ops teams. 3 years of history, low churn.",
      mrrCents: 4_100_000,
      growthMoM: 0.041,
      grossMargin: 0.88,
      netChurn: -0.012,
      arrMultiple: 4.4,
      reservePriceCents: 180_000_000,
      currentBidCents: 172_000_000,
      bidIncrementCents: 2_500_000,
      status: "LIVE" as const,
      stripeVerified: true,
      analyticsVerified: true,
      statementRedacted: true,
      depositsMatched: true,
      hoursFromNow: 46,
    },
    {
      codename: "Project Northwind",
      realName: "Northwind Themes",
      domain: "northwindthemes.com",
      category: "Shopify App",
      summary: "Shopify theme customization app, 2,200 paying merchants.",
      mrrCents: 2_600_000,
      growthMoM: 0.018,
      grossMargin: 0.91,
      netChurn: -0.02,
      arrMultiple: 3.8,
      reservePriceCents: 90_000_000,
      currentBidCents: 0,
      bidIncrementCents: 1_000_000,
      status: "LIVE" as const,
      stripeVerified: true,
      analyticsVerified: true,
      statementRedacted: false,
      depositsMatched: false,
      hoursFromNow: 96,
    },
    {
      codename: "Project Ledger",
      realName: "Ledgerly",
      domain: "ledgerly.app",
      category: "API & dev tools",
      summary: "Invoicing API for indie devs. Steady growth, sticky usage-based pricing.",
      mrrCents: 980_000,
      growthMoM: 0.07,
      grossMargin: 0.82,
      netChurn: -0.03,
      arrMultiple: 5.1,
      reservePriceCents: 45_000_000,
      currentBidCents: 0,
      bidIncrementCents: 500_000,
      status: "LIVE" as const,
      stripeVerified: true,
      analyticsVerified: false,
      statementRedacted: false,
      depositsMatched: false,
      hoursFromNow: 20,
    },
    {
      codename: "Project Meridian",
      realName: "Meridian Digest",
      domain: "meridiandigest.com",
      category: "Paid newsletter",
      summary: "Weekly climate-tech newsletter, 8,900 paying subscribers.",
      mrrCents: 610_000,
      growthMoM: 0.025,
      grossMargin: 0.95,
      netChurn: -0.015,
      arrMultiple: 3.2,
      reservePriceCents: 21_000_000,
      currentBidCents: 21_000_000,
      bidIncrementCents: 250_000,
      status: "SOLD" as const,
      stripeVerified: true,
      analyticsVerified: true,
      statementRedacted: true,
      depositsMatched: true,
      hoursFromNow: -240,
    },
  ];

  const listings = [];
  for (const l of listingsData) {
    const { hoursFromNow, ...data } = l;
    const listing = await db.listing.create({
      data: {
        sellerId: seller.id,
        startsAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + hoursFromNow * 60 * 60 * 1000),
        askType: "AUCTION",
        ...data,
      },
    });
    listings.push(listing);
  }

  const [halcyon, northwind, ledger, meridian] = listings;

  // NDA + bids on the live flagship listing
  await db.nda.createMany({
    data: [
      { listingId: halcyon.id, signerId: buyer.id },
      { listingId: halcyon.id, signerId: buyerTwo.id },
    ],
  });
  await db.bid.createMany({
    data: [
      { listingId: halcyon.id, bidderId: buyerTwo.id, amountCents: 165_000_000 },
      { listingId: halcyon.id, bidderId: buyer.id, amountCents: 172_000_000 },
    ],
  });
  await db.watchlistItem.createMany({
    data: [
      { userId: buyer.id, listingId: northwind.id },
      { userId: buyer.id, listingId: ledger.id },
    ],
  });
  await db.dealMessage.create({
    data: {
      listingId: halcyon.id,
      senderId: buyer.id,
      body: "What share of MRR comes from the top customer?",
    },
  });
  await db.dealMessage.create({
    data: {
      listingId: halcyon.id,
      senderId: seller.id,
      body: "Largest customer is 6% of MRR — full cohort breakdown is in the data room.",
    },
  });

  // A completed deal (Meridian) sitting in an active dispute, to demo the flow.
  const deal = await db.escrowDeal.create({
    data: {
      listingId: meridian.id,
      buyerId: buyer.id,
      sellerId: seller.id,
      amountCents: meridian.currentBidCents,
      platformFeeCents: Math.round(meridian.currentBidCents * 0.1),
      status: "DISPUTED",
      inspectionEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      handoverItems: {
        create: [
          { label: "GitHub repositories", done: true, confirmedAt: new Date() },
          { label: "Hosting / infra access", done: true, confirmedAt: new Date() },
          { label: "Domain transfer", done: true, confirmedAt: new Date() },
          { label: "Stripe / billing account", done: true, confirmedAt: new Date() },
          { label: "Credentials & secrets", done: true, confirmedAt: new Date() },
        ],
      },
    },
  });
  await db.dispute.create({
    data: {
      dealId: deal.id,
      raiserId: buyer.id,
      reason:
        "Subscriber list handed over has 1,100 fewer active subscribers than the verified figure on the listing.",
      status: "SELLER_RESPONDED",
      sellerResponse:
        "That gap is unsubscribes during the 7-day transfer window, which is normal churn, not a misrepresentation — see attached ESP export.",
      respondedAt: new Date(),
    },
  });

  console.log("Seeded:", {
    admin: admin.email,
    seller: seller.email,
    buyer: buyer.email,
    buyerTwo: buyerTwo.email,
    listings: listings.length,
    deal: deal.id,
  });
  console.log("All demo passwords: password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
