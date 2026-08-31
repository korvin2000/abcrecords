import type { DemosceneContent, DemosceneMessages, LocalizedText } from '../types';
import type { LocaleModule } from './types';
import { SUPPORTED_LOCALES } from './tags';
import ru from './ru.json';
import en from './en.json';
import es from './es.json';
import ja from './ja.json';
import de from './de.json';
import fr from './fr.json';
import it from './it.json';
import pt from './pt.json';
import uk from './uk.json';
import zh from './zh.json';
import ko from './ko.json';

export type { LocaleModule } from './types';
export { SUPPORTED_LOCALES, isSupportedLocale, type SupportedLocale } from './tags';

/**
 * Every shipped language, as one JSON message catalogue per locale -- the
 * typical react-i18next / FormatJS resource shape (`{ tag, ui, content }`,
 * see [[./types]]). [[ru]] is the baseline every other file is a translation
 * of. Add a language by dropping a new `<tag>.json` file here in the same
 * shape, listing it below, and adding its tag to [[./tags]] -- nothing else
 * in the package needs to change.
 *
 * These are plain data, not wired to i18next: the package stays at zero
 * runtime dependencies, and the lightweight resolver in `src/i18n` (locale
 * matching, fallback, `pick()`) already does what a tiny i18n runtime does
 * for this catalogue shape. A host running i18next/FormatJS keeps doing so
 * for its own copy and simply passes the active tag down as `locale`.
 *
 * Note there is no `label` field. A language picker's option labels are the
 * *host's* chrome, not the demoscene's, and shipping them here would put
 * host copy inside the lazy feature chunk.
 */
export const LOCALES: readonly LocaleModule[] = [
  ru as LocaleModule,
  en as LocaleModule,
  es as LocaleModule,
  ja as LocaleModule,
  de as LocaleModule,
  fr as LocaleModule,
  it as LocaleModule,
  pt as LocaleModule,
  uk as LocaleModule,
  zh as LocaleModule,
  ko as LocaleModule,
];

if (import.meta.env?.DEV) {
  const shipped = LOCALES.map((l) => l.tag).join(',');
  const declared = SUPPORTED_LOCALES.join(',');
  if (shipped !== declared) {
    console.warn(
      `[demoscene] locales/tags.ts is out of date: declared [${declared}], ` +
        `shipped [${shipped}]. The eager-safe subpath export will lie to the host.`,
    );
  }
}

/** Chrome/UI message packs, keyed by locale tag. */
export const LOCALE_MESSAGES: Readonly<Record<string, DemosceneMessages>> =
  Object.fromEntries(LOCALES.map((l) => [l.tag, l.ui]));

/** Transpose every locale's single-language `field` into a `{ tag: value }` map. */
function collect(field: (c: LocaleModule['content']) => string): LocalizedText {
  const out: Record<string, string> = {};
  for (const l of LOCALES) out[l.tag] = field(l.content);
  return out;
}

/**
 * The baseline (`ru`) content shape drives how many credit groups, names and
 * blocks exist; every other locale file is expected to supply the same
 * counts, in the same order, so translations line up by index.
 */
const RU = ru as LocaleModule;

export const DEFAULT_CONTENT: DemosceneContent = {
  work: collect((c) => c.work),
  title: collect((c) => c.title),
  subtitle: collect((c) => c.subtitle),
  edition: collect((c) => c.edition),
  dropcap: collect((c) => c.dropcap),
  dedication: collect((c) => c.dedication),
  colophon: collect((c) => c.colophon),
  credits: RU.content.credits.map((group, gi) => ({
    role: collect((c) => c.credits[gi].role),
    sub: collect((c) => c.credits[gi].sub),
    names: group.names.map((_, ni) => collect((c) => c.credits[gi].names[ni])),
  })),
  blocks: RU.content.blocks.map((_, bi) => collect((c) => c.blocks[bi])),
};
