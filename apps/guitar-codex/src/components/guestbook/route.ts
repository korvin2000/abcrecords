/**
 * The one hash route that is **not** a catalogue entry.
 *
 * `useHashRoute` reads `#/{slug}` and hands the slug to `App`, which normally
 * looks it up in the index. This slug is reserved: it opens the guestbook
 * instead, and `App` resolves it before it ever reaches `catalog.bySlug`.
 *
 * The consequence for content: **no `index.json` row may use "guestbook" as
 * its slug** — i.e. no `md`/`pdf` path whose basename is `guestbook`. Such a
 * row would stay in the grid and in the search, but its route would open the
 * visitors' book instead of the entry. It is the only name in the catalogue's
 * whole address space that is spoken for (docs/Catalog-Index.md, routing).
 *
 * Its own file, and not a constant in `App.tsx`, so that `SiteFooter` can link
 * to it without importing anything that reaches the guestbook package.
 */
export const GUESTBOOK_SLUG = "guestbook";
