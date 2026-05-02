import { getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).clerkUserId = clerkUserId;
  next();
}

export async function getOrCreateUser(clerkUserId: string, email: string, firstName?: string | null, lastName?: string | null) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId)).limit(1);
  if (existing[0]) return existing[0];

  const [user] = await db.insert(usersTable).values({
    clerkUserId,
    email,
    firstName: firstName ?? null,
    lastName: lastName ?? null,
  }).returning();
  return user;
}
