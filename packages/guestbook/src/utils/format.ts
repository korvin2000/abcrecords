/**
 * Formatierung von Datum, Uhrzeit und Laendernamen.
 *
 * Die API liefert absichtlich rohe Werte (`"2026-07-20"`, `"14:32:00"`, `"DE"`)
 * statt fertiger Anzeigetexte — sonst muesste das Backend die Sprache des
 * Besuchers kennen. Die Alt-App hatte dafuer die Einstellungen `USEUSDATE` und
 * `AMPMTIME`; hier macht das die Intl-API des Browsers korrekt fuer jede Sprache.
 */

/**
 * Baut ein Date aus den getrennten Feldern DATE und SIGNTIME.
 *
 * Bewusst ueber die Einzelkomponenten und nicht per `new Date("2026-07-20")`:
 * ein ISO-Datum ohne Zeitanteil wird als UTC interpretiert, wodurch der Tag in
 * westlichen Zeitzonen um eins zurueckspringt. Die Werte in der Datenbank sind
 * bereits lokale Zeit (die Alt-App verschiebt sie beim Speichern), sie duerfen
 * also nicht noch einmal umgerechnet werden.
 */
export function parseEntryDate(date: string | null, time: string | null): Date | null {
  if (date === null) return null;

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!dateMatch) return null;

  const [year, month, day] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  const timeMatch = time === null ? null : /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (timeMatch) {
    hours = Number(timeMatch[1]);
    minutes = Number(timeMatch[2]);
    seconds = timeMatch[3] === undefined ? 0 : Number(timeMatch[3]);
  }

  const parsed = new Date(year, month - 1, day, hours, minutes, seconds);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatEntryDate(
  date: string | null,
  time: string | null,
  language: string,
): string | null {
  const parsed = parseEntryDate(date, time);
  if (parsed === null) return date;

  const options: Intl.DateTimeFormatOptions =
    time === null
      ? { dateStyle: 'long' }
      : { dateStyle: 'long', timeStyle: 'short' };

  try {
    return new Intl.DateTimeFormat(language, options).format(parsed);
  } catch {
    return date;
  }
}

/** Maschinenlesbarer Wert fuer das datetime-Attribut von <time>. */
export function toIsoDateTime(date: string | null, time: string | null): string | undefined {
  if (date === null) return undefined;

  return time === null ? date : `${date}T${time}`;
}

/**
 * Anzeigename eines Landes.
 *
 * `COUNTRY.NAME` enthaelt bei dieser Installation Laendercodes (`DE`, `FR`, …)
 * mit `TRANSLATE = 1`; die Alt-App loeste sie ueber lang/langcountry*.inc auf.
 * Hier macht das `Intl.DisplayNames` — dadurch sind alle Laendernamen in allen
 * drei Sprachen korrekt, ohne 21 Namen dreifach zu pflegen.
 *
 * Der Sonderfall ist `code === "0"` (Flagge empty.gif): das ist der Eintrag
 * "keine Angabe" der Alt-Anwendung, kein Laendercode.
 */
export function formatCountry(
  code: string,
  translate: boolean,
  language: string,
  unspecifiedLabel: string,
): string {
  if (code === '' || code === '0') {
    return unspecifiedLabel;
  }
  if (!translate) {
    return code;
  }
  if (!/^[A-Za-z]{2}$/.test(code)) {
    return code;
  }

  try {
    const names = new Intl.DisplayNames([language], { type: 'region' });

    return names.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
