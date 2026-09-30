/**
 * Guards the document viewer against the failure that has no symptom on the
 * machine that builds it.
 *
 * pdf.js ships two builds. The default ("modern") one calls built-ins that are
 * months old — `Uint8Array.prototype.toHex`, `Map.prototype.getOrInsertComputed`,
 * `Math.sumPrecise` — and on any browser without them a PDF either does not
 * open, opens blank, or spins for ever. A developer's desktop Chrome has them
 * all, so importing the wrong build works perfectly right up to the first
 * reader on an Android phone (docs/performance-analysis.md §3.1). The app
 * imports `pdfjs-dist/legacy/…` for that reason, and nothing but this check
 * stops a tidy-minded edit, or a dependency bump, from undoing it.
 *
 *     node scripts/verify-pdf-build.mjs        (npm run verify:pdf)
 *
 * Checked against `apps/guitar-codex/dist/`, which must already exist.
 *
 * What it looks at, and why each test is the dumb one:
 *
 *   1. The emitted worker is **byte-identical** to the package's legacy
 *      worker. It is a `?url` asset, copied verbatim, so equality is exact.
 *      (Grepping for the new built-ins proves nothing: the legacy build still
 *      calls them — after installing its own polyfills.)
 *   2. The `pdf-*.js` chunk carries core-js's polyfill registry — present in
 *      the legacy build of the display layer, absent from the modern one.
 *   3. `assets/.htaccess` and `pdfjs/.htaccess` were emitted (the long-cache
 *      rule — vite/immutable-headers.ts).
 *   4. The initial JavaScript stays inside its budget, gzipped.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";

/** Gzipped bytes of every script index.html loads or preloads. */
const ENTRY_BUDGET = 115_000;

const dist = fileURLToPath(new URL("../apps/guitar-codex/dist", import.meta.url));
const assets = join(dist, "assets");

if (!existsSync(assets)) {
  console.error(`no build to check at ${dist} — run \`npm run build\` first`);
  process.exit(2);
}

const require = createRequire(new URL("../apps/guitar-codex/package.json", import.meta.url));
const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));
const files = readdirSync(assets);
const problems = [];

/* 1 — the worker */
const workers = files.filter((f) => /^pdf\.worker.*\.mjs$/.test(f));
if (workers.length !== 1) {
  problems.push(`expected exactly one emitted pdf worker, found ${workers.length}: ${workers.join(", ") || "none"}`);
} else {
  const emitted = readFileSync(join(assets, workers[0]));
  const legacy = readFileSync(join(pdfjsRoot, "legacy/build/pdf.worker.min.mjs"));
  if (!emitted.equals(legacy)) {
    const modern = readFileSync(join(pdfjsRoot, "build/pdf.worker.min.mjs"));
    problems.push(
      emitted.equals(modern)
        ? `${workers[0]} is pdf.js's MODERN worker — src/lib/pdf/engine.ts must import pdfjs-dist/legacy/build/pdf.worker.min.mjs`
        : `${workers[0]} is not the package's legacy worker (neither build matches)`,
    );
  }
}

/* 2 — the display layer */
const engines = files.filter((f) => /^pdf-.*\.js$/.test(f));
if (engines.length !== 1) {
  problems.push(`expected exactly one pdf engine chunk, found ${engines.length}: ${engines.join(", ") || "none"}`);
} else if (!readFileSync(join(assets, engines[0]), "utf8").includes("__core-js_shared__")) {
  problems.push(
    `${engines[0]} carries no polyfills — it is pdf.js's modern build. Import pdfjs-dist/legacy/build/pdf.mjs, and name that path in vite.config.ts manualChunks.`,
  );
}

/* 3 — the cache headers */
for (const dir of ["assets", "pdfjs"]) {
  if (!existsSync(join(dist, dir, ".htaccess"))) problems.push(`${dir}/.htaccess was not emitted`);
}

/* 4 — the entry budget */
const html = readFileSync(join(dist, "index.html"), "utf8");
const entry = [...html.matchAll(/(?:src|href)="[^"]*\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
let total = 0;
for (const file of entry) total += gzipSync(readFileSync(join(dist, file))).length;
if (total > ENTRY_BUDGET) {
  problems.push(
    `initial JavaScript is ${(total / 1000).toFixed(1)} KB gzipped, over the ${ENTRY_BUDGET / 1000} KB budget (${entry.join(", ")})`,
  );
}

if (problems.length) {
  console.error("pdf/build check FAILED:");
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}

console.log(
  `pdf/build check passed: legacy pdf.js worker + engine, cache headers emitted, entry ${(total / 1000).toFixed(1)} KB gzip (budget ${ENTRY_BUDGET / 1000}).`,
);
