/**
 * Turns a PDF into a directory of page images for the viewer's image reader.
 *
 *     node scripts/prerender-pdf.mjs <file.pdf> [more.pdf …] [--width 1100] [--quality 72] [--force]
 *     npm run prerender:pdf -- path/to/magazine/2017/IGvL_2(21)_2017.pdf
 *
 * For `…/issue.pdf` it writes, beside the file:
 *
 *     …/issue.pages/manifest.json     { v, source, bytes, width, rev, pages, sizes }
 *     …/issue.pages/p-001.jpg …       one JPEG per page, `--width` pixels wide
 *
 * Upload the `.pages` directory next to the PDF. The app finds it by name
 * (src/lib/pdf/pages.ts) and opens the issue as images on a machine graded
 * `low`, for any file over `PDF.liteOverBytes`, and whenever pdf.js cannot
 * open the PDF at all — with the full viewer one press away.
 *
 * Why this exists: reading a 40–60 MB scan with pdf.js on a small phone means
 * holding the file, decoding it at full resolution and painting it on the main
 * thread. A page image needs none of that, and works on browsers where pdf.js
 * cannot start (docs/performance-analysis.md §10.5). It is done here, offline,
 * rather than by a server script, so nothing can time out, no server extension
 * is needed, and what readers get is static files.
 *
 * No system tools required: it renders with the workspace's own pdf.js and
 * `@napi-rs/canvas` (an optional dependency of pdfjs-dist, installed with it).
 *
 * A directory that already holds a manifest for the same PDF size and width is
 * skipped; `--force` re-renders it.
 */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(new URL("../apps/guitar-codex/package.json", import.meta.url));
const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));
// The legacy build is the one documented for Node.
const { getDocument } = await import(pathToFileURL(join(pdfjsRoot, "legacy/build/pdf.mjs")).href);

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  if (at === -1) return fallback;
  const value = Number(args[at + 1]);
  args.splice(at, 2);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  if (at === -1) return false;
  args.splice(at, 1);
  return true;
};

const width = Math.round(option("width", 1100));
const quality = Math.min(95, Math.round(option("quality", 72)));
const force = flag("force");

if (args.length === 0) {
  console.error("usage: node scripts/prerender-pdf.mjs <file.pdf> [more.pdf …] [--width 1100] [--quality 72] [--force]");
  process.exit(2);
}

/** pdf.js reads its own data files from disk in Node; the trailing slash is
 *  part of the contract. */
const dataDir = (name) => `${join(pdfjsRoot, name).replace(/\\/g, "/")}/`;

let failed = 0;

for (const input of args) {
  const file = resolve(input);
  const outDir = file.replace(/\.pdf$/i, "") + ".pages";
  const label = basename(file);

  try {
    if (!/\.pdf$/i.test(file)) throw new Error("not a .pdf file");
    const { size: bytes, mtimeMs } = await stat(file);
    // Changes whenever the source PDF or the render width does; the viewer puts
    // it on every image URL, so re-rendered pages are never mixed with cached
    // ones of the same name.
    const rev = `${bytes}-${Math.floor(mtimeMs / 1000)}-${width}`;

    if (!force) {
      const known = await readFile(join(outDir, "manifest.json"), "utf8").then(JSON.parse, () => null);
      if (known && known.v === 1 && known.bytes === bytes && known.width === width) {
        console.log(`${label}: up to date (${known.pages} pages) — skipped`);
        continue;
      }
    }

    const doc = await getDocument({
      data: new Uint8Array(await readFile(file)),
      cMapUrl: dataDir("cmaps"),
      cMapPacked: true,
      standardFontDataUrl: dataDir("standard_fonts"),
      iccUrl: dataDir("iccs"),
      wasmUrl: dataDir("wasm"),
      verbosity: 0,
    }).promise;

    await mkdir(outDir, { recursive: true });
    const sizes = [];
    let total = 0;

    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / natural.width });
      const w = Math.round(viewport.width);
      const h = Math.round(viewport.height);

      // pdf.js's own Node canvas factory, so the canvas is one it knows how to
      // draw into (and to release).
      const target = doc.canvasFactory.create(w, h);
      await page.render({ canvas: target.canvas, canvasContext: target.context, viewport }).promise;
      const jpeg = target.canvas.toBuffer("image/jpeg", quality);
      doc.canvasFactory.destroy(target);
      page.cleanup();

      await writeFile(join(outDir, `p-${String(n).padStart(3, "0")}.jpg`), jpeg);
      sizes.push([w, h]);
      total += jpeg.length;
      process.stdout.write(`\r${label}: page ${n}/${doc.numPages}`);
    }

    await writeFile(
      join(outDir, "manifest.json"),
      `${JSON.stringify({ v: 1, source: label, bytes, width, rev, pages: sizes.length, sizes })}\n`,
    );
    await doc.destroy();

    process.stdout.write(
      `\r${label}: ${sizes.length} pages, ${(total / 1e6).toFixed(1)} MB of images (PDF ${(bytes / 1e6).toFixed(1)} MB) → ${outDir}\n`,
    );
  } catch (error) {
    failed += 1;
    process.stdout.write("\n");
    console.error(`${label}: FAILED — ${error instanceof Error ? error.message : error}`);
  }
}

process.exit(failed ? 1 : 0);
