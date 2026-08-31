/**
 * How wide is a classic scrollbar track, in CSS pixels?
 *
 * The codex's floating control row has to stop before the reading pane's
 * scrollbar, and there is no CSS expression for "the width of that track".
 * The number is not a constant either: it is the platform's, it differs
 * between engines (Chromium 15, Firefox/Windows 17), and it is **zero** where
 * scrollbars overlay the content (macOS, iOS, Android).
 *
 * So it is measured, once, from a probe styled exactly like the real pane —
 * `.codex-scroll` sets `scrollbar-width`/`scrollbar-color`, and those change
 * the answer — and published as `--codex-scrollbar` for the stylesheet to use.
 * The CSS keeps a sane fallback, so a failure here is a few pixels, not a bug.
 *
 * Note which class the probe wears: `.codex-scroll` is the scrollbar alone.
 * `.codex-pane` (the reading pane's position and padding) must stay off it, or
 * the probe measures a box that is absolutely positioned and 20 px padded.
 */
export function publishScrollbarWidth(): void {
  const probe = document.createElement("div");
  probe.className = "codex-scroll";
  probe.style.cssText = "position:absolute;top:-9999px;left:-9999px;width:100px;height:100px;overflow-y:scroll;visibility:hidden";
  probe.appendChild(document.createElement("div")).style.height = "300px";
  document.body.appendChild(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  document.documentElement.style.setProperty("--codex-scrollbar", `${width}px`);
}
