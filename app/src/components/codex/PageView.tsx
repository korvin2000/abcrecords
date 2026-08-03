import type { EntryBundle } from "@/lib/types";
import type { CatalogRecord } from "@/lib/catalog";
import { countryName } from "@/lib/metadata";
import { useI18n } from "@/lib/i18n";
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
 */
export function PageView({ record, bundle, onNavigateEntry }: Props) {
  const { t, locale } = useI18n();

  return (
    <>
      <CodexHeader
        kicker={t("codex.entry")}
        title={record.display}
        subtitleParts={[countryName(record.entry.country, locale)]}
      />

      <div className="min-h-[40vh]">
        {bundle === null ? (
          <CodexSkeleton />
        ) : (
          <CodexArticle bundle={bundle} missing="codex.notFound" onNavigateEntry={onNavigateEntry} />
        )}
      </div>
    </>
  );
}
