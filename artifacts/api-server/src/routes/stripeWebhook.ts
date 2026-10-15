import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable, stripeEventsTable } from "@workspace/db";
import type Stripe from "stripe";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function tierFromPriceId(priceId: string | undefined): string {
  if (!priceId) return "free";
  if (priceId === process.env.STRIPE_PRICE_GROWER_PRO) return "grower_pro";
  if (priceId === process.env.STRIPE_PRICE_GROWER) return "grower";
  return "free";
}

router.post("/stripe/webhook", async (req, res): Promise<void> => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !process.env.STRIPE_SECRET_KEY) {
    logger.error("Stripe webhook not configured");
    res.status(503).json({ error: "Webhook not configured" });
    return;
  }
  if (!sig) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event: Stripe.Event;
  try {
    const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      res.status(400).json({ error: "Missing raw body" });
      return;
    }
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  try {
    // The event claim and its writes commit together, so failures remain retryable.
    await db.transaction(async (tx) => {
      const claimed = await tx.insert(stripeEventsTable)
        .values({ stripeEventId: event.id, eventType: event.type })
        .onConflictDoNothing()
        .returning({ id: stripeEventsTable.id });
      if (claimed.length === 0) return;

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          if (!session.subscription || !session.customer) break;
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const item = subscription.items.data[0];
          const updated = await tx.update(subscriptionsTable)
            .set({
              tier: tierFromPriceId(item?.price.id),
              status: mapStripeStatus(subscription.status),
              stripeSubscriptionId: subscription.id,
              currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
            })
            .where(eq(subscriptionsTable.stripeCustomerId, customerId))
            .returning({ id: subscriptionsTable.id });
          if (updated.length === 0) throw new Error(`No subscription row for customer ${customerId}`);
          break;
        }
        case "customer.subscription.updated": {
          const subscription = event.data.object;
          const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
          const item = subscription.items.data[0];
          await tx.update(subscriptionsTable)
            .set({
              tier: tierFromPriceId(item?.price.id),
              status: subscription.cancel_at_period_end ? "canceling" : mapStripeStatus(subscription.status),
              stripeSubscriptionId: subscription.id,
              currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
            })
            .where(eq(subscriptionsTable.stripeCustomerId, customerId));
          break;
        }
        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
          await tx.update(subscriptionsTable)
            .set({ tier: "free", status: "canceled", stripeSubscriptionId: null, currentPeriodEnd: null })
            .where(eq(subscriptionsTable.stripeCustomerId, customerId));
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
          if (customerId) {
            await tx.update(subscriptionsTable).set({ status: "past_due" })
              .where(eq(subscriptionsTable.stripeCustomerId, customerId));
          }
          break;
        }
        default:
          logger.info({ type: event.type }, "Stripe webhook: unhandled event type");
      }
    });
  } catch (err) {
    logger.error({ err, eventId: event.id }, "Stripe webhook: processing error");
    res.status(500).json({ error: "Webhook processing failed" });
    return;
  }
  res.json({ received: true });
});

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "unpaid":
      return "canceled";
    default:
      return status;
  }
}

export default router;
