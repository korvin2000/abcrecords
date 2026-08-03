import type { EntryBundle } from "@/lib/types";
import type { MsgKey } from "@/lib/messages";
import { BioArticle } from "@/lib/biomd/BioArticle";
import { useI18n } from "@/lib/i18n";

/**
 * The entry's article in the edition being read — the body of the Biography
 * tab and the entire body of a page. One renderer for both, because they are
 * the same thing; only the "not written yet" wording differs, so the caller
 * names the message.
 */
export function CodexArticle({
  bundle,
  missing,
  onNavigateEntry,
}: {
  bundle: EntryBundle;
  missing: MsgKey;
  onNavigateEntry: (slug: string) => void;
}) {
  const { t } = useI18n();

  if (!bundle.md) {
    return <p className="text-center font-body italic text-sepia-600">{t(missing)}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BioArticle source={bundle.md} onNavigateEntry={onNavigateEntry} />
    </div>
  );
}
