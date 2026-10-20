import { z } from "zod";
import { badRequest } from "./errors";

/**
 * Parse with a zod schema and throw a 400 AppError with field details on failure.
 * Works for form bodies (Record<string, string>) and JSON bodies alike.
 */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issues = result.error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  const first = issues[0];
  throw badRequest(first ? `${first.path || "input"}: ${first.message}` : "Invalid input", issues);
}

export const emailSchema = z.string().trim().toLowerCase().email().max(254, "Email is too long");
