import type { DocumentItem, EntryBundle } from "@/lib/types";
import { isExternalUrl, resolveResourcePath } from "@/lib/paths";
import { useI18n } from "@/lib/i18n";

/**
 * Documents tab — the documents[] array of MetaData.json.
 * `type` is an open set (TRANSCRIPT, DOSSIER, ARTICLE, …) → never hard-coded,
 * unknown types get the generic scroll treatment. Target semantics:
 * "embedded" | relative archive path | absolute URL (docs/MetaData.md).
 */
export function DocumentsTab({ bundle }: { bundle: EntryBundle }) {
  const { t } = useI18n();
  const docs = bundle.data?.documents ?? [];
  const sourceUrl = bundle.data?.metadata?.url;

  if (docs.length === 0 && !sourceUrl) {
    return <p className="text-center font-body italic text-sepia-600">{t("docs.empty")}</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {docs.map((d, i) => (
        <DocumentRow key={i} doc={d} />
      ))}

      {sourceUrl && (
        <a
          href={resolveResourcePath(sourceUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 border border-gold-600/50 bg-paper-100/70 px-4 py-3 no-underline transition-shadow hover:shadow-[0_2px_14px_rgba(138,106,31,0.3)]"
        >
          <TypeGlyph type="SOURCE" />
          <span className="min-w-0">
            <span className="block truncate font-heading text-sm tracking-wide text-burgundy-700">
              {t("docs.source")}
            </span>
            <span className="block truncate text-xs italic text-sepia-600">{sourceUrl}</span>
          </span>
        </a>
      )}
    </div>
  );
}

const TYPE_GLYPHS: Record<string, string> = {
  TRANSCRIPT: "𝄞",
  DOSSIER: "❖",
  ARTICLE: "❧",
  SOURCE: "✦",
};

function TypeGlyph({ type }: { type?: string }) {
  const glyph = TYPE_GLYPHS[(type ?? "").toUpperCase()] ?? "📜";
  return (
    <span
      aria-hidden
      className="grid h-11 w-11 shrink-0 place-items-center border border-gold-600/60 bg-paper-200/70 text-xl text-gold-800"
    >
      {glyph}
    </span>
  );
}

function DocumentRow({ doc }: { doc: DocumentItem }) {
  const { t } = useI18n();
  const embedded = doc.target === "embedded";
  const external = isExternalUrl(doc.target);
  const badge = embedded ? t("docs.embedded") : external ? t("docs.external") : t("docs.archive");

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

  return (
    <a
      href={resolveResourcePath(doc.target)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 border border-gold-600/50 bg-paper-100/70 px-4 py-3 no-underline transition-shadow hover:shadow-[0_2px_14px_rgba(138,106,31,0.3)]"
    >
      {body}
      <span className="btn-rpg !px-3 !py-1 !text-[0.65rem]">{t("docs.open")}</span>
    </a>
  );
}
