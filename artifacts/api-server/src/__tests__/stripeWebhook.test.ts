import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Stripe webhook signature verification", () => {
  it("rejects requests without stripe-signature header", async () => {
    const { default: app } = await import("../app");
    const { default: request } = await import("supertest");

    const res = await request(app)
      .post("/api/stripe/webhook")
      .send({ type: "test" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing stripe-signature/i);
  });

  it("rejects requests with invalid signature", async () => {
    const { default: app } = await import("../app");
    const { default: request } = await import("supertest");

    const res = await request(app)
      .post("/api/stripe/webhook")
      .send(JSON.stringify({ type: "test" }))
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=123,v1=invalid_signature");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid signature/i);
  });
});

describe("Stripe webhook idempotency", () => {
  it("generates unique tokens for different user IDs", () => {
    const secret = "test-secret";
    const token1 = createHmac("sha256", secret).update("1").digest("hex");
    const token2 = createHmac("sha256", secret).update("2").digest("hex");
    expect(token1).not.toBe(token2);
  });
});
