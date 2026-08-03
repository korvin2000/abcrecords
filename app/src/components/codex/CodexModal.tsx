import type { CatalogRecord } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n";
import { BiographyView } from "./BiographyView";
import { CodexShell } from "./CodexShell";
import { PageView } from "./PageView";
import { useCodexEntry } from "./useCodexEntry";

interface Props {
  record: CatalogRecord;
  onClose: () => void;
  /** Turn to the previous/next entry in the current (filtered) order. */
  onTurn: (dir: -1 | 1) => void;
  /** Open another entry from a cross-link inside an article. */
  onNavigateEntry: (slug: string) => void;
}

/**
 * The full-screen codex — Copendum's CharacterDetail as the base (parchment,
 * ornate double border, page-turn 3D open/close, filigree corner ornaments
 * shared with the catalogue cards).
 *
 * Two modes, chosen by what the catalogue *declares*, never by what a fetch
 * returned: an entry with a dossier is a biography (four tabs), one without
 * is a page (article only). See docs/Catalog-Index.md §7.
 */
export function CodexModal({ record, onClose, onTurn, onNavigateEntry }: Props) {
  const { lang } = useI18n();
  const { contentLang, setContentLang, bundle } = useCodexEntry(record, lang);

  const View = record.biography ? BiographyView : PageView;

  return (
    <CodexShell
      slug={record.slug}
      ariaLabel={record.display}
      langs={record.langs}
      contentLang={contentLang}
      onContentLang={setContentLang}
      onClose={onClose}
      onTurn={onTurn}
    >
      <View record={record} bundle={bundle} onNavigateEntry={onNavigateEntry} />
    </CodexShell>
  );
}
