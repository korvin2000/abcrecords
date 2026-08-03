import { useState } from "react";
import type { EntryBundle } from "@/lib/types";
import type { CatalogRecord } from "@/lib/catalog";
import { isListed } from "@/lib/entry";
import { countryName, yearOf } from "@/lib/metadata";
import { typeLabel, useI18n } from "@/lib/i18n";
import { CodexArticle } from "./CodexArticle";
import { CodexHeader } from "./CodexHeader";
import { CodexSkeleton } from "./CodexSkeleton";
import { CodexTabs, type CodexTab } from "./CodexTabs";
import { DocumentsTab } from "./tabs/DocumentsTab";
import { GalleryTab } from "./tabs/GalleryTab";
import { LoreTab } from "./tabs/LoreTab";

interface Props {
  record: CatalogRecord;
  /** null while the edition loads. */
  bundle: EntryBundle | null;
  onNavigateEntry: (slug: string) => void;
}

/**
 * An entry with a dossier: the name plate plus the four tabs.
 *
 * The name comes from the *edition being read*, so switching the entry's
 * language re-titles the header — dossiers are authored per language. Until
 * the dossier lands the catalogue's localized name stands in on one line;
 * that reflow is normally invisible, because opening a card starts the fetch
 * before this ever mounts.
 */
export function BiographyView({ record, bundle, onNavigateEntry }: Props) {
  const { t, locale } = useI18n();
  // Reset is by remount: App keys the modal on the slug, so turning the page
  // mounts a fresh view already on the Biography tab.
  const [tab, setTab] = useState<CodexTab>("biography");

  const { entry, display } = record;
  const meta = bundle?.data?.metadata;
  // comma-lists (the project-team roster) get breathing room to wrap
  const forename = (meta?.forename ?? "").replace(/,\s*/g, ", ") || display;
  const born = yearOf(meta?.dates?.born);
  const died = yearOf(meta?.dates?.died);

  return (
    <>
      <CodexHeader
        kicker={t("codex.entry")}
        title={forename}
        secondary={meta?.surname}
        subtitleParts={[
          isListed(entry) ? typeLabel(t, entry.type) : null,
          countryName(entry.country, locale),
          born ? `${born} — ${died ?? "…"}` : null,
        ]}
      />

      <CodexTabs value={tab} onChange={setTab} />

      {/* leaf-through on switch */}
      <div key={tab} className="leaf-in min-h-[40vh]">
        {bundle === null ? (
          <CodexSkeleton />
        ) : (
          <TabBody tab={tab} record={record} bundle={bundle} onNavigateEntry={onNavigateEntry} />
        )}
      </div>
    </>
  );
}

function TabBody({
  tab,
  record,
  bundle,
  onNavigateEntry,
}: {
  tab: CodexTab;
  record: CatalogRecord;
  bundle: EntryBundle;
  onNavigateEntry: (slug: string) => void;
}) {
  switch (tab) {
    case "gallery":
      return <GalleryTab record={record} bundle={bundle} />;
    case "documents":
      return <DocumentsTab bundle={bundle} />;
    case "lore":
      return <LoreTab entry={record.entry} bundle={bundle} />;
    default:
      return <CodexArticle bundle={bundle} missing="bio.missing" onNavigateEntry={onNavigateEntry} />;
  }
}
