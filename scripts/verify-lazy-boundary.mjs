/**
 * Guards the one mistake in this architecture that has no visible symptom.
 *
 * Both feature packages are supposed to arrive only when a reader opens them.
 * A single *static* `import` of one from startup code — App.tsx, main.tsx, or a
 * barrel that either of them reads — folds the whole feature into the initial
 * bundle. Nothing breaks. Nothing warns. The catalogue just quietly costs every
 * visitor 250 kB it does not need, and stays that way until someone thinks to
 * look at the build output.
 *
 * So: look at the build output, every build.
 *
 *     node scripts/verify-lazy-boundary.mjs        (npm run verify:boundary)
 *
 * Checked against `apps/guitar-codex/dist/`, which must already exist — run
 * `npm run build` first, or use `npm run verify` for both.
 *
 * Deliberately dependency-free and deliberately dumb: it greps the emitted
 * chunks for a marker string that only that feature's source can produce. A
 * cleverer check (parsing the module graph, diffing chunk manifests) would be
 * more precise and would rot. See docs/react-modular-architecture.md §31 and
 * §34.1, and §8 of docs/demoscene-integration.md.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const dist = fileURLToPath(new URL("../apps/guitar-codex/dist", import.meta.url));
const assets = join(dist, "assets");

/**
 * One marker per feature: a distinctive string that appears in that package's
 * source and nowhere in the host. If a marker is ever edited out of the
 * package, this check silently passes — so each one is picked from copy that
 * is part of the feature's identity rather than from an implementation detail.
 */
const FEATURES = [
  // `canvasLabel` is a field of the package's public `DemosceneMessages` type
  // and appears in all eleven of its message catalogues, so it cannot go away
  // without a deliberate contract change.
  { name: "@site/demoscene", marker: "canvasLabel", chunk: /^AboutDemoscene-.*\.js$/ },
  // The guestbook's default `storageNamespace` — a documented config default.
  { name: "@guitar-codex/guestbook", marker: "viper-guestbook", chunk: /^GuestbookOverlay-.*\.js$/ },
];

const problems = [];

if (!existsSync(assets)) {
  console.error(`no build to check at ${dist} — run \`npm run build\` first`);
  process.exit(2);
}

const files = readdirSync(assets);
const entryHtml = readFileSync(join(dist, "index.html"), "utf8");

/** The entry chunks: what every visitor downloads before anything is clicked. */
const entryChunks = [...entryHtml.matchAll(/(?:src|href)="[^"]*\/(assets\/[^"]+\.js)"/g)].map(
  (m) => m[1].replace("assets/", ""),
);

for (const { name, marker, chunk } of FEATURES) {
  // 1. The feature must have a chunk of its own at all. No chunk means either
  //    the seam was deleted or the feature was inlined somewhere.
  const own = files.filter((f) => chunk.test(f));
  if (own.length === 0) {
    problems.push(`${name}: no async chunk matching ${chunk} — is the seam still there?`);
    continue;
  }

  // 2. The marker must be inside that chunk. If it is not, the marker is stale
  //    and check 3 below is worthless.
  const inOwn = own.some((f) => readFileSync(join(assets, f), "utf8").includes(marker));
  if (!inOwn) {
    problems.push(
      `${name}: marker ${JSON.stringify(marker)} is not in ${own.join(", ")} — ` +
        `the marker is stale, so this check proves nothing. Pick a new one.`,
    );
  }

  // 3. The actual guard: the marker must NOT be in anything loaded at startup.
  for (const f of entryChunks) {
    if (!existsSync(join(assets, f))) continue;
    if (readFileSync(join(assets, f), "utf8").includes(marker)) {
      problems.push(
        `${name} is in the ENTRY chunk (assets/${f}).\n` +
          `      Something in the startup path imports it statically. Find it with\n` +
          `        grep -rn "${name}" apps/guitar-codex/src\n` +
          `      and move that import behind the Lazy*.ts boundary.`,
      );
    }
  }

  // 4. The entry HTML must not pull the chunk forward either — a modulepreload
  //    undoes the laziness just as thoroughly as a static import, and is even
  //    easier to introduce by accident.
  for (const f of own) {
    if (entryHtml.includes(f)) {
      problems.push(`${name}: index.html references assets/${f} — it is being preloaded, not deferred.`);
    }
  }
}

if (problems.length > 0) {
  console.error("lazy boundary broken:\n");
  for (const p of problems) console.error(`  ✕ ${p}\n`);
  process.exit(1);
}

const sizes = FEATURES.map(({ name, chunk }) => {
  const f = files.find((x) => chunk.test(x));
  const kb = (readFileSync(join(assets, f), "utf8").length / 1024).toFixed(0);
  return `${name} → assets/${f} (${kb} kB, async)`;
});
console.log(`lazy boundary intact:\n  ${sizes.join("\n  ")}`);
