#!/usr/bin/env node
/**
 * Dependency licence inventory (a lightweight SBOM).
 *
 *   node scripts/licenses.mjs --check   fail on any non-compliant licence
 *   node scripts/licenses.mjs --write   regenerate THIRD-PARTY-NOTICES.md
 *
 * Policy:
 *  - Runtime dependencies (what `wrangler deploy` bundles into the Worker) must be permissive:
 *    MIT, ISC, BSD, Apache-2.0, 0BSD, Unlicense, CC0, BlueOak.
 *  - Development dependencies are not distributed with your product. Permissive and weak-copyleft
 *    (LGPL, MPL) licences are accepted there and listed; strong copyleft (GPL, AGPL, SSPL...) and
 *    unknown licences fail the check everywhere.
 *
 * Reads the hidden lockfile npm writes to node_modules, so it reflects exactly what is installed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PERMISSIVE = new Set([
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "0BSD",
  "Unlicense",
  "CC0-1.0",
  "BlueOak-1.0.0",
  "Python-2.0",
  "MIT-0",
  "CC-BY-4.0",
  "WTFPL",
]);
const WEAK_COPYLEFT = /^(LGPL-[23]\.[01](-or-later|-only)?|MPL-2\.0)$/;
const STRONG_COPYLEFT = /(^|[^L])GPL|AGPL|SSPL|EUPL|CPAL|OSL-|CC-BY-NC|BUSL|Commons-Clause/i;

const lockPath = path.join(ROOT, "node_modules", ".package-lock.json");
if (!existsSync(lockPath)) {
  console.error("node_modules/.package-lock.json not found; run npm install first");
  process.exit(1);
}
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const rootPkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
const runtimeRoots = Object.keys(rootPkg.dependencies ?? {});

function licenseOf(entryPath, entry) {
  if (entry.license) return normalize(entry.license);
  const pj = path.join(ROOT, entryPath, "package.json");
  if (existsSync(pj)) {
    const j = JSON.parse(readFileSync(pj, "utf8"));
    if (j.license) return normalize(j.license);
    if (Array.isArray(j.licenses) && j.licenses.length)
      return normalize(j.licenses.map((l) => l.type ?? l).join(" OR "));
  }
  return "UNKNOWN";
}
function normalize(l) {
  return typeof l === "string" ? l.trim() : (l?.type ?? "UNKNOWN");
}

/** Evaluate an SPDX expression: OR needs one acceptable branch, AND needs all. */
function classify(expr) {
  const e = expr.replace(/^\(|\)$/g, "").trim();
  if (/ OR /.test(e)) {
    const parts = e.split(/ OR /).map((p) => classify(p.trim()));
    return parts.includes("permissive")
      ? "permissive"
      : parts.includes("weak")
        ? "weak"
        : "forbidden";
  }
  if (/ AND /.test(e)) {
    const parts = e.split(/ AND /).map((p) => classify(p.trim()));
    return parts.includes("forbidden")
      ? "forbidden"
      : parts.includes("weak")
        ? "weak"
        : "permissive";
  }
  if (PERMISSIVE.has(e)) return "permissive";
  if (WEAK_COPYLEFT.test(e)) return "weak";
  return "forbidden";
}

// Every installed package, with whether it is part of the runtime dependency closure.
const packages = lock.packages ?? {};
const rows = [];
for (const [p, entry] of Object.entries(packages)) {
  if (!p.startsWith("node_modules/")) continue;
  const name = p.slice(p.lastIndexOf("node_modules/") + "node_modules/".length);
  rows.push({
    key: p,
    name,
    version: entry.version,
    license: licenseOf(p, entry),
    dev: Boolean(entry.dev),
    deps: Object.keys(entry.dependencies ?? {}),
    optional: Boolean(entry.optional),
  });
}
// Runtime closure: walk from package.json dependencies through each package's dependencies,
// resolving every dependency the way Node does (nearest node_modules walking up), so a nested
// copy of a package that only dev tooling uses is not mistaken for a runtime one.
function resolveKey(fromKey, depName) {
  let base = fromKey;
  for (;;) {
    const candidate = `${base}/node_modules/${depName}`;
    if (packages[candidate]) return candidate;
    const i = base.lastIndexOf("/node_modules/");
    if (i < 0) break;
    base = base.slice(0, i);
  }
  return packages[`node_modules/${depName}`] ? `node_modules/${depName}` : null;
}
const runtimeKeys = new Set();
const queue = runtimeRoots.map((n) => `node_modules/${n}`);
while (queue.length) {
  const key = queue.pop();
  if (!key || runtimeKeys.has(key) || !packages[key]) continue;
  runtimeKeys.add(key);
  for (const d of Object.keys(packages[key].dependencies ?? {})) queue.push(resolveKey(key, d));
}
for (const r of rows) r.runtime = runtimeKeys.has(r.key);
rows.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

