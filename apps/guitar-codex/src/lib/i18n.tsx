import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_LANG, isLang, langInfo, type Lang } from "./languages";
import { DICTS, loadDict, type Message, type MsgKey } from "./messages";
import { preferences, setPreference } from "./settings";

/**
 * i18n layer for the UI chrome — eleven languages, one dictionary each (see
 * src/lib/messages/). Russian is the catalogue's primary language and the
 * reference key set; missing runtime lookups fall back en → ru. Only those two
 * are bundled — the rest load on demand (`prepareI18n` before the first render,
 * `setLang` before a switch), so the UI never renders a half-available tongue.
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

/**
 * Load the opening language's dictionary — awaited by main.tsx before the
 * first render, so the page opens in the reader's tongue with no flash of
 * English. Never rejects: a dictionary that fails to load leaves `t()` to its
 * `en → ru` fallbacks rather than holding the app back.
 */
export function prepareI18n(): Promise<unknown> {
  return loadDict(detectLang());
}

/** The language the page opens in — for what must be decided before React
 *  renders (which script's fonts to ask for, lib/fontPreload.ts). */
export function openingLang(): Lang {
  return detectLang();
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);
  // The dictionary `t()` reads first — state, not a lookup, so a retry that
  // finally loads the language already selected still re-renders the UI.
  const [dict, setDict] = useState(() => DICTS[lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // main.tsx waits for the opening dictionary, but not for ever; and a switch
  // whose dictionary failed to load still switches. Either way the page can be
  // showing a language it has no dictionary for — take it up the moment it
  // does arrive. Keyed on the language, so a dictionary that lands after the
  // reader has moved on to another tongue is simply not applied.
  useEffect(() => {
    if (DICTS[lang]) {
      // It may have landed between the first commit and this effect — after
      // the state was initialised without it. A no-op when already in state.
      setDict(DICTS[lang]);
      return;
    }
    let alive = true;
    void loadDict(lang).then((ok) => {
      if (alive && ok) setDict(DICTS[lang]);
    });
    return () => {
      alive = false;
    };
  }, [lang]);

  // Load first, then switch. Only the latest request switches, so a slow
  // dictionary cannot land after a later choice and overturn it; one that
  // fails to load switches anyway and lets the fallback chain answer.
  const request = useRef(0);
  const setLang = useCallback((l: Lang) => {
    const id = ++request.current;
    const apply = () => {
      if (id !== request.current) return;
      setLangState(l);
      setDict(DICTS[l]);
      setPreference("lang", l);
    };
    if (DICTS[l]) apply();
    else void loadDict(l).then(apply);
  }, []);

  const t = useCallback<TFunc>(
    (key, params) => {
      const msg: Message = dict?.[key] ?? DICTS.en[key] ?? DICTS.ru[key] ?? key;
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
    [lang, dict],
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
