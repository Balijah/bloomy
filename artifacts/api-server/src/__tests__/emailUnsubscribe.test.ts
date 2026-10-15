import { describe, it, expect } from "vitest";
import { generateUnsubscribeToken } from "../routes/emailUnsubscribe";

describe("email unsubscribe", () => {
  it("generates consistent tokens for same user ID", () => {
    const token1 = generateUnsubscribeToken(42);
    const token2 = generateUnsubscribeToken(42);
    expect(token1).toBe(token2);
  });

  it("generates different tokens for different user IDs", () => {
    const token1 = generateUnsubscribeToken(1);
    const token2 = generateUnsubscribeToken(2);
    expect(token1).not.toBe(token2);
  });

  it("generates hex string tokens", () => {
    const token = generateUnsubscribeToken(1);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });
});
