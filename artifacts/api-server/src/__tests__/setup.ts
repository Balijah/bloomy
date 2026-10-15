import { vi } from "vitest";

process.env.PORT = "0";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.CLERK_SECRET_KEY = "sk_test_fake";
process.env.CLERK_PUBLISHABLE_KEY = "pk_test_fake";
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake";
process.env.STRIPE_PRICE_GROWER = "price_grower_test";
process.env.STRIPE_PRICE_GROWER_PRO = "price_grower_pro_test";
process.env.CORS_ORIGIN = "http://localhost:3000";

const noopLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn().mockReturnThis(),
  level: "silent",
};

vi.mock("../lib/logger", () => ({
  logger: noopLogger,
}));

vi.mock("pino", () => {
  const pino = () => noopLogger;
  pino.default = pino;
  return { default: pino };
});

vi.mock("pino-http", () => {
  const pinoHttp = () => (_req: any, _res: any, next: any) => next();
  pinoHttp.default = pinoHttp;
  return { default: pinoHttp };
});

vi.mock("@workspace/db", () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue([]),
    insert: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  };
  const transaction = vi.fn(async (fn: any) => fn(mockDb));
  return {
    db: { ...mockDb, transaction },
    pool: {},
    usersTable: { id: "id", clerkUserId: "clerk_user_id", email: "email" },
    locationsTable: { id: "id", userId: "user_id", isDefault: "is_default" },
    subscriptionsTable: { id: "id", userId: "user_id", stripeCustomerId: "stripe_customer_id" },
    stripeEventsTable: { id: "id", stripeEventId: "stripe_event_id" },
    farmProfilesTable: { id: "id", userId: "user_id" },
    alertPreferencesTable: { id: "id", userId: "user_id" },
    alertsTable: { id: "id", userId: "user_id" },
    pushTokensTable: { id: "id", userId: "user_id" },
    fieldNotesTable: { id: "id", userId: "user_id" },
    yieldRecordsTable: { id: "id", userId: "user_id" },
    inputCostsTable: { id: "id", userId: "user_id" },
  };
});

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: (req: any) => ({
    userId: req.clerkUserId ?? null,
    sessionClaims: { email: "test@example.com" },
  }),
}));

vi.mock("@clerk/shared/keys", () => ({
  publishableKeyFromHost: () => "pk_test_fake",
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => ({ op: "eq", args })),
  and: vi.fn((...args: any[]) => ({ op: "and", args })),
  desc: vi.fn((col: any) => ({ op: "desc", col })),
  gte: vi.fn((...args: any[]) => ({ op: "gte", args })),
  inArray: vi.fn((...args: any[]) => ({ op: "inArray", args })),
  or: vi.fn((...args: any[]) => ({ op: "or", args })),
}));
