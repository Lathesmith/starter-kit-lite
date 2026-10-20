/**
 * Application errors carry an HTTP status and a stable machine-readable code.
 * Route handlers throw them; `app.onError` turns them into HTML or JSON.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    /**
     * True when the request was refused before doing any work for the caller, so metered routes
     * (JSON API, MCP tools) give back the usage they recorded for it. See src/metering/middleware.ts.
     */
    public readonly uncharged = false,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, "bad_request", message, details);
export const unauthorized = (message = "Authentication required") =>
  new AppError(401, "unauthorized", message);
export const forbidden = (message = "Forbidden") => new AppError(403, "forbidden", message);
export const notFound = (message = "Not found") => new AppError(404, "not_found", message);
export const tooManyRequests = (message = "Too many requests", details?: unknown) =>
  new AppError(429, "rate_limited", message, details);
/** The request conflicts with the current state (already subscribed, already owned...). */
export const conflict = (message: string, code = "conflict") => new AppError(409, code, message);
/** A per-user cap was reached. Not charged: nothing was created. */
export const limitReached = (message: string) =>
  new AppError(409, "limit_reached", message, undefined, true);
export const misconfigured = (message: string) => new AppError(500, "misconfigured", message);
