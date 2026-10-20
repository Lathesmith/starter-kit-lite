# Add a feature: replacing "notes" with your own resource

The kit ships a deliberately small resource, **notes**, to show the pattern. This guide turns it into something else; "projects" is the example. The same steps add any new resource alongside it.

## 1. Schema

Add `migrations/0004_projects.sql`:

```sql
CREATE TABLE projects (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX projects_user_created ON projects(user_id, created_at);
```

Apply locally: `npm run db:migrate:local`. Tests pick it up automatically.

## 2. Service

Create `src/projects/service.ts` by copying `src/notes/service.ts`:

- a `Project` row interface;
- `projectInputSchema = z.object({ name: ..., status: z.enum([...]) })`;
- `listProjects`, `getProject`, `createProject`, `deleteProject`, each taking `(db, userId, ...)` and filtering by `user_id`;
- throw `notFound()` when a row does not belong to the user.

## 3. Pages

Create `src/ui/pages/projects.tsx` with a `ProjectsPage` component (copy `DashboardPage`), and `src/projects/routes.tsx`:

```ts
export const projectRoutes = new Hono<AppContext>();
projectRoutes.use("/dashboard/projects/*", requireUser);
projectRoutes.use("/dashboard/projects", requireUser);
projectRoutes.get("/dashboard/projects", ...);        // list + create form
projectRoutes.post("/dashboard/projects", ...);       // parseOrThrow(projectInputSchema, form) -> create -> 303
projectRoutes.post("/dashboard/projects/:id/delete", ...);
```

Mount it in `src/app.tsx`: `app.route("/", projectRoutes);` and add a link in `src/ui/layout.tsx`.

## 4. API and MCP (Full edition)

- `src/api/routes.ts`: add `GET/POST /projects`, `GET/DELETE /projects/:id`, each with `metered(...)` (every API route is rate limited; use `units = 0` for routes that should not use quota).
- `src/mcp/tools.ts`: add `list_projects`, `create_project`, ... with `defineTool`.

## 5. Tests

`tests/projects.test.ts`, modelled on `tests/notes.test.ts`: create, list, delete; validation error; another user gets 404; anonymous gets 302. For the API and MCP, extend `tests/api-and-metering.test.ts` and `tests/mcp.test.ts`.

## 6. Remove notes (optional)

Delete `src/notes/`, `src/ui/pages/dashboard.tsx` references, the API/MCP entries and `tests/notes.test.ts`; add a migration that drops the `notes` table. Keep the dashboard route (`/dashboard`) pointing at your new resource.

## Checklist

- [ ] Every SQL statement filters by `user_id`.
- [ ] zod limits on every field; counts capped (`MAX_NOTES_PER_USER` pattern).
- [ ] POST for mutations; 303 redirects after success.
- [ ] Tests cover authorization, not only the happy path.
- [ ] `npm run check` is green.
