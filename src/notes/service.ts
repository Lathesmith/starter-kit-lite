/**
 * The demo resource. It exists to show the pattern: a service module with plain SQL, a zod
 * schema for input, and routes (HTML, JSON API and MCP) that all call the same functions.
 */
import { z } from "zod";
import { newId } from "../lib/crypto";
import { all, one, run } from "../lib/db";
import { limitReached, notFound } from "../lib/errors";
import { now } from "../lib/time";

export interface Note {
  id: string;
  user_id: string;
  title: string;
  body: string;
  created_at: number;
  updated_at: number;
}

export const noteInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120, "Title is too long (max 120)"),
  body: z.string().trim().max(5000, "Body is too long (max 5000)").default(""),
});
export type NoteInput = z.infer<typeof noteInputSchema>;

export const MAX_NOTES_PER_USER = 500;

export function listNotes(db: D1Database, userId: string, limit = 100): Promise<Note[]> {
  return all<Note>(
    db,
    `SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
    userId,
    limit,
  );
}

export async function getNote(db: D1Database, userId: string, id: string): Promise<Note> {
  const note = await one<Note>(db, `SELECT * FROM notes WHERE id = ? AND user_id = ?`, id, userId);
  if (!note) throw notFound("Note not found");
  return note;
}

export async function createNote(db: D1Database, userId: string, input: NoteInput): Promise<Note> {
  const ts = now();
  const note: Note = {
    id: newId("note"),
    user_id: userId,
    title: input.title,
    body: input.body,
    created_at: ts,
    updated_at: ts,
  };
  await run(
    db,
    `INSERT INTO notes (id, user_id, title, body, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, ?
     WHERE (SELECT COUNT(*) FROM notes WHERE user_id = ?) < ?`,
    note.id,
    note.user_id,
    note.title,
    note.body,
    ts,
    ts,
    userId,
    MAX_NOTES_PER_USER,
  );
  const saved = await one<Note>(db, `SELECT * FROM notes WHERE id = ?`, note.id);
  // A client error (409), not a crash: nothing was created, so metered callers are not charged.
  if (!saved)
    throw limitReached(
      `Note limit reached: you can keep up to ${MAX_NOTES_PER_USER} notes. Delete one to add another.`,
    );
  return saved;
}

export async function deleteNote(db: D1Database, userId: string, id: string): Promise<void> {
  const changed = await run(db, `DELETE FROM notes WHERE id = ? AND user_id = ?`, id, userId);
  if (changed !== 1) throw notFound("Note not found");
}

export function countNotes(db: D1Database, userId: string): Promise<number> {
  return one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM notes WHERE user_id = ?`, userId).then(
    (r) => r?.n ?? 0,
  );
}
