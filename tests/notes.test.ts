import { describe, expect, it } from "vitest";
import { MAX_NOTES_PER_USER } from "../src/notes/service";
import { fillNotes, formPost, get, signIn, testEnv, userIdFor } from "./helpers";

describe("notes (demo resource)", () => {
  it("creates, lists and deletes a user's notes, scoped to that user", async () => {
    const alice = await signIn("alice@example.com");
    const bob = await signIn("bob@example.com");

    const created = await formPost(
      "/dashboard/notes",
      { title: "Hello", body: "World" },
      alice.cookie,
    );
    expect(created.status).toBe(303);

    const page = await get("/dashboard", alice.cookie);
    const html = await page.text();
    expect(html).toContain("Hello");
    expect(html).toContain("Your notes (1)");

    const bobPage = await (await get("/dashboard", bob.cookie)).text();
    expect(bobPage).toContain("Your notes (0)");

    const note = await testEnv.DB.prepare(`SELECT id FROM notes WHERE user_id = ?`)
      .bind(await userIdFor("alice@example.com"))
      .first<{ id: string }>();
    expect(note).toBeTruthy();

    // Bob cannot delete Alice's note.
    const bobDelete = await formPost(`/dashboard/notes/${note!.id}/delete`, {}, bob.cookie);
    expect(bobDelete.status).toBe(404);

    const aliceDelete = await formPost(`/dashboard/notes/${note!.id}/delete`, {}, alice.cookie);
    expect(aliceDelete.status).toBe(303);
    expect(await (await get("/dashboard", alice.cookie)).text()).toContain("Your notes (0)");
  });

  it("validates input and re-renders the form with an error", async () => {
    const { cookie } = await signIn("dana@example.com");
    const res = await formPost("/dashboard/notes", { title: "", body: "" }, cookie);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Title is required");
  });

  it("refuses a note over the per-user limit with a 409 and the message on the form", async () => {
    const { cookie } = await signIn("full@example.com");
    const userId = await userIdFor("full@example.com");
    await fillNotes(userId, MAX_NOTES_PER_USER);

    const res = await formPost("/dashboard/notes", { title: "One too many" }, cookie);
    // A client error shown on the form, not a 500 error page.
    expect(res.status).toBe(409);
    const html = await res.text();
    expect(html).toContain("Note limit reached");
    expect(html).toContain('action="/dashboard/notes"');
    const row = await testEnv.DB.prepare(`SELECT COUNT(*) AS n FROM notes WHERE user_id = ?`)
      .bind(userId)
      .first<{ n: number }>();
    expect(row?.n).toBe(MAX_NOTES_PER_USER);
  });
});
