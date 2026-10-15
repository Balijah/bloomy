import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import Stripe from "stripe";
import { db, subscriptionsTable } from "@workspace/db";
import subscriptions from "../routes/subscriptions";
import users from "../routes/users";
import app from "../app";

const stripeMocks = vi.hoisted(() => ({
  createCustomer: vi.fn(), createCheckout: vi.fn(), retrieve: vi.fn(), cancel: vi.fn(),
}));
vi.mock("stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("stripe")>();
  return { ...actual, default: class extends actual.default {
    constructor(...args: ConstructorParameters<typeof actual.default>) {
      super(...args);
      this.customers.create = stripeMocks.createCustomer;
      this.checkout.sessions.create = stripeMocks.createCheckout;
      this.subscriptions.retrieve = stripeMocks.retrieve;
      this.subscriptions.cancel = stripeMocks.cancel;
    }
  } };
});

const mockDb = db as any;
const authenticated = express();
authenticated.use(express.json(), (req, _res, next) => {
  (req as any).clerkUserId = "user_test";
  next();
});
authenticated.use("/api", subscriptions, users);

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.limit.mockReset().mockReturnValue([]);
  mockDb.returning.mockReset().mockReturnValue([{ id: 1 }]);
  mockDb.onConflictDoUpdate.mockReset().mockReturnThis();
  stripeMocks.createCustomer.mockResolvedValue({ id: "cus_test" });
  stripeMocks.createCheckout.mockResolvedValue({ url: "https://checkout.stripe.com/test" });
  stripeMocks.cancel.mockReset().mockResolvedValue({ status: "canceled" });
});

const checkoutBody = { tier: "grower", successUrl: "https://bloomy.app/success", cancelUrl: "https://bloomy.app/cancel" };
const subscription = {
  id: "sub_test", customer: "cus_test", status: "active", cancel_at_period_end: false,
  items: { data: [{ price: { id: "price_grower_test" }, current_period_end: 1800000000 }] },
};

async function webhook(type: string, object: unknown, id = "evt_test") {
  const payload = JSON.stringify({ id, type, data: { object } });
  const signature = new Stripe("sk_test_fake").webhooks.generateTestHeaderString({
    payload, secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });
  return request(app).post("/api/stripe/webhook")
    .set("Content-Type", "application/json").set("stripe-signature", signature).send(payload);
}

describe("checkout customer mapping", () => {
  it("persists a new customer's user mapping before creating Checkout", async () => {
    mockDb.limit.mockReturnValueOnce([{ id: 42 }]).mockReturnValueOnce([{ id: 1, stripeCustomerId: null }]);
    stripeMocks.createCheckout.mockImplementationOnce(async (params) => {
      expect(mockDb.onConflictDoUpdate).toHaveBeenCalledWith({
        target: subscriptionsTable.userId, set: { stripeCustomerId: "cus_test" },
      });
      expect(params.customer).toBe("cus_test");
      return { url: "https://checkout.stripe.com/test" };
    });
    const res = await request(authenticated).post("/api/subscriptions/checkout").send(checkoutBody);
    expect(res.status).toBe(200);
    expect(mockDb.values).toHaveBeenCalledWith({ userId: 42, stripeCustomerId: "cus_test" });
    expect(stripeMocks.createCustomer).toHaveBeenCalledWith(
      { metadata: { userId: "42" } }, { idempotencyKey: "bloomy-customer-42" },
    );
  });

  it("reuses an existing customer", async () => {
    mockDb.limit.mockReturnValueOnce([{ id: 42 }]).mockReturnValueOnce([{ stripeCustomerId: "cus_existing" }]);
    expect((await request(authenticated).post("/api/subscriptions/checkout").send(checkoutBody)).status).toBe(200);
    expect(stripeMocks.createCustomer).not.toHaveBeenCalled();
    expect(stripeMocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_existing" }));
  });
});

describe("signed Stripe events", () => {
  it("upgrades the mapped customer using the subscription item's billing period", async () => {
    stripeMocks.retrieve.mockResolvedValueOnce(subscription);
    const res = await webhook("checkout.session.completed", { customer: "cus_test", subscription: "sub_test" });
    expect(res.status).toBe(200);
    expect(mockDb.transaction).toHaveBeenCalledOnce();
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({
      tier: "grower", status: "active", stripeSubscriptionId: "sub_test",
      currentPeriodEnd: new Date(1800000000000),
    }));
    expect(mockDb.where).toHaveBeenCalledWith({ op: "eq", args: [subscriptionsTable.stripeCustomerId, "cus_test"] });
  });

  it("does not apply the same event twice", async () => {
    stripeMocks.retrieve.mockResolvedValueOnce(subscription);
    mockDb.returning.mockReturnValueOnce([{ id: 1 }]).mockReturnValueOnce([{ id: 1 }]).mockReturnValueOnce([]);
    const event = { customer: "cus_test", subscription: "sub_test" };
    expect((await webhook("checkout.session.completed", event)).status).toBe(200);
    expect((await webhook("checkout.session.completed", event)).status).toBe(200);
    expect(stripeMocks.retrieve).toHaveBeenCalledOnce();
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  it("rejects processing when the customer mapping is missing so Stripe can retry", async () => {
    stripeMocks.retrieve.mockResolvedValueOnce(subscription);
    mockDb.returning.mockReturnValueOnce([{ id: 1 }]).mockReturnValueOnce([]);
    expect((await webhook("checkout.session.completed", { customer: "cus_test", subscription: "sub_test" })).status).toBe(500);
  });

  it("accepts subscription updates without a removed top-level current_period_end", async () => {
    expect((await webhook("customer.subscription.updated", subscription)).status).toBe(200);
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ currentPeriodEnd: new Date(1800000000000) }));
  });
});

describe("account deletion", () => {
  function paidAccount() {
    mockDb.limit.mockReturnValueOnce([{ id: 42 }]).mockReturnValueOnce([{ stripeSubscriptionId: "sub_test" }]);
  }

  it("preserves local records when cancellation fails", async () => {
    paidAccount();
    stripeMocks.cancel.mockRejectedValueOnce(new Error("Stripe unavailable"));
    expect((await request(authenticated).delete("/api/users/me")).status).toBe(502);
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it("preserves local records when Stripe is not configured", async () => {
    paidAccount();
    const key = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      expect((await request(authenticated).delete("/api/users/me")).status).toBe(503);
      expect(mockDb.delete).not.toHaveBeenCalled();
    } finally { process.env.STRIPE_SECRET_KEY = key; }
  });

  it("cancels billing before deleting local records", async () => {
    paidAccount();
    stripeMocks.cancel.mockImplementationOnce(async () => {
      expect(mockDb.delete).not.toHaveBeenCalled();
      return { status: "canceled" };
    });
    expect((await request(authenticated).delete("/api/users/me")).status).toBe(204);
    expect(stripeMocks.cancel).toHaveBeenCalledWith("sub_test");
    expect(mockDb.delete).toHaveBeenCalledOnce();
  });
});
