import { useDeferredValue } from "react";
import type { BioDoc } from "@/lib/biomd/parse";
import type { MsgKey } from "@/lib/messages";
import { BioArticle } from "@/lib/biomd/BioArticle";
import { useI18n } from "@/lib/i18n";
import { perfTier } from "@/lib/fx";
import { CodexSkeleton } from "./CodexSkeleton";

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

  // Rendering an article is the heaviest synchronous work the codex does — a
  // Markdown pipeline per prose block — and it used to run in the very commit
  // that starts the opening animation. On a machine that is not fast, the
  // article is handed to React as a *deferred* value instead: the book opens
  // on a skeleton, and the article renders behind it in slices that yield to
  // the frame. A fast machine keeps the one-commit path, which is what makes a
  // ← → turn between visited entries paint in a single frame.
  const deferred = useDeferredValue(doc, null);
  const shown = perfTier() === "high" ? doc : deferred;

  if (!doc) {
    return <p className="text-center font-body italic text-sepia-600">{t(missing)}</p>;
  }

  // Not the previous entry's article under the new entry's name: until the
  // deferred render lands, the page is honestly empty.
  if (shown !== doc) {
    return (
      <div className="bio-measure" aria-busy="true">
        <CodexSkeleton />
      </div>
    );
  }

  // `.bio-measure` is both the reading measure and the query container every
  // rule inside the article asks (index.css).
  return (
    <div className="bio-measure">
      <BioArticle doc={doc} titles={titles} onNavigateEntry={onNavigateEntry} />
    </div>
  );
}
