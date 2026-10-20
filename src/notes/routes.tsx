import { Hono } from "hono";
import type { AppContext } from "../env";
import { requireUser } from "../auth/middleware";
import { AppError } from "../lib/errors";
import { parseOrThrow } from "../lib/validate";
import { DashboardPage } from "../ui/pages/dashboard";
import { createNote, deleteNote, listNotes, noteInputSchema } from "./service";

export const dashboardRoutes = new Hono<AppContext>();

dashboardRoutes.use("/dashboard/*", requireUser);
dashboardRoutes.use("/dashboard", requireUser);

dashboardRoutes.get("/dashboard", async (c) => {
  const user = c.get("user")!;
  const notes = await listNotes(c.env.DB, user.id);
  return c.html(<DashboardPage env={c.env} user={user} notes={notes} />);
});

dashboardRoutes.post("/dashboard/notes", async (c) => {
  const user = c.get("user")!;
  const form = await c.req.parseBody();
  try {
    const input = parseOrThrow(noteInputSchema, form);
    await createNote(c.env.DB, user.id, input);
  } catch (err) {
    // Validation errors (400) and the note limit (409) re-render the form with the message.
    if (err instanceof AppError && (err.status === 400 || err.status === 409)) {
      const notes = await listNotes(c.env.DB, user.id);
      return c.html(
        <DashboardPage env={c.env} user={user} notes={notes} error={err.message} />,
        err.status,
      );
    }
    throw err;
  }
  return c.redirect("/dashboard", 303);
});

dashboardRoutes.post("/dashboard/notes/:id/delete", async (c) => {
  const user = c.get("user")!;
  await deleteNote(c.env.DB, user.id, c.req.param("id"));
  return c.redirect("/dashboard", 303);
});
