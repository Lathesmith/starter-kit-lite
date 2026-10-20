import { app } from "./app";
import type { AppEnv } from "./env";
import { purgeExpiredAuthRows } from "./auth/service";

/**
 * Worker entry point. `fetch` handles HTTP; `scheduled` runs the daily cron from wrangler.jsonc.
 */
export default {
  fetch: app.fetch,

  async scheduled(
    _controller: ScheduledController,
    env: AppEnv,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const auth = await purgeExpiredAuthRows(env);
        console.log(`[cron] purged ${auth.sessions} sessions, ${auth.links} magic links`);
      })(),
    );
  },
} satisfies ExportedHandler<AppEnv>;
