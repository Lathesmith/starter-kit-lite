// Extra bindings that only exist in the test environment (see vitest.config.ts).
declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}

// Vite raw imports (`import text from "./file.ts?raw"`), used by source-shape tests.
declare module "*?raw" {
  const content: string;
  export default content;
}
