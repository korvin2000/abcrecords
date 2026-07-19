import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Tiny i18n layer: Russian is the primary language, English secondary.
 * UI chrome only — catalogue content (biographies) is data and renders as-is.
 * Plurals use Intl.PluralRules (ru: one/few/many).
 */

export type Lang = "ru" | "en";

type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
type Message = string | Plural;

const ru = {
  "app.title": "Кодекс Гитаристов",
  "app.volume": "✦ Том I · Классическая гитара ✦",
  "app.subtitle":
    "Энциклопедия музыкантов — их имена, судьбы и предания, записанные на пожелтевших страницах.",
  "app.brand": "КОДЕКС",
  "app.footer": "✦ Переплетено золотом · имя в летописи откроет её страницу · клавиши ← → листают записи ✦",
  "app.loadError": "Летопись не открылась. Свиток index.json недоступен.",
  "app.retry": "Попробовать снова",

  "search.placeholder": "Искать по имени — например, Сеговия, Джанго, Йован…",
  "search.clear": "Очистить поиск",
  "search.count": {
    one: "{n} запись в летописи",
    few: "{n} записи в летописи",
    many: "{n} записей в летописи",
    other: "{n} записи в летописи",
  } as Plural,
  "search.countFiltered": "Найдено {n} из {total}",
  "search.empty.title": "Ни одно имя не отзывается.",
  "search.empty.hint": "В кодексе нет записи с таким именем. Попробуйте иначе или снимите фильтры.",

  "facet.type": "Ремесло",
  "facet.country": "Страна",

  "type.guitarist": "Гитарист",
  "type.musician": "Музыкант",
  "type.composer": "Композитор",
  "type.conductor": "Дирижёр",
  "type.luthier": "Мастер",

  "card.open": "Открыть запись: {name}",

  "codex.entry": "❖ ЗАПИСЬ В КОДЕКСЕ ❖",
  "codex.close": "✕ Закрыть кодекс",
  "codex.end": "❦ Конец записи · переверните страницу, чтобы вернуться ❦",
  "codex.prev": "Предыдущая запись",
  "codex.next": "Следующая запись",
  "codex.notFound": "Страница этой записи ещё не вписана в кодекс.",

  "tabs.biography": "Летопись",
  "tabs.gallery": "Галерея",
  "tabs.documents": "Свитки",
  "tabs.lore": "Атрибуты",

  "gallery.photos": "Портреты и снимки",
  "gallery.music": "Музыка",
  "gallery.theme": "Тема героя",
  "gallery.themePlay": "▶ Слушать тему",
  "gallery.themeStop": "■ Остановить",
  "gallery.themeHint": "Мелодия порождается формулой f = f₀·2^(n/12) из имени героя",
  "gallery.empty": "Галерея этой записи пока пуста.",
  "gallery.close": "Закрыть изображение",
  "audio.unavailable": "запись хранится в архиве и недоступна",

  "docs.source": "Первоисточник",
  "docs.external": "внешний источник",
  "docs.archive": "архивная ссылка",
  "docs.embedded": "вложено в кодекс",
  "docs.empty": "К этой записи не приложено ни одного свитка.",
  "docs.open": "Открыть",

  "lore.title": "Досье",
  "lore.identity": "Личность",
  "lore.career": "Ремесло и путь",
  "lore.relations": "Наставники и ученики",
  "lore.birthname": "Имя при рождении",
  "lore.gender": "Пол",
  "lore.gender.m": "Мужской",
  "lore.gender.f": "Женский",
  "lore.type": "Ремесло",
  "lore.country": "Страна",
  "lore.birthplace": "Место рождения",
  "lore.deathplace": "Место смерти",
  "lore.born": "Родился",
  "lore.died": "Умер",
  "lore.age": "Возраст",
  "lore.years": { one: "{n} год", few: "{n} года", many: "{n} лет", other: "{n} лет" } as Plural,
  "lore.activeYears": "Годы деятельности",
  "lore.instruments": "Инструменты",
  "lore.genres": "Жанры",
  "lore.bands": "Ансамбли",
  "lore.jobs": "Занятия",
  "lore.teachers": "Наставники",
  "lore.disciples": "Ученики",
  "lore.relatives": "Родня",
  "lore.awards": "Награды",
  "lore.ranking": "Слава",
  "lore.noData": "Досье этой записи ещё не составлено.",

  "bio.missing": "Летопись этой записи ещё не написана.",
  "bio.archiveLink": "Архивная ссылка из старой летописи",
  "bio.attachedDocument": "Приложенный свиток",

  "sound.on": "Звуки: вкл",
  "sound.off": "Звуки: выкл",
  "ambient.on": "Атмосфера: вкл",
  "ambient.off": "Атмосфера: выкл",
  "lang.switch": "Switch to English",
} satisfies Record<string, Message>;

