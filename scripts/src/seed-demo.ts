/**
 * Seed demo data for a Bloomy user account.
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx src/seed-demo.ts demo@bloomy.app
 *
 * The user must already exist (sign in once before running).
 * This script is idempotent — running it again replaces existing demo data.
 */

import { eq, sql, inArray } from "drizzle-orm";

function usage(): never {
  console.error(
    [
      "Usage: pnpm run seed-demo <email>",
      "",
      "Example:",
      "  DATABASE_URL=<url> npx tsx src/seed-demo.ts demo@bloomy.app",
    ].join("\n"),
  );
  process.exit(1);
}

const [rawEmail] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();

if (!email) {
  usage();
}

const {
  db,
  pool,
  usersTable,
  subscriptionsTable,
  locationsTable,
  farmProfilesTable,
  inputCostsTable,
} = await import("@workspace/db");

try {
  // 1. Look up user
  const [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${email}`)
    .limit(1);

  if (!user) {
    console.error(
      `No Bloomy user found for ${email}. Sign in once first, then rerun this script.`,
    );
    process.exit(1);
  }

  console.log(`Found user: ${user.email} (id=${user.id})`);

  // 2. Upsert grower subscription
  const [existingSub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, user.id))
    .limit(1);

  const subValues = { userId: user.id, tier: "grower" as const, status: "active" };
  const [sub] = existingSub
    ? await db
        .update(subscriptionsTable)
        .set(subValues)
        .where(eq(subscriptionsTable.userId, user.id))
        .returning()
    : await db.insert(subscriptionsTable).values(subValues).returning();

  console.log(`Subscription: ${sub.tier} (${sub.status})`);

  // 3. Clean up existing demo data by profile name
  const DEMO_NAMES = ["North 40 — Corn", "South Field — Soybeans"];

  const existingProfiles = await db
    .select()
    .from(farmProfilesTable)
    .where(
      sql`${farmProfilesTable.userId} = ${user.id} AND ${farmProfilesTable.name} = ANY(ARRAY[${sql.raw(DEMO_NAMES.map((n) => `'${n.replace(/'/g, "''")}'`).join(","))}])`
    );

  if (existingProfiles.length > 0) {
    const profileIds = existingProfiles.map((p) => p.id);
    await db.delete(inputCostsTable).where(inArray(inputCostsTable.farmProfileId, profileIds));
    await db.delete(farmProfilesTable).where(inArray(farmProfilesTable.id, profileIds));
    console.log(`Removed ${existingProfiles.length} existing demo profile(s)`);
  }

  // Also remove old demo location
  await db
    .delete(locationsTable)
    .where(
      sql`${locationsTable.userId} = ${user.id} AND ${locationsTable.name} = 'Ames, Iowa'`
    );

  // 4. Insert Iowa location
  const [location] = await db
    .insert(locationsTable)
    .values({
      userId: user.id,
      name: "Ames, Iowa",
      lat: 42.0308,
      lng: -93.6319,
      city: "Ames",
      state: "Iowa",
      isDefault: true,
    })
    .returning();

  console.log(`Created location: ${location.name} (id=${location.id})`);

  // 5. Insert corn profile
  const [cornProfile] = await db
    .insert(farmProfilesTable)
    .values({
      userId: user.id,
      locationId: location.id,
      name: "North 40 — Corn",
      cropType: "corn",
      acreage: 200,
      plantingDate: "2025-05-01",
      yieldGoal: 185,
      cropPrice: 4.55,
      costPerAcre: 625,
    })
    .returning();

  console.log(`Created corn profile: ${cornProfile.name} (id=${cornProfile.id})`);

  // 6. Corn input costs
  const cornCosts = [
    { category: "seed", item: "Pioneer P1197AM", costPerAcre: 118 },
    { category: "fertilizer", item: "Anhydrous ammonia", costPerAcre: 145 },
    { category: "fertilizer", item: "DAP starter", costPerAcre: 60 },
    { category: "herbicide", item: "Roundup PowerMax", costPerAcre: 34 },
    { category: "pesticide", item: "Insecticide (foliar)", costPerAcre: 22 },
    { category: "fuel", item: "Diesel — field ops", costPerAcre: 32 },
  ] as const;

  await db.insert(inputCostsTable).values(
    cornCosts.map((c) => ({ ...c, userId: user.id, farmProfileId: cornProfile.id }))
  );

  console.log(`Added ${cornCosts.length} corn input costs`);

  // 7. Insert soybean profile
  const [soybeanProfile] = await db
    .insert(farmProfilesTable)
    .values({
      userId: user.id,
      locationId: location.id,
      name: "South Field — Soybeans",
      cropType: "soybeans",
      acreage: 150,
      plantingDate: "2025-05-10",
      yieldGoal: 55,
      cropPrice: 11.2,
      costPerAcre: 390,
    })
    .returning();

  console.log(`Created soybean profile: ${soybeanProfile.name} (id=${soybeanProfile.id})`);

  // 8. Soybean input costs
  const soybeanCosts = [
    { category: "seed", item: "Asgrow AG46X6", costPerAcre: 74 },
    { category: "fertilizer", item: "Potash broadcast", costPerAcre: 55 },
    { category: "herbicide", item: "Flexstar GT", costPerAcre: 38 },
    { category: "pesticide", item: "Aphid treatment", costPerAcre: 20 },
  ] as const;

  await db.insert(inputCostsTable).values(
    soybeanCosts.map((c) => ({ ...c, userId: user.id, farmProfileId: soybeanProfile.id }))
  );

  console.log(`Added ${soybeanCosts.length} soybean input costs`);

  console.log("\nDemo seed complete!");
  console.log(`  User:     ${user.email}`);
  console.log(`  Tier:     ${sub.tier}`);
  console.log(`  Location: ${location.name}`);
  console.log(`  Profiles: ${cornProfile.name}, ${soybeanProfile.name}`);
} finally {
  await pool.end();
}
