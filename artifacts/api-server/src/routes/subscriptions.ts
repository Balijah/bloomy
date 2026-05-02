import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable } from "@workspace/db";
import {
  GetCurrentSubscriptionResponse,
  CreateCheckoutSessionBody,
  CreateCheckoutSessionResponse,
  CreatePortalSessionResponse,
} from "@workspace/api-zod";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

const STRIPE_PRICE_IDS: Record<string, string> = {
  grower: process.env.STRIPE_PRICE_GROWER ?? "",
  grower_pro: process.env.STRIPE_PRICE_GROWER_PRO ?? "",
};

async function getUserId(req: any): Promise<number> {
  const auth = getAuth(req);
  const email = auth.sessionClaims?.email as string ?? "";
  const user = await getOrCreateUser(req.clerkUserId, email);
  return user.id;
}

router.get("/subscriptions/current", requireAuth, async (req, res): Promise<void> => {
  const userId = await getUserId(req);
  let [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)).limit(1);
  if (!sub) {
    await db.insert(subscriptionsTable).values({ userId, tier: "free", status: "active" });
    [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)).limit(1);
  }
  res.json(GetCurrentSubscriptionResponse.parse(sub));
});

router.post("/subscriptions/checkout", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCheckoutSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: "Payment processing not configured" });
    return;
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const userId = await getUserId(req);
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)).limit(1);

  const priceId = STRIPE_PRICE_IDS[parsed.data.tier];
  if (!priceId) {
    res.status(400).json({ error: "Invalid tier" });
    return;
  }

  const sessionParams: any = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: parsed.data.successUrl,
    cancel_url: parsed.data.cancelUrl,
  };

  if (sub?.stripeCustomerId) {
    sessionParams.customer = sub.stripeCustomerId;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  res.json(CreateCheckoutSessionResponse.parse({ url: session.url }));
});

router.post("/subscriptions/portal", requireAuth, async (req, res): Promise<void> => {
  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: "Payment processing not configured" });
    return;
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const userId = await getUserId(req);
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)).limit(1);

  if (!sub?.stripeCustomerId) {
    res.status(400).json({ error: "No Stripe customer found" });
    return;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${process.env.APP_URL ?? ""}/settings`,
  });

  res.json(CreatePortalSessionResponse.parse({ url: session.url }));
});

export default router;
