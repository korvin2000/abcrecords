import type { CatalogRecord } from "@/lib/catalog";
import type { DocumentItem, EntryBundle } from "@/lib/types";
import { FEATURES } from "@/config";
import { isExternalUrl, resolveResourcePath } from "@/lib/paths";
import { audio } from "@/lib/audio";
import { useI18n } from "@/lib/i18n";
import { isImageUrl, useImageViewer } from "@/lib/imageViewer";
import { isAsciiTabUrl } from "@/lib/asciiTab";
import { useAsciiTabViewer } from "@/lib/asciiTabViewer";
import { isViewablePdf, usePdfViewer } from "@/lib/pdfViewer";
import { Glyph } from "@/components/Glyph";
import { SIGN } from "@/lib/signs";
import { GUESTBOOK_SLUG, preloadGuestbookOverlay } from "@/components/guestbook";

/**
 * Documents tab — the documents[] array of MetaData.json.
 * `type` is an open set (TRANSCRIPT, DOSSIER, ARTICLE, …) → never hard-coded,
 * unknown types get the generic scroll treatment. Target semantics:
 * "embedded" | relative archive path | absolute URL (docs/MetaData.md).
 *
 * Two rows are not from the dossier at all and are on **every** entry: a way
 * to write to the authors about this page, and the page's own original on the
 * legacy site. They are drawn exactly like the documents above them, because
 * that is what they are from the reader's side — two more things this entry
 * lets you open. The tab is therefore never empty — the "no scrolls are
 * attached" line it used to fall back to has gone with the case that produced
 * it.
 */
export function DocumentsTab({ record, bundle }: { record: CatalogRecord; bundle: EntryBundle }) {
  const docs = bundle.data?.documents ?? [];
  const sourceUrl = bundle.data?.metadata?.url;

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {docs.map((d, i) => (
        <DocumentRow key={i} doc={d} />
      ))}

      {sourceUrl && <SourceRow url={sourceUrl} />}

      <StandingRows slug={record.slug} />
    </div>
  );
}

/** The shared plate every row in this tab is drawn on. One constant, because
 *  a row may be an `<a>`, a `<button>` or an inert `<div>` depending on what
 *  its target turns out to be, and the three must be indistinguishable. */
const ROW_CLASS =
  "flex w-full items-center gap-4 border border-gold-600/50 bg-paper-100/70 px-4 py-3 text-left no-underline transition-shadow hover:shadow-[0_2px_14px_rgba(138,106,31,0.3)]";

/** One mark per document kind, and the face that carries it. `type` is an open
 *  set (docs/MetaData.md), so an unknown kind falls through to the scroll —
 *  the one deliberate pictograph in the chrome, which is why it is the one
 *  entry drawn from the colour face. CONTACT and ORIGINAL are this tab's own
 *  two standing rows; they are named here so they are drawn by the same rule
 *  as everything else in the list. */
const TYPE_GLYPHS: Record<string, { char: string; font: string }> = {
  TRANSCRIPT: { char: SIGN.clef, font: "var(--font-music)" },
  DOSSIER: { char: SIGN.dossier, font: "var(--font-symbol)" },
  ARTICLE: { char: SIGN.article, font: "var(--font-symbol)" },
  SOURCE: { char: SIGN.source, font: "var(--font-symbol)" },
  CONTACT: { char: SIGN.mail, font: "var(--font-symbol)" },
  ORIGINAL: { char: SIGN.article, font: "var(--font-symbol)" },
};

const UNKNOWN_TYPE = { char: SIGN.scroll, font: "var(--font-emoji)" };

function TypeGlyph({ type }: { type?: string }) {
  const { char, font } = TYPE_GLYPHS[(type ?? "").toUpperCase()] ?? UNKNOWN_TYPE;
  return (
    <span
      aria-hidden
      className="grid h-11 w-11 shrink-0 place-items-center border border-gold-600/60 bg-paper-200/70 text-gold-800"
    >
      {/* Five marks from three different faces, none of them in the text
          fonts. `text-xl` sized whichever face Windows happened to load and
          left the rest to chance — a clef a fifth larger on Android, sitting
          low in its plate. Measured instead; see lib/glyph.ts. */}
      <Glyph char={char} font={font} size="1.3rem" />
    </span>
  );
}

/** Title over one line of small italic detail — the body of every row here. */
function RowText({ label, detail }: { label: string; detail: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block font-heading text-sm tracking-wide text-burgundy-700">{label}</span>
      <span className="block truncate text-xs italic text-sepia-600">{detail}</span>
    </span>
  );
}

