import { useState } from "react";
import type { CatalogRecord } from "@/lib/catalog";
import type { Lang } from "@/lib/languages";
import { useI18n } from "@/lib/i18n";
import { BiographyView } from "./BiographyView";
import { CodexShell } from "./CodexShell";
import type { CodexTab } from "./CodexTabs";
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
  const { lang, setLang } = useI18n();
  const { contentLang, setContentLang, bundle } = useCodexEntry(record, lang);

  // Which tab a biography is open to. Lifted up here — above the `key`ed view
  // below — so a ← → turn (which changes `record` in place, not this
  // component) keeps the reader on the tab they were reading: leafing from
  // the Gallery tab of one entry lands on the Gallery tab of the next, every
  // biography sharing the same four tabs. Every four tabs exist on every
  // biography, so "does the tab exist on the new page" only ever fails when
  // the new entry is a page (no tab bar) — nothing to preserve there. A fresh
  // open from the grid unmounts this whole component, so it always starts
  // back on "biography".
  const [tab, setTab] = useState<CodexTab>("biography");

  // The codex's own language menu used to change only the edition being
  // read, leaving the UI chrome in whatever language the reader had before —
  // a book and its wrapper in two different tongues, with no way to tell
  // which one "the" language even was. Picking an edition here now moves the
  // reader's UI language too, the same as the header menu would.
  const handleContentLang = (l: Lang) => {
    setContentLang(l);
    setLang(l);
  };

  return (
    <CodexShell
      slug={record.slug}
      ariaLabel={record.display}
      langs={record.langs}
      contentLang={contentLang}
      onContentLang={handleContentLang}
      onClose={onClose}
      onTurn={onTurn}
    >
      {/* The shell survives a ← → turn; the page inside it does not. Keying
          here is what replays the leaf-through on every turn without
          dragging the backdrop and the panel through a remount as well —
          `tab` above is what then keeps the *content* of that leaf where the
          reader left it. */}
      {record.biography ? (
        <BiographyView
          key={record.slug}
          record={record}
          bundle={bundle}
          onNavigateEntry={onNavigateEntry}
          tab={tab}
          onTabChange={setTab}
        />
      ) : (
        <PageView key={record.slug} record={record} bundle={bundle} onNavigateEntry={onNavigateEntry} />
      )}
    </CodexShell>
  );
}
