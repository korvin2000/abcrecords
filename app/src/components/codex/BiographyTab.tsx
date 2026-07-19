import type { EntryBundle } from "@/lib/types";
import { BioArticle } from "@/lib/biomd/BioArticle";
import { useI18n } from "@/lib/i18n";

export function BiographyTab({
  bundle,
  onNavigateEntry,
}: {
  bundle: EntryBundle;
  onNavigateEntry: (mdPath: string) => void;
}) {
  const { t } = useI18n();

  if (!bundle.md) {
    return <p className="text-center font-body italic text-sepia-600">{t("bio.missing")}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BioArticle source={bundle.md} onNavigateEntry={onNavigateEntry} />
    </div>
  );
}
