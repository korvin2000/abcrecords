import type { ReactNode } from "react";
import { audio } from "@/lib/audio";
import { useI18n } from "@/lib/i18n";
import type { MsgKey } from "@/lib/messages";
import type { AnniversaryMessage } from "@/lib/herald";
import type { Gender } from "@/lib/types";

/**
 * "Exactly 134 years ago today, Andrés Segovia was born."
 *
 * Two localization details worth keeping:
 *
 * • **Gender picks the sentence, not a verb.** German circumfixes ("wurde …
 *   geboren") and Russian endings ("родился"/"родилась") cannot both be served
 *   by substituting one word into one template, so each gender owns a whole
 *   sentence: `herald.born.m` · `.f` · `.x`. `.x` is deliberately gender-free
 *   ("день рождения: …") and covers groups and unrecorded genders alike.
 *
 * • **`{name}` is left unsubstituted** by `t()` and spliced in here as a node,
 *   so the name can be emphasized and the whole line can lead into the codex
 *   without cutting the sentence into per-language fragments.
 */
export function AnniversaryLine({
  message,
  onOpen,
}: {
  message: AnniversaryMessage;
  onOpen?: (slug: string) => void;
}) {
  const { t } = useI18n();

  const key = `herald.${message.event}.${genderVariant(message.gender)}` as MsgKey;
  const sentence = t(key, { years: t("lore.years", { n: message.years }) });
  const body = withName(sentence, message.name);

  if (!onOpen) return <p className="herald-line">{body}</p>;

  return (
    <button
      type="button"
      onClick={() => {
        audio.click();
        onOpen(message.slug);
      }}
      onMouseEnter={() => audio.hover()}
      aria-label={t("card.open", { name: message.name })}
      className="herald-line herald-line-link"
    >
      {body}
    </button>
  );
}

/** Dossiers record `m`/`f`/`mixed`; anything else shares the neutral wording. */
function genderVariant(gender: Gender | undefined): "m" | "f" | "x" {
  return gender === "m" || gender === "f" ? gender : "x";
}

/** Fill the template's `{name}` slots with the emphasized name. */
function withName(template: string, name: string): ReactNode[] {
  const parts = template.split("{name}");
  const nodes: ReactNode[] = [parts[0]];
  for (let i = 1; i < parts.length; i++) {
    nodes.push(
      <strong key={i} className="font-display font-semibold text-burgundy-700">
        {name}
      </strong>,
      parts[i],
    );
  }
  return nodes;
}