function DocumentRow({ doc }: { doc: DocumentItem }) {
  const { t } = useI18n();
  const openImage = useImageViewer();
  const openTab = useAsciiTabViewer();
  const openPdf = usePdfViewer();
  const embedded = doc.target === "embedded";
  const external = isExternalUrl(doc.target);
  const badge = embedded ? t("docs.embedded") : external ? t("docs.external") : t("docs.archive");
  const href = resolveResourcePath(doc.target);

  const body = (
    <>
      <TypeGlyph type={doc.type} />
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-sm tracking-wide text-burgundy-700">{doc.label}</span>
        <span className="block text-xs italic text-sepia-600">
          {doc.type && <span className="mr-2 uppercase tracking-wider text-gold-800">{doc.type}</span>}
          {badge}
        </span>
      </span>
    </>
  );

  if (embedded) {
    return <div className="flex items-center gap-4 border border-gold-600/50 bg-paper-100/70 px-4 py-3">{body}</div>;
  }

  // Which in-app viewer this target belongs to, if any. A PDF is read on the
  // codex's own desk like everything else here — it used to be the one archive
  // file the app knew how to render and still handed to the browser.
  const viewer = isImageUrl(doc.target)
    ? () => openImage({ src: href, alt: doc.label, caption: doc.label })
    : isAsciiTabUrl(doc.target)
      ? () => openTab({ src: href, label: doc.label, download: filename(doc.target) })
      : isViewablePdf(doc.target)
        ? () => openPdf({ src: href, title: doc.label, download: filename(doc.target) })
        : null;

  if (viewer) {
    return (
      <button type="button" onClick={viewer} className={ROW_CLASS}>
        {body}
        <span className="btn-rpg !px-3 !py-1 !text-[0.65rem]">{t("docs.open")}</span>
      </button>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={ROW_CLASS}>
      {body}
      <span className="btn-rpg !px-3 !py-1 !text-[0.65rem]">{t("docs.open")}</span>
    </a>
  );
}

function SourceRow({ url }: { url: string }) {
  const { t } = useI18n();
  const openTab = useAsciiTabViewer();
  const openPdf = usePdfViewer();
  const href = resolveResourcePath(url);
  const body = (
    <>
      <TypeGlyph type="SOURCE" />
      <RowText label={t("docs.source")} detail={url} />
    </>
  );

  // A primary source is very often somebody else's site, and just as often a
  // scan of a page from it — the second opens here, the first in a tab.
  const viewer = isAsciiTabUrl(url)
    ? () => openTab({ src: href, label: filename(url), download: filename(url) })
    : isViewablePdf(url)
      ? () => openPdf({ src: href, title: t("docs.source"), download: filename(url) })
      : null;

  return viewer ? (
    <button type="button" onClick={viewer} className={ROW_CLASS}>
      {body}
    </button>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={ROW_CLASS}>
      {body}
    </a>
  );
}

/**
 * The two rows every entry has, whatever its dossier contains.
 *
 * **Contact** is a plain `#/guestbook` link and nothing more: that is the
 * reserved route (components/guestbook/route.ts), so the hash router closes
 * the codex and opens the visitors' book by itself — no callback has to be
 * threaded down four components to say so. It is skipped entirely when the
 * feature is off, since the route would then resolve to nothing.
 *
 * **Original** is this page as it stood on the legacy site: the slug with
 * `.htm` in place of `.bio.md`, resolved against the resource base like every
 * other archive target, so it is `/pages/{slug}.htm` in the default deployment
 * and follows `VITE_RESOURCE_BASE_PATH` wherever the archive actually lives.
 * Relative on purpose — an absolute `https://www.abc-guitars.com/...` would
 * send a reader of a staging or offline copy to the live site instead of to
 * the copy in front of them, which is exactly the comparison this row exists
 * to make possible.
 */
function StandingRows({ slug }: { slug: string }) {
  const { t } = useI18n();
  const original = `${slug}.htm`;
  const originalHref = resolveResourcePath(original);

  return (
    <>
      {FEATURES.guestbook && (
        <a
          href={`#/${GUESTBOOK_SLUG}`}
          onPointerEnter={preloadGuestbookOverlay}
          onFocus={preloadGuestbookOverlay}
          onClick={() => audio.click()}
          className={ROW_CLASS}
        >
          <TypeGlyph type="CONTACT" />
          <RowText label={t("docs.contactAuthors")} detail={t("footer.guestbook")} />
        </a>
      )}

      <a href={originalHref} target="_blank" rel="noopener noreferrer" className={ROW_CLASS}>
        <TypeGlyph type="ORIGINAL" />
        <RowText label={t("docs.original")} detail={originalHref} />
      </a>
    </>
  );
}

function filename(url: string): string {
  return url.split(/[?#]/, 1)[0].split("/").pop() || "tablature.txt";
}
