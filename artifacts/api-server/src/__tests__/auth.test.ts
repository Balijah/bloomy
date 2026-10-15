import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth } from "../lib/auth";

vi.mock("@clerk/express", () => ({
  getAuth: (req: any) => ({
    userId: req._testClerkUserId ?? null,
  }),
}));

describe("requireAuth middleware", () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it("returns 401 when no clerk user ID present", () => {
    requireAuth(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("calls next() when clerk user ID is present", () => {
    mockReq._testClerkUserId = "user_123";
    requireAuth(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.clerkUserId).toBe("user_123");
  });
});