const problems = [];
const weakDev = [];
for (const r of rows) {
  const c = r.license === "UNKNOWN" ? "forbidden" : classify(r.license);
  if (c === "forbidden" || STRONG_COPYLEFT.test(r.license.replace(/LGPL/g, "")))
    problems.push(`${r.name}@${r.version}: ${r.license}${r.runtime ? " (RUNTIME)" : ""}`);
  else if (c === "weak") {
    if (r.runtime)
      problems.push(
        `${r.name}@${r.version}: ${r.license} (weak copyleft is not allowed at runtime)`,
      );
    else weakDev.push(r);
  }
}

if (process.argv.includes("--check")) {
  if (problems.length) {
    console.error("Licence check failed for:\n- " + problems.join("\n- "));
    process.exit(1);
  }
  const summary = {};
  for (const r of rows) summary[r.license] = (summary[r.license] ?? 0) + 1;
  console.log(
    `Licence check OK: ${rows.length} installed packages (${rows.filter((r) => r.runtime).length} runtime, all permissive). ` +
      Object.entries(summary)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", "),
  );
  if (weakDev.length)
    console.log(
      `Dev-only weak-copyleft packages (not distributed with your product): ${weakDev.map((r) => `${r.name}@${r.version} [${r.license}]`).join(", ")}`,
    );
}

if (process.argv.includes("--write")) {
  const rt = rows.filter((r) => r.runtime);
  const lines = [
    "# Third-party notices",
    "",
    `Generated by \`npm run licenses:notices\` on ${new Date().toISOString().slice(0, 10)} from the installed dependency tree (npm's \`node_modules/.package-lock.json\`).`,
    "",
    "## Runtime dependencies (bundled into the deployed Worker)",
    "",
    "| Package | Version | Licence |",
    "| --- | --- | --- |",
    ...rt.map((r) => `| ${r.name} | ${r.version} | ${r.license} |`),
    "",
  ];
  for (const r of rt) {
    const dir = path.join(ROOT, "node_modules", r.name);
    const lic = ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "license", "License"]
      .map((f) => path.join(dir, f))
      .find((f) => existsSync(f));
    lines.push(`### ${r.name} ${r.version}`, "");
    lines.push(
      lic
        ? "```\n" + readFileSync(lic, "utf8").trim() + "\n```"
        : `Licence: ${r.license} (no licence file in package)`,
    );
    lines.push("");
  }
  lines.push(
    "## Development dependencies (used to build, test and deploy; not distributed with your product)",
    "",
    weakDev.length
      ? `Weak-copyleft, development-only: ${weakDev.map((r) => `${r.name}@${r.version} (${r.license})`).join(", ")}. These run on the developer's machine or in CI and are not part of the deployed Worker.`
      : "All development dependencies are permissively licensed.",
    "",
    "| Package | Version | Licence |",
    "| --- | --- | --- |",
  );
  for (const r of rows.filter((x) => !x.runtime))
    lines.push(`| ${r.name} | ${r.version} | ${r.license} |`);
  lines.push("");
  writeFileSync(path.join(ROOT, "THIRD-PARTY-NOTICES.md"), lines.join("\n"));
  console.log(
    `wrote THIRD-PARTY-NOTICES.md (${rt.length} runtime, ${rows.length - rt.length} development packages)`,
  );
}
