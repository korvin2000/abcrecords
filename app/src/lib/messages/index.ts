import type { Lang } from "../languages";
import type { Message } from "./types";
import { ru, type MsgKey } from "./ru";
import { en } from "./en";
import { es } from "./es";
import { ja } from "./ja";
import { de } from "./de";
import { fr } from "./fr";
import { it } from "./it";
import { pt } from "./pt";
import { zh } from "./zh";
import { ko } from "./ko";

export type { Message, Plural } from "./types";
export type { MsgKey };

/** One complete UI dictionary per codex language (typed against the ru keys). */
export const DICTS: Record<Lang, Record<MsgKey, Message>> = {
  en,
  es,
  ja,
  de,
  fr,
  it,
  pt,
  ru,
  zh,
  ko,
};