type MsgKey = keyof typeof ru;

const en: Record<MsgKey, Message> = {
  "app.title": "The Guitar Codex",
  "app.volume": "✦ Volume I · The Classical Guitar ✦",
  "app.subtitle":
    "An encyclopaedia of musicians — their names, fates and legends, inked on yellowed pages.",
  "app.brand": "CODEX",
  "app.footer": "✦ Bound in gold · a name within a tale opens its page · use ← → to turn between entries ✦",
  "app.loadError": "The chronicle would not open. The index.json scroll is unreachable.",
  "app.retry": "Try again",

  "search.placeholder": "Seek by name — e.g. Segovia, Django, Jovan…",
  "search.clear": "Clear search",
  "search.count": { one: "{n} entry recorded", other: "{n} entries recorded" },
  "search.countFiltered": "{n} of {total} revealed",
  "search.empty.title": "No name answers the call.",
  "search.empty.hint": "The codex holds no record matching your seek. Try another name, or release the filters.",

  "facet.type": "Craft",
  "facet.country": "Country",

  "type.guitarist": "Guitarist",
  "type.musician": "Musician",
  "type.composer": "Composer",
  "type.conductor": "Conductor",
  "type.luthier": "Luthier",

  "card.open": "Open entry: {name}",

  "codex.entry": "❖ ENTRY IN THE CODEX ❖",
  "codex.close": "✕ Close Codex",
  "codex.end": "❦ End of entry · turn the page to return ❦",
  "codex.prev": "Previous entry",
  "codex.next": "Next entry",
  "codex.notFound": "This entry's page has not yet been inked into the codex.",

  "tabs.biography": "Biography",
  "tabs.gallery": "Gallery",
  "tabs.documents": "Documents",
  "tabs.lore": "Attributes",

  "gallery.photos": "Portraits & photographs",
  "gallery.music": "Music",
  "gallery.theme": "Character theme",
  "gallery.themePlay": "▶ Play theme",
  "gallery.themeStop": "■ Stop",
  "gallery.themeHint": "The melody is generated by the formula f = f₀·2^(n/12) from the hero's name",
  "gallery.empty": "This entry's gallery is still empty.",
  "gallery.close": "Close image",
  "audio.unavailable": "the recording rests in the archive and cannot be played",

  "docs.source": "Primary source",
  "docs.external": "external source",
  "docs.archive": "archival reference",
  "docs.embedded": "embedded in the codex",
  "docs.empty": "No scrolls are attached to this entry.",
  "docs.open": "Open",

  "lore.title": "Dossier",
  "lore.identity": "Identity",
  "lore.career": "Craft & path",
  "lore.relations": "Mentors & disciples",
  "lore.birthname": "Birth name",
  "lore.gender": "Gender",
  "lore.gender.m": "Male",
  "lore.gender.f": "Female",
  "lore.type": "Craft",
  "lore.country": "Country",
  "lore.birthplace": "Birthplace",
  "lore.deathplace": "Place of death",
  "lore.born": "Born",
  "lore.died": "Died",
  "lore.age": "Age",
  "lore.years": { one: "{n} year", other: "{n} years" },
  "lore.activeYears": "Active years",
  "lore.instruments": "Instruments",
  "lore.genres": "Genres",
  "lore.bands": "Ensembles",
  "lore.jobs": "Occupations",
  "lore.teachers": "Teachers",
  "lore.disciples": "Disciples",
  "lore.relatives": "Kin",
  "lore.awards": "Honours",
  "lore.ranking": "Renown",
  "lore.noData": "This entry's dossier has not yet been compiled.",

  "bio.missing": "This entry's chronicle has not yet been written.",
  "bio.archiveLink": "Archival link from the legacy chronicle",
  "bio.attachedDocument": "Attached scroll",

  "sound.on": "Sound: on",
  "sound.off": "Sound: off",
  "ambient.on": "Ambience: on",
  "ambient.off": "Ambience: off",
  "lang.switch": "Переключить на русский",
};

const DICTS: Record<Lang, Record<MsgKey, Message>> = { ru, en };
const STORAGE_KEY = "codex-lang";

export type TFunc = (key: MsgKey, params?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  locale: string;
  t: TFunc;
  setLang: (l: Lang) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ru" || stored === "en") return stored;
  } catch {
    /* private mode */
  }
  return "ru"; // primary language of the catalogue
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback<TFunc>(
    (key, params) => {
      const msg: Message = DICTS[lang][key] ?? DICTS.ru[key] ?? key;
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
    () => ({ lang, locale: lang === "ru" ? "ru-RU" : "en-GB", t, setLang }),
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
