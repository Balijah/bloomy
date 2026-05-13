import { eq, sql } from "drizzle-orm";

const VALID_TIERS = ["free", "grower", "grower_pro"] as const;
type Tier = (typeof VALID_TIERS)[number];

function usage(): never {
  console.error(
    [
      "Usage: pnpm run set-subscription-tier <email> <free|grower|grower_pro>",
      "",
      "Example:",
      "  pnpm run set-subscription-tier grower@example.com grower",
    ].join("\n"),
  );
  process.exit(1);
}

const [rawEmail, rawTier] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();
const tier = rawTier?.trim() as Tier | undefined;

if (!email || !tier || !VALID_TIERS.includes(tier)) {
  usage();
}

const { db, pool, subscriptionsTable, usersTable } = await import("@workspace/db");

try {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${email}`)
    .limit(1);

  if (!user) {
    console.error(
      `No Bloomy user found for ${email}. Sign in once first, then rerun this command.`,
    );
    process.exit(1);
  }

  const [existing] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, user.id))
    .limit(1);

  const values = {
    userId: user.id,
    tier,
    status: "active",
  };

  const [subscription] = existing
    ? await db
        .update(subscriptionsTable)
        .set(values)
        .where(eq(subscriptionsTable.userId, user.id))
        .returning()
    : await db.insert(subscriptionsTable).values(values).returning();

  console.log(
    `Set ${email} to ${subscription.tier} (${subscription.status}) for user id ${user.id}.`,
  );
} finally {
  await pool.end();
}
