/**
 * Thin helpers over the D1 client. We use plain SQL on purpose: it is easy to read, easy for an
 * agent to modify safely, and has no ORM version churn.
 */

export async function one<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  const row = await db
    .prepare(sql)
    .bind(...params)
    .first<T>();
  return row ?? null;
}

export async function all<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const { results } = await db
    .prepare(sql)
    .bind(...params)
    .all<T>();
  return results;
}

/** Run a write and return how many rows changed. */
export async function run(db: D1Database, sql: string, ...params: unknown[]): Promise<number> {
  const result = await db
    .prepare(sql)
    .bind(...params)
    .run();
  return result.meta.changes ?? 0;
}

export async function count(db: D1Database, sql: string, ...params: unknown[]): Promise<number> {
  const row = await one<{ n: number }>(db, sql, ...params);
  return row?.n ?? 0;
}
