import type { Plugin, ViteDevServer } from "vite";

/**
 * Keeps the dev server alive next to a very large, externally-edited content
 * tree.
 *
 * `publicDir` is the repository's `pages/` directory — today ~16 000 files
 * across eleven language editions, none of which is imported into the bundle.
 * Chokidar watches every one of them, which costs memory and startup time on
 * Windows and, worse, makes the dev server fatally sensitive to files it has
 * no business watching:
 *
 *     Error: EBUSY: resource busy or locked, watch 'C:\…\pages\FAR9E8B.tmp'
 *         at FSWatcher.<computed> (node:internal/fs/watchers)
 *     Emitted 'error' event on FSWatcher instance
 *
 * Any tool that writes a temporary file into `pages/` — an editor's atomic
 * save, an archiver, a content-generation script, a virus scanner holding a
 * handle open — creates a file the watcher tries to open and the OS refuses.
 * Chokidar re-emits that as `'error'`, nothing listens, and Node turns an
 * unhandled `'error'` event into a process-wide crash. A transient scratch
 * file takes the whole dev server down with it.
 *
 * Two independent guards, because either alone leaves a hole:
 *
 *  1. **Do not watch what cannot need watching.** The per-language content
 *     directories and every known scratch-file shape are excluded, so the
 *     watcher holds hundreds of handles instead of tens of thousands. The
 *     catalogue indexes at the root of `pages/` stay watched, so editing
 *     `index.json` still reloads the page.
 *  2. **Never die of a watch error.** An `'error'` listener on the watcher
 *     turns a fatal unhandled event into one warning line. This is the guard
 *     that matters: exclusion lists can always miss a path, and a dev server
 *     that survives is worth more than one that reports precisely.
 */
export function contentWatch(): Plugin {
  return {
    name: "content-watch",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.watcher.on("error", (error: unknown) => {
        const { code, path } = (error ?? {}) as { code?: string; path?: string };
        // Transient-file races are expected next to an edited content tree;
        // anything else is worth the stack, but neither may stop the server.
        if (code === "EBUSY" || code === "ENOENT" || code === "EPERM") {
          server.config.logger.warn(
            `[content-watch] ignored a ${code} while watching ${path ?? "an unknown path"}`,
          );
          return;
        }
        server.config.logger.error("[content-watch] watcher error", { error: error as Error });
      });
    },
  };
}

/** Scratch files that appear inside a content tree while it is being edited. */
const SCRATCH =
  /(?:^|[\\/])(?:~\$|\.~|\.#)|\.(?:tmp|temp|swp|swx|bak|crdownload|partial)$|(?:^|[\\/])\.DS_Store$/i;

/**
 * Chokidar matcher for paths the dev server must not watch. A function rather
 * than a glob: chokidar 4 dropped glob support, and a predicate reads the same
 * on both path separators.
 *
 * `dirs` are the per-language content directories, given as absolute paths.
 */
export function ignoreContent(dirs: readonly string[]): (path: string) => boolean {
  const prefixes = dirs.map(normalize);
  return (path: string) => {
    if (SCRATCH.test(path)) return true;
    const p = normalize(path);
    return prefixes.some((dir) => p === dir || p.startsWith(`${dir}/`));
  };
}

/** One spelling for both separators and for Windows' case-insensitive paths. */
function normalize(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}
