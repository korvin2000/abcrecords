import type { BioDoc } from "@/lib/biomd/parse";
import type { MsgKey } from "@/lib/messages";
import { BioArticle } from "@/lib/biomd/BioArticle";
import { useI18n } from "@/lib/i18n";

/**
 * The entry's article in the edition being read — the body of the Biography
 * tab and the entire body of a page. One renderer for both, because they are
 * the same thing; only the "not written yet" wording differs, so the caller
 * names the message.
 *
 * The document arrives parsed: the view above has already read its title lines
 * to build the plate, and `titles` is whatever the plate left for the article
 * to print itself (see lib/biomd/headings.ts).
 */
export function CodexArticle({
  doc,
  titles,
  missing,
  onNavigateEntry,
}: {
  doc: BioDoc | null;
  titles?: readonly string[];
  missing: MsgKey;
  onNavigateEntry: (slug: string) => void;
}) {
  const { t } = useI18n();

  if (!doc) {
    return <p className="text-center font-body italic text-sepia-600">{t(missing)}</p>;
  }

  // `.bio-measure` is both the reading measure and the query container every
  // rule inside the article asks (index.css).
  return (
    <div className="bio-measure">
      <BioArticle doc={doc} titles={titles} onNavigateEntry={onNavigateEntry} />
    </div>
  );
}
