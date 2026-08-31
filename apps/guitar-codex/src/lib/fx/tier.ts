/**
 * How much decoration this machine can afford — measured once per tab, off the
 * critical path, and only ever used to scale ornament *down*. Nothing a reader
 * needs depends on the answer, so a wrong guess costs a few glyphs, never a
 * feature.
 *
 * This grades **hardware only**. "Reduce motion" is a stated preference, not a
 * capability, and the two must not be folded together: doing so once made a
 * fast machine report `low`, which silently zeroed every ornament *and* left
 * the reader's on/off switch with nothing to change. `prefersReducedMotion` is
 * exported for the store to read as its own separate axis.
 *
 * Three signals, cheapest first:
 *
 *   1. **Static hints** (free, synchronous) — reduced-motion, Save-Data, core
 *      count, device memory. Enough to pick a safe starting grade before the
 *      first paint, so the page never mounts a heavy layer it must then tear
 *      down.
 *   2. **An arithmetic probe** with a *fixed time budget and variable work*.
 *      Timing fixed work is the usual mistake: the slower the device, the
 *      longer you block it. This blocks every device for the same few
 *      milliseconds and reads the answer off the work completed.
 *   3. **A paint probe** — the median of a short run of `requestAnimationFrame`
 *      deltas. It cannot tell a fast machine from a very fast one (both idle at
 *      the display's refresh rate), so it is used only to catch a device that is
 *      already dropping frames.
 *
 * The grade is cached per tab session: device capability does not change while
 * a page is open, and a reload is the natural way to re-measure.
 */

export type PerfTier = "low" | "mid" | "high";

const CACHE_KEY = "codex-fx-tier";

/** Milliseconds the arithmetic probe is allowed to hold the main thread. */
const CPU_BUDGET_MS = 4;
/** Iterations between clock reads — the clock is pricier than the work. */
const CPU_CHUNK = 4096;
/** Thousand hash rounds per millisecond. A 2024 laptop clears the first bar
 *  comfortably; a budget phone lands under the second. Tunable — the only
 *  consequence of moving them is glyph count. */
const CPU_FAST = 150;
const CPU_OK = 55;

/** rAF deltas sampled by the paint probe (~0.3 s at 60 Hz). */
const FRAMES = 18;
/** Median frame delta, in ms: 60 Hz with headroom, and merely keeping up. */
const FRAME_SMOOTH = 19;
const FRAME_OK = 27;
/** A tab that never paints (backgrounded before we got to it) resolves neutral
 *  rather than hanging the probe. */
const FRAME_TIMEOUT_MS = 1500;

/** The probe's hash carries across calls, so its result is genuinely live and
 *  no engine can delete the loop as dead code. */
let sink = 0x811c9dc5;

interface CapabilityHints {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

function hints(): CapabilityHints {
  return navigator as unknown as CapabilityHints;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * The grade to start at, from hints that cost nothing to read — so a grade
 * exists before the first paint and the probe only ever adjusts it.
 */
export function staticTier(): PerfTier {
  const { hardwareConcurrency: cores = 4, deviceMemory: memory = 4, connection } = hints();
  if (connection?.saveData) return "low";
  if (cores <= 2 || memory <= 2) return "low";
  if (cores >= 8 && memory >= 8) return "high";
  return "mid";
}

/** Hash rounds per millisecond, at a fixed cost to the caller. */
function cpuScore(): number {
  let h = sink;
  for (let i = 0; i < CPU_CHUNK; i++) h = Math.imul(h ^ i, 0x01000193); // warm the JIT

  const deadline = performance.now() + CPU_BUDGET_MS;
  let rounds = 0;
  do {
    for (let i = 0; i < CPU_CHUNK; i++) h = Math.imul(h ^ i, 0x01000193);
    rounds += CPU_CHUNK;
  } while (performance.now() < deadline);

  sink = h;
  return rounds / CPU_BUDGET_MS / 1000;
}

/** Median frame delta over a short run — "is this device keeping up right now". */
function frameScore(): Promise<number> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    let last = performance.now();
    const done = window.setTimeout(() => resolve(FRAME_SMOOTH), FRAME_TIMEOUT_MS);

    const tick = (now: number) => {
      deltas.push(now - last);
      last = now;
      if (deltas.length < FRAMES) {
        requestAnimationFrame(tick);
        return;
      }
      clearTimeout(done);
      deltas.sort((a, b) => a - b);
      resolve(deltas[deltas.length >> 1]);
    };
    requestAnimationFrame(tick);
  });
}

/** Four signals, weighted, then cut into three grades. */
function grade(cpu: number, frame: number): PerfTier {
  const { hardwareConcurrency: cores = 4, deviceMemory: memory = 4 } = hints();
  let score = 0;
  score += cpu >= CPU_FAST ? 2 : cpu >= CPU_OK ? 1 : 0;
  score += frame <= FRAME_SMOOTH ? 2 : frame <= FRAME_OK ? 1 : 0;
  score += cores >= 8 ? 1 : cores >= 4 ? 0 : -1;
  score += memory >= 8 ? 1 : memory >= 4 ? 0 : -1;
  return score >= 5 ? "high" : score >= 2 ? "mid" : "low";
}

function readCache(): PerfTier | null {
  try {
    const value = sessionStorage.getItem(CACHE_KEY);
    return value === "low" || value === "mid" || value === "high" ? value : null;
  } catch {
    return null; // private mode
  }
}

function writeCache(tier: PerfTier): void {
  try {
    sessionStorage.setItem(CACHE_KEY, tier);
  } catch {
    /* ignore */
  }
}

/** Yield until the browser has nothing better to do (bounded, so a tab that
 *  never idles still gets measured). */
function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(() => resolve(), { timeout: 600 });
    else setTimeout(resolve, 300);
  });
}

let pending: Promise<PerfTier> | null = null;

/** The measured grade. Runs at most once per tab; every caller shares the
 *  same promise. */
export function measureTier(): Promise<PerfTier> {
  return (pending ??= run());
}

async function run(): Promise<PerfTier> {
  const cached = readCache();
  if (cached) return cached;

  await whenIdle();
  const tier = grade(cpuScore(), await frameScore());
  writeCache(tier);
  return tier;
}
