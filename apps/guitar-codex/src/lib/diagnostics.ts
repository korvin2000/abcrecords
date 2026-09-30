import { DIAGNOSTICS } from "@/config";
import { resolveSitePath } from "./paths";

/**
 * Failures the app could not recover from, said out loud.
 *
 * The catalogue used to keep them to itself: a document that would not open
 * showed a sentence and threw the reason away, and a render that failed logged
 * in development only. That is how "PDFs do not open on Android" stayed a
 * guess about file sizes for as long as it did — the engine knew exactly what
 * was wrong, on a phone nobody could plug into (docs/performance-analysis.md
 * §3.1).
 *
 * So: one line in the console, in production too, and — when an endpoint is
 * configured — one small report to `server/log.php`. What failed, the engine's
 * own message, the page it happened on. No cookies, nothing about the reader;
 * the server adds the user-agent string, which is the part worth having.
 */

type Extra = Readonly<Record<string, string | number | boolean>>;

let sent = 0;

/** An error's name and message, whatever was actually thrown. */
export function describeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name || "Error", message: error.message };
  if (typeof error === "string") return { name: "Error", message: error };
  try {
    return { name: "Error", message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { name: "Error", message: String(error) };
  }
}

/**
 * Report a failure. Never throws and never waits: a diagnostic that can break
 * the thing it is diagnosing is worse than none.
 *
 * @param where A short, stable tag — `pdf.open`, `pdf.page`, `boundary.codex`.
 */
export function reportProblem(where: string, error: unknown, extra?: Extra): void {
  const { name, message } = describeError(error);
  console.error(`[${where}] ${name}: ${message}`, extra ?? "");

  if (!DIAGNOSTICS.endpoint || sent >= DIAGNOSTICS.maxPerLoad) return;
  sent += 1;

  try {
    const body = JSON.stringify({
      where,
      name,
      message,
      page: window.location.hash.slice(0, 200),
      lang: document.documentElement.lang,
      extra,
    });
    const url = resolveSitePath(DIAGNOSTICS.endpoint);
    // A beacon survives the page being closed on the way out, which is when a
    // reader who just saw an error tends to leave.
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url, body)) return;
    void fetch(url, { method: "POST", body, keepalive: true, credentials: "omit" }).catch(() => undefined);
  } catch {
    /* reporting is best-effort */
  }
}
