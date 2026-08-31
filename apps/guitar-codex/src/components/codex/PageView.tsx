import type { EntryBundle } from "@/lib/types";
import type { CatalogRecord } from "@/lib/catalog";
import { countryName } from "@/lib/metadata";
import { useI18n } from "@/lib/i18n";
import { planHeadings } from "@/lib/biomd/headings";
import { useBioDoc } from "@/lib/biomd/useBioDoc";
import { CodexArticle } from "./CodexArticle";
import { CodexHeader } from "./CodexHeader";
import { CodexSkeleton } from "./CodexSkeleton";

interface Props {
  record: CatalogRecord;
  /** null while the edition loads. */
  bundle: EntryBundle | null;
  onNavigateEntry: (slug: string) => void;
}

/**
 * An entry that declares no dossier — "About", "Sources", a continuation
 * page. Header and article only: no tab bar, and none of the empty dossier
 * rows that would otherwise stand in for data that was never meant to exist
 * (docs/Biography_card_Design.md, "Codex Modes").
 *
 * A page has no dossier to be named by, so its plate takes the article's own
 * `# ` line(s) — both of them, when the document spells its title over two —
 * and falls back to the catalogue's localized name while the edition loads
 * (see lib/biomd/headings.ts).
 */
export function PageView({ record, bundle, onNavigateEntry }: Props) {
  const { t, locale } = useI18n();
  const doc = useBioDoc(bundle?.md);
  const heading = planHeadings(doc?.titles ?? [], {}, record.display);

  return (
    <>
      <CodexHeader
        kicker={t("codex.entry")}
        title={heading.title}
        secondary={heading.secondary}
        subtitleParts={[countryName(record.entry.country, locale)]}
      />

      <div className="min-h-48">
        {bundle === null ? (
          <CodexSkeleton />
        ) : (
          <CodexArticle
            doc={doc}
            titles={heading.articleTitles}
            missing="codex.notFound"
            onNavigateEntry={onNavigateEntry}
          />
        )}
      </div>
    </>
  );
}
