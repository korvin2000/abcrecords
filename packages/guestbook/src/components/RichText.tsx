interface RichTextProps {
  /** Serverseitig gerendertes HTML aus der API. */
  html: string;
  className?: string;
  as?: 'div' | 'span' | 'p';
}

/**
 * Gibt vom Backend geliefertes HTML aus.
 *
 * `dangerouslySetInnerHTML` ist hier bewusst und ausschliesslich fuer Felder
 * erlaubt, die die API als gerendertes HTML deklariert (`textHtml`, `nameHtml`,
 * `adminReplyHtml`, Bildunterschriften, Zusatzfeldwerte). Diese Werte entstehen
 * in backend/src/Service/TextRenderer.php: dort wird jedes Textstueck zuerst
 * HTML-escapt und danach nur um Markup ergaenzt, das der Parser selbst erzeugt.
 *
 * Alle anderen Werte (Name, E-Mail, URLs, Laendercodes) werden als normaler
 * React-Text ausgegeben und damit von React escapt.
 *
 * Diese Komponente ist die EINZIGE Stelle im Frontend, die innerHTML setzt —
 * dadurch bleibt die Menge der zu pruefenden Stellen bei einem Security-Review
 * genau eins.
 */
export function RichText({ html, className, as = 'div' }: RichTextProps) {
  const Tag = as;

  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
