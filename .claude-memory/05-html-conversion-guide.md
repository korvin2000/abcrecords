# 05 · Legacy HTML → BioMD Lite Conversion

**Source of truth:**
[`docs/HTML-to-BioMD-Lite-Conversion-Guide.md`](../docs/HTML-to-BioMD-Lite-Conversion-Guide.md)
plus the "HTML Migration Rules" section of
[`docs/Biography-Markup.md`](../docs/Biography-Markup.md).

## Golden rule

> Preserve the **meaning and article structure**, not the original HTML
> implementation. The result must read as plain Markdown even without the engine.

Legacy pages already handled include `authors.htm`, `barrios.htm`, `jovicic.htm`
(nested-table layouts from `guitar-times.ru`).

## Preserve

Title & section headings · paragraphs (original order) · bold/italic ·
quotations · meaningful images + captions · links · downloadable/embedded docs ·
real data tables · album/recording info · footnotes & editorial notes.

## Remove

Menus, counters, ads, site headers/footers · JS & inline handlers · CSS / inline
styles · PHP fragments · copy-protection handlers · decorative/spacer images ·
empty elements · backgrounds · exact colors, fonts, margins, pixel coordinates ·
site-wide legal notices.

## Element mapping

| Legacy HTML | BioMD Lite |
|---|---|
| `<h1>`–`<h3>` | `#`, `##`, `###` |
| `<p>` | paragraph (blank-line separated) |
| `<strong>`/`<b>`, `<em>`/`<i>` | `**bold**`, `*italic*` |
| `<blockquote>` / embedded quote | `>` block quote (`— Author, date`) |
| `<a>` | Markdown link |
| single `<img>` | `::: image` block |
| adjacent images | `::: images` block |
| PDF/file link | `::: document` block |
| real data table | Markdown table |
| **layout** table | normal flow, floating image, or `::: columns` |
| repeated `<br>` | paragraph boundary |
| inline color | `==highlight==` only if semantically important |

**Image position:** `align/float:left`→`left`, `right`→`right`, centered→`center`,
wide/article-width→`center` or `full`.
**Image size:** small cover→`small`, normal portrait→`medium`, large standalone→
`large`, article-width→`full` (exact px discarded).

## Main-article detection

Locate visible title → find central content cell below it → keep the main
biography block → stop before bottom menu/counters/footer. Exclude repeated
site-wide elements even when visually near the article.

## Missing assets

Referenced local images that weren't provided → replace with **external
placeholders**, preserving role, approx aspect ratio, position, caption,
structure. Placeholders are **temporary** — flag for replacement with real local
assets.

## Recommended source order

1 title · 2 opening portrait · 3 biography paragraphs · 4 quotations ·
5 standalone images · 6 recordings/album sections · 7 documents & media links ·
8 related article links. Visual positioning must not override this order.

## Migration algorithm (condensed)

Parse DOM → strip scripts/styles/menus/counters/ads/footer → find article
container → extract title → traverse in source order → text→paragraphs,
images→directives, group adjacent images, layout tables→flow/columns, data
tables→Markdown tables → preserve links/media → mark missing assets → normalize
whitespace/encoding → write UTF-8 `.bio.md` → **structural validation** → human
editorial review.

## Validation (structural, per file)

Main title present · valid UTF-8 · no `<script>` / `<style>` / raw HTML tables ·
balanced `:::` fences · article links & media refs preserved. This is structural,
**not** a semantic or link-availability check — a human review is still required
(spelling/transcription, hyphenation, captions, broken links, track titles, etc.).
