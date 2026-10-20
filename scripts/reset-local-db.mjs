#!/usr/bin/env node
/** Wipe the local D1 state used by `wrangler dev` and re-apply every migration. */
import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
rmSync(path.join(ROOT, ".wrangler", "state", "v3", "d1"), { recursive: true, force: true });
execFileSync(
  process.execPath,
  [
    path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js"),
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
  ],
  {
    cwd: ROOT,
    stdio: "inherit",
  },
);
console.log("Local D1 reset and migrated.");
