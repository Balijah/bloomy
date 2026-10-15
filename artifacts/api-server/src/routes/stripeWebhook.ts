import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable, stripeEventsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function tierFromPriceId(priceId: string | null): string {
  if (!priceId) return "free";
  const growerPrice = process.env.STRIPE_PRICE_GROWER ?? "";
  const growerProPrice = process.env.STRIPE_PRICE_GROWER_PRO ?? "";
  if (priceId === growerProPrice) return "grower_pro";
  if (priceId === growerPrice) return "grower";
  return "free";
}

router.post("/stripe/webhook", async (req, res): Promise<void> => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error("STRIPE_WEBHOOK_SECRET not configured");
    res.status(503).json({ error: "Webhook not configured" });
    return;
  }

  if (!sig) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

  let event;
  try {
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      res.status(400).json({ error: "Missing raw body" });
      return;
    }
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    logger.warn({ err: err.message }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  const [existing] = await db
    .select()
    .from(stripeEventsTable)
    .where(eq(stripeEventsTable.stripeEventId, event.id))
    .limit(1);

  if (existing) {
    logger.info({ eventId: event.id }, "Stripe webhook: duplicate event, skipping");
    res.json({ received: true });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (subscriptionId && customerId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price?.id ?? null;
          const tier = tierFromPriceId(priceId);

          const [sub] = await db
            .select()
            .from(subscriptionsTable)
            .where(eq(subscriptionsTable.stripeCustomerId, customerId))
            .limit(1);

          if (sub) {
            await db
              .update(subscriptionsTable)
              .set({
                tier,
                status: "active",
                stripeSubscriptionId: subscriptionId,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              })
              .where(eq(subscriptionsTable.id, sub.id));
          } else {
            logger.warn({ customerId }, "checkout.session.completed: no subscription row found for customer");
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
        const tier = tierFromPriceId(priceId);
        const status = subscription.cancel_at_period_end ? "canceling" : mapStripeStatus(subscription.status);

        await db
          .update(subscriptionsTable)
          .set({
            tier,
            status,
            stripeSubscriptionId: subscription.id,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          })
          .where(eq(subscriptionsTable.stripeCustomerId, customerId));
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        await db
          .update(subscriptionsTable)
          .set({ tier: "free", status: "canceled", stripeSubscriptionId: null, currentPeriodEnd: null })
          .where(eq(subscriptionsTable.stripeCustomerId, customerId));
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;

        await db
          .update(subscriptionsTable)
          .set({ status: "past_due" })
          .where(eq(subscriptionsTable.stripeCustomerId, customerId));
        break;
      }

      default:
        logger.info({ type: event.type }, "Stripe webhook: unhandled event type");
    }

    await db.insert(stripeEventsTable).values({
      stripeEventId: event.id,
      eventType: event.type,
    });
  } catch (err) {
    logger.error({ err, eventId: event.id }, "Stripe webhook: processing error");
    res.status(500).json({ error: "Webhook processing failed" });
    return;
  }

  res.json({ received: true });
});

function mapStripeStatus(status: string): string {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    default:
      return status;
  }
}

export default router;
