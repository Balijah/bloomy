import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, farmProfilesTable, fieldNotesTable } from "@workspace/db";
import {
  GetFieldNotesParams,
  GetFieldNotesResponse,
  CreateFieldNoteParams,
  CreateFieldNoteBody,
  UpdateFieldNoteParams,
  UpdateFieldNoteBody,
  UpdateFieldNoteResponse,
  DeleteFieldNoteParams,
} from "@workspace/api-zod";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

async function getUserId(req: any): Promise<number> {
  const auth = getAuth(req);
  const email = (auth.sessionClaims?.email as string) ?? "";
  const user = await getOrCreateUser(req.clerkUserId, email);
  return user.id;
}

async function assertFarmOwnership(
  farmProfileId: number,
  userId: number
): Promise<boolean> {
  const [profile] = await db
    .select({ id: farmProfilesTable.id })
    .from(farmProfilesTable)
    .where(
      and(
        eq(farmProfilesTable.id, farmProfileId),
        eq(farmProfilesTable.userId, userId)
      )
    );
  return !!profile;
}

router.get(
  "/agriculture/farm-profiles/:id/field-notes",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = await getUserId(req);
    const params = GetFieldNotesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const owned = await assertFarmOwnership(params.data.id, userId);
    if (!owned) {
      res.status(404).json({ error: "Farm profile not found" });
      return;
    }

    const rows = await db
      .select()
      .from(fieldNotesTable)
      .where(
        and(
          eq(fieldNotesTable.farmProfileId, params.data.id),
          eq(fieldNotesTable.userId, userId)
        )
      )
      .orderBy(desc(fieldNotesTable.date), desc(fieldNotesTable.createdAt));

    res.json(GetFieldNotesResponse.parse(rows));
  }
);

router.post(
  "/agriculture/farm-profiles/:id/field-notes",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = await getUserId(req);
    const params = CreateFieldNoteParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const owned = await assertFarmOwnership(params.data.id, userId);
    if (!owned) {
      res.status(404).json({ error: "Farm profile not found" });
      return;
    }

    const body = CreateFieldNoteBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [note] = await db
      .insert(fieldNotesTable)
      .values({
        farmProfileId: params.data.id,
        userId,
        date: body.data.date instanceof Date
          ? body.data.date.toISOString().slice(0, 10)
          : String(body.data.date),
        category: body.data.category,
        severity: body.data.severity ?? null,
        title: body.data.title,
        body: body.data.body,
        photoData: (body.data.photoData as string[] | null | undefined) ?? null,
      })
      .returning();

    res.status(201).json(note);
  }
);

router.put(
  "/agriculture/farm-profiles/:id/field-notes/:noteId",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = await getUserId(req);
    const params = UpdateFieldNoteParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const body = UpdateFieldNoteBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (body.data.date !== undefined) {
      updateData.date = body.data.date instanceof Date
        ? body.data.date.toISOString().slice(0, 10)
        : String(body.data.date);
    }
    if (body.data.category !== undefined)
      updateData.category = body.data.category;
    if (body.data.severity !== undefined)
      updateData.severity = body.data.severity ?? null;
    if (body.data.title !== undefined) updateData.title = body.data.title;
    if (body.data.body !== undefined) updateData.body = body.data.body;
    if (body.data.photoData !== undefined)
      updateData.photoData =
        (body.data.photoData as string[] | null | undefined) ?? null;

    const [updated] = await db
      .update(fieldNotesTable)
      .set(updateData as any)
      .where(
        and(
          eq(fieldNotesTable.id, params.data.noteId),
          eq(fieldNotesTable.farmProfileId, params.data.id),
          eq(fieldNotesTable.userId, userId)
        )
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json(UpdateFieldNoteResponse.parse(updated));
  }
);

router.delete(
  "/agriculture/farm-profiles/:id/field-notes/:noteId",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = await getUserId(req);
    const params = DeleteFieldNoteParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [deleted] = await db
      .delete(fieldNotesTable)
      .where(
        and(
          eq(fieldNotesTable.id, params.data.noteId),
          eq(fieldNotesTable.farmProfileId, params.data.id),
          eq(fieldNotesTable.userId, userId)
        )
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.sendStatus(204);
  }
);

export default router;
