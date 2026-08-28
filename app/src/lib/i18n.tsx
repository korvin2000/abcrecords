import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_LANG, isLang, langInfo, type Lang } from "./languages";
import { DICTS, type Message, type MsgKey } from "./messages";
import { preferences, setPreference } from "./settings";

/**
 * i18n layer for the UI chrome — ten languages, one dictionary each (see
 * src/lib/messages/). Russian is the catalogue's primary language and the
 * reference key set; missing runtime lookups fall back en → ru.
 * Plurals use Intl.PluralRules per locale (ru: one/few/many; CJK: other).
 *
 * Catalogue content (biographies/metadata) is NOT translated here — it is
 * data, loaded per language from pages/<lang>/ (see catalog.ts).
 */

export type { Lang };

export type TFunc = (key: MsgKey, params?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  locale: string;
  t: TFunc;
  setLang: (l: Lang) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * The tongue to open in: the reader's remembered choice, else their browser's,
 * else the catalogue's own. Only the *absence* of a stored choice lets the
 * browser decide — a reader who once picked Russian on an English machine gets
 * Russian on every later visit (see lib/settings.ts).
 */
function detectLang(): Lang {
  const stored = preferences().lang;
  if (isLang(stored)) return stored;
  try {
    for (const l of navigator.languages ?? [navigator.language]) {
      const code = l?.slice(0, 2).toLowerCase();
      if (isLang(code)) return code;
    }
  } catch {
    /* SSR / exotic environments */
  }
  return DEFAULT_LANG;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setPreference("lang", l);
  }, []);

  const t = useCallback<TFunc>(
    (key, params) => {
      const msg: Message = DICTS[lang][key] ?? DICTS.en[key] ?? DICTS.ru[key] ?? key;
      let text: string;
      if (typeof msg === "string") {
        text = msg;
      } else {
        const n = Number(params?.n ?? 0);
        const rule = new Intl.PluralRules(lang).select(n);
        text = msg[rule] ?? msg.other;
      }
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replaceAll(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, locale: langInfo(lang).locale, t, setLang }),
    [lang, t, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}

/** Localize an entry type ("guitarist" → Гитарист); unknown types pass through. */
export function typeLabel(t: TFunc, type: string | undefined): string {
  if (!type) return "";
  const key = `type.${type.toLowerCase()}` as MsgKey;
  const label = t(key);
  return label === key ? type : label;
}
