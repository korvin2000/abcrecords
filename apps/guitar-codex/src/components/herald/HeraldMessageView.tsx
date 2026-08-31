import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import type { HeraldMessage } from "@/lib/herald";
import { AnniversaryLine } from "./AnniversaryLine";
import { QuoteLine } from "./QuoteLine";
import { TONES } from "./tones";

/**
 * One message, rendered by kind — the union's only exhaustive switch.
 *
 * The tone label above it comes from the tone table, so a new kind of message
 * needs a builder, a tone row and one branch here; nothing else in the block
 * has to learn about it.
 */
export function HeraldMessageView({
  message,
  onOpenEntry,
}: {
  message: HeraldMessage;
  onOpenEntry?: (slug: string) => void;
}) {
  const { t } = useI18n();
  const tone = TONES[message.tone];

  return (
    <>
      {tone.label && (
        <p className={clsx("herald-label", tone.labelClass)}>
          <span aria-hidden>{tone.glyph}</span>
          {t(tone.label)}
          <span aria-hidden>{tone.glyphEnd}</span>
        </p>
      )}

      <div className={tone.textClass}>
        {message.kind === "default" && <p className="herald-line italic">{t("app.subtitle")}</p>}
        {message.kind === "anniversary" && <AnniversaryLine message={message} onOpen={onOpenEntry} />}
        {message.kind === "quote" && <QuoteLine message={message} />}
      </div>
    </>
  );
}
