import { describe, it, expect, vi, beforeEach } from "vitest";

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

describe("API rate limit behind one proxy hop", () => {
  it("keeps a separate bucket per forwarded client, including the Stripe webhook", async () => {
    const { default: app } = await import("../app");
    const { default: request } = await import("supertest");

    expect(app.get("trust proxy")).toBe(1);

    const post = (ip: string) =>
      request(app)
        .post("/api/stripe/webhook")
        .set("X-Forwarded-For", ip)
        .set("Content-Type", "application/json")
        .send({ type: "test" });

    const firstA = await post("203.0.113.10");
    const firstB = await post("203.0.113.11");
    const secondA = await post("203.0.113.10");

    expect(remaining(firstA)).toBe(299);
    expect(remaining(firstB)).toBe(299);
    expect(remaining(secondA)).toBe(298);
  });
});

function remaining(res: { headers: Record<string, string | string[] | undefined> }): number {
  const header = res.headers["ratelimit"];
  const value = Array.isArray(header) ? header[0] : header;
  const match = /remaining=(\d+)/.exec(value ?? "");
  if (!match) throw new Error(`missing RateLimit header: ${String(value)}`);
  return Number(match[1]);
}
