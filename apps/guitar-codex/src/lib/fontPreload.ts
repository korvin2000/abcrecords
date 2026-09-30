import garamondCyrillic from "@fontsource-variable/cormorant-garamond/files/cormorant-garamond-cyrillic-wght-normal.woff2?url";
import garamondLatin from "@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2?url";
import displayCyrillic from "@fontsource/cormorant-sc/files/cormorant-sc-cyrillic-700-normal.woff2?url";
import displayLatin from "@fontsource/cormorant-sc/files/cormorant-sc-latin-700-normal.woff2?url";
import type { Lang } from "./languages";

/**
 * Ask for the first screen's two faces before anything needs them.
 *
 * A web font is only requested once layout meets text that uses it — here,
 * after the entry chunk has run, the dictionary has arrived and React has
 * rendered. On a slow connection that puts the font a full round trip behind
 * the text it is for, and the title reflows when it lands. A `preload` issued
 * as the entry module starts runs that request alongside the dictionary and
 * the index instead.
 *
 * Two files, chosen by script: the body face and the 700 display face, in
 * Cyrillic for the two languages written in it and in Latin for every other
 * (a CJK reader's text comes from system fonts; the Latin subset still draws
 * the numerals and the wordmark). Preloading both scripts for everyone would
 * spend ~40 KB on faces half the readers never use — which is why this is
 * decided here, at run time, and not written into index.html.
 *
 * The `?url` imports resolve to the very files the @fontsource stylesheets
 * reference, so the preload and the later `@font-face` fetch are one request.
 */
export function preloadFonts(lang: Lang): void {
  const cyrillic = lang === "ru" || lang === "uk";
  for (const href of cyrillic ? [garamondCyrillic, displayCyrillic] : [garamondLatin, displayLatin]) {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "font";
    link.type = "font/woff2";
    link.href = href;
    // Fonts are always fetched in CORS mode; without this the preload is a
    // second, wasted download rather than the same one.
    link.crossOrigin = "anonymous";
    document.head.append(link);
  }
}
