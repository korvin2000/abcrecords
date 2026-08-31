# Legacy-Architektur — ViPER Guestbook X1.2

Tiefenanalyse der bestehenden PHP-Codebasis. Ziel dieses Dokuments: das Laufzeitverhalten
der Altanwendung so genau dokumentieren, dass eine Neuimplementierung (React SPA + PHP-REST-API)
funktional äquivalent sein kann, ohne den alten Code zeilenweise erneut lesen zu müssen.

> Quelle: Copyright (c) 2004–2006 Marc Stein, `http://www.vipergb.de.vu`, Version X1.2.
> Reines PHP4/5-Stil-Skript (kein Composer, keine Namespaces, keine Prepared Statements).

## 1. Einstiegspunkte

Es gibt **drei** eigenständige, direkt aufrufbare PHP-Skripte im Root — sie inkludieren sich
gegenseitig, sind aber jeweils auch als eigener HTTP-Request-Endpunkt erreichbar:

| Datei | Rolle |
|---|---|
| [index.php](../index.php) | Haupt-Router **und** Rendering-Engine. Baut die paginierte/gefilterte Eintragsliste (`makeEntryList()`, ab Zeile ~1065) und definiert ~150 `vgb_*`/`Entry*`/`Form*`-Template-Helferfunktionen, die von den Skin-Dateien aufgerufen werden. |
| [show.php](../show.php) | Dispatcher für ca. 15 Nebenaktionen: Kommentar-Thread anzeigen/posten (`comment()`, `sendComment()`, `preview()`), Bild ausliefern/skalieren (`picture()`), privaten Eintrag entsperren (`login()`, `decode()`, `sendpass()`), Nachricht an Autor weiterleiten (`mailform()`, `mailer()`, `gbsend()`), Captcha-Bild (`ticket()`), Emoticon-/BBCode-Hilfeseiten. **Nicht** die Listenanzeige — das ist ein verbreitetes Missverständnis beim ersten Blick auf die Datei. |
| [sign.php](../sign.php) | Formularverarbeitung für neue Einträge (`vgb_sign()`), inkl. Validierung, Captcha-Prüfung, Flood-Control, DB-Insert, Vorschau-Modus, E-Mail-Benachrichtigung. |

Dazu kommen reine Konfigurations-/Hilfsdateien:

- [param.php](../param.php) — Array `$prm[0..72]` mit zufälligen 6-Zeichen-Strings. Jeder echte
  Parametername (z. B. „Name“, „Sprache wechseln“, „Seite N“) wird im gesamten Code **nur** über
  seinen numerischen Index in `$prm[]` referenziert; der tatsächliche GET/POST-Key ist
  `PFIX.$prm[N]`. Reine Verschleierung ohne echten Sicherheitswert (Indizes stehen offen in jedem
  HTML-Formular/Link) — für die REST-API vollständig durch sprechende Parameternamen ersetzen.
- [ht_lock.php](../ht_lock.php) — **enthält die MySQL-Zugangsdaten im Klartext** (`$mySQL_Host`,
  `$mySQL_User`, `$mySQL_Password`, `$mySQL_Database`, `$Prefix`). Der Name suggeriert
  „Sperre/Lock“, hat aber nichts mit Flood-Control zu tun — reine Security-by-obscurity-Benennung.
  ⚠️ Diese Datei enthält aktuell ein echtes, produktiv aussehendes Passwort. Nicht committen,
  Zugangsdaten vor Weiterarbeit rotieren und durch Umgebungsvariablen ersetzen.
- [ht_badwords.php](../ht_badwords.php) — Flache Wortliste, erste Zeile `<?php exit(); ?>` als
  Zugriffsschutz (Datei wird zeilenweise als Text geparst, nicht als PHP ausgeführt).
- [banned.php](../banned.php) — Statisches HTML-Snippet („Bye!“), wird angezeigt und dann
  `exit()` aufgerufen, wenn eine IP/UA als gesperrt erkannt wird.

## 2. Request-Routing in index.php

Der Modus wird rein über das Vorhandensein bestimmter `$prm[]`-indizierter GET/POST-Parameter
bestimmt (keine sprechenden Routen, kein Front-Controller-Pattern im modernen Sinn):

- Keine Parameter → `$arg[PFIX.$prm[0]] = 1` (Standard: Eintragsliste, Seite 1).
- `$prm[3]`/`$prm[4]` (Vorschau-Button) oder `$prm[5]`/`$prm[12]` (Absenden-Button) gesetzt →
  `require sign.php; vgb_sign();`
- Danach abhängig von `$prm[0]`/`$prm[13]`/`$prm[6]` (Non-Frames-Modus) bzw.
  `$prm[1]`/`$prm[9]`/`$prm[7]`/`$prm[2]`/`$prm[14]`/`$prm[8]` (Frames-Modus) → genau eine
  Skin-Datei wird über `loadSkin()` eingebunden: `mainFrameset.php`, `noFrames.php`,
  `displayFrameset.php`, `selectFrame.php`, `menuFrame.php` oder `contentFrame.php`.
- Der **Non-Frames-Modus** ist der für die Migration relevante: eine einzelne monolithische
  HTML-Seite pro Request, kein Partial-/AJAX-Update-Modell.

### Include-Reihenfolge (index.php, Bootstrap)

1. `functions.php` (Versuch über `SCRIPTPATH`, dann Fallback ohne Pfad).
2. `lang/langindex[ID].inc` (Pflicht) — UI-Übersetzungen (`$lang`-Array).
3. `vgb_connectDB()` → inkludiert `ht_lock.php`, dann `libs/db_mysqli.php` **oder**
   `libs/db_mysql.php` (je nachdem, welche PHP-Extension verfügbar ist — auf PHP 7/8 ist das
   praktisch immer `db_mysqli.php`, da `mysql_connect()` entfernt wurde), `libs/string.php` oder
   `libs/string_utf8.php`, optionale Zeichensatz-`.map`-Datei, `libs/mail_smtp.php` oder
   `libs/mail_sendmail.php`, `detection/detection.php` (User-Agent-Erkennung).
4. `vgb_hackerlog()` — protokolliert alle Request-Parameter, falls `HACKERLOG` aktiv.
5. `vgb_registerVisitor()` — Besucher-Tracking + IP-Bann-Prüfung; kann `banned.php` inkludieren
   und `exit()` aufrufen.
6. Optional `lang/langcountry[ID].inc` (falls `ASKCOUNTRY`), `lang/langspecial[ID].inc`.
7. Optional `libs/rtf.php`, falls BBCode-Toolbar/Rich-Text-Editor aktiv ist.
8. `vgb_setSkinDir()`, dann Skin-`skininfo.php`, optional Skin-`lang.inc`/`style.inc`.
9. Falls Sign/Preview/Send-Parameter gesetzt → `require sign.php; vgb_sign()`.
10. `loadSkin()` → eine Top-Level-Skin-Datei, die weitere Partials inkludiert (`skinMenu.php`,
    `skinSelect.php`, `skinContent.php`, `skinEntry.php`, `skinInputmask.php`, `skinStats.php`,
    `skinEmpty.php`, `skinDeactivated.php`, `skinPrivate.php`, `skincss.php`).
11. Nach dem Rendern protokolliert `vgb_saveAction()` die Aktion (Liste ansehen, Formular öffnen,
    Stats ansehen, Senden, Vorschau) in `VGB_ACTION`/`VGB_VISITOR` für die eingebaute Statistik.

## 3. Sessions, Cookies, IP-Sperren, Flood-Control

- **Keine PHP-Sessions** für Besucher — alles DB-gestützt:
  - `VGB_VISITOR` trackt aktive Besucher per IP (15-Min-TTL über `UNREGISTERAFTERMINUTE`).
  - `VGB_LOGIN` implementiert den Entsperr-Mechanismus für private Einträge (Passwort-Link,
    Token als `decode`-Parameter, `$prm[11]`).
  - `VGB_TICKET` ist das Captcha-Token (60 Min TTL, ein Ticket pro IP).
  - `VGB_SPAM` / `VGB_COMMENTSPAM` / `VGB_MAILSPAM` sind IP+Timestamp-basierte
    Flood-Control-Tabellen für Neueintrag, Kommentar bzw. „Passwort per Mail zusenden“.
- **Cookies** (nur clientseitige Komfortfunktion, kein Auth-Mechanismus): Formulardaten
  (Name/E-Mail/Homepage/IM-Handles/Land/Custom-Fields) werden 30 Tage lang gespeichert, um das
  Formular vorauszufüllen; `vgb_spammer`-Cookie ergänzt die IP-basierte Flood-Control.
- **IP-/Robot-Sperren**: `vgb_registerVisitor()` (`functions.php:1768`) prüft
  `$settings['BANLIST']` (Freitext-Liste von IP-/Hostname-Präfixen) und `$settings['BANROBOTS']`
  gegen den User-Agent; bei Treffer → `banned.php` + `exit()`. Es gibt **keine** dedizierte
  „Banned IPs“-Tabelle, nur diese eine Konfigurationsspalte.

## 4. Sicherheitsmechanismen (Ist-Zustand, bewusst dokumentiert für die Neuimplementierung)

- **Kein Prepared-Statement-Layer.** `vgb_query()` (`libs/db_mysqli.php:15` bzw.
  `libs/db_mysql.php`) macht nur `str_replace("VGB", $Prefix, $sql)` und führt den fertigen
  SQL-String aus. Escaping erfolgt manuell über `addSlashes()`. **Für die REST-API zwingend durch
  PDO mit parametrisierten Queries ersetzen** — das ist der größte Sicherheits-Cleanup-Punkt.
  Siehe [database-schema.md](database-schema.md).
- **Captcha** (`libs/captcha.php`): zeichnet den Klartext-Code direkt auf ein PNG
  (`ImageString($im,2,5,3,"Code = ".$code,$tc)`) — keinerlei Verzerrung/Rauschen, de facto kein
  wirksamer Bot-Schutz mehr. Für die Neuimplementierung durch modernes Captcha
  (z. B. hCaptcha/Turnstile) oder Honeypot-Feld ersetzen.
- **Badword-Filter** (`vgb_filterBadwords()`, `functions.php:869`): filtert **nur beim Anzeigen**
  (Render-Zeit), nicht beim Absenden. Rohtext wird ungefiltert in der DB gespeichert; jede Anzeige
  läuft erneut durch den Filter gegen die aktuelle `ht_badwords.php`. Wichtige Design-Entscheidung
  für die Migration: Sanitizing beim Schreiben (sicherer) vs. „wie bisher“ beim Lesen (Kompatibilität
  mit Altbestand).
- **E-Mail-Validierung**: schwache Regex
  (`^\w+[\w|\.|-]*\w+@(\w+[\w|\.|-]*\w+\.[a-z]{2,4}|(\d{1,3}\.){3}\d{1,3})$`), lässt z. B. `+`,
  einzelne Zeichen vor dem `@` oder lange TLDs nicht zu — für die Neuimplementierung durch
  RFC-konforme Validierung ersetzen.
- **Kein CSRF-Token-Konzept.** Schutz vor Doppel-Posts läuft ausschließlich über die
  IP-basierte Flood-Control, nicht über echte CSRF-Tokens.

## 5. Textverarbeitung / Ausgabe-Pipeline

Zentrale Funktion `vgb_outText()` (`functions.php:550-567`), verkettet:

```
vgb_formatText(
  vgb_doLinebreak(
    vgb_wrapWords(
      vgb_string(
        vgb_insertEmoticons(
          vgb_filterBadwords(
            vgb_activateLinks(
              vgb_BBCode(
                vgb_noHTML($text)
              )
            ), $filterFlag
          ), $useEmoticonsFlag
        )
      )
    )
  )
)
```

Wichtige Konsequenz: **Gespeicherter Text ist BBCode, nicht HTML.** Das Eingabeformular nutzt
einen `contentEditable`/`designMode`-WYSIWYG-Iframe; `libs/rtf.php::vgb_RTFdecode()` wandelt
dessen HTML-Ausgabe in ViPER-eigenes BBCode um (`[b]`, `[i]`, `[url=]`, `[color=]`, `[size=]`,
`[font=]`, `[list]`, `[center]`, …), das dann in `ENTRY`/`TEXT`-Spalten landet. Die neue
React-Oberfläche braucht entweder einen eigenen BBCode-Renderer (Client) oder die REST-API liefert
serverseitig vorgerendertes HTML (empfohlen für Konsistenz mit Bestandsdaten — siehe
[migration-plan.md](migration-plan.md)).

Emoticons: `vgb_insertEmoticons()` ersetzt Codes anhand der `VGB_EMOTICON`-Tabelle
(`CODE`, `FILENAME`, sortiert nach `PRIORITY`) durch `<img>`-Tags, Bilddateien liegen unter
[emoticons/](../emoticons/).

Länder-Flaggen sind **kein** IP-Geolookup, sondern ein manuelles Auswahlfeld
(`VGB_COUNTRY.FLAGICON`, Bilder unter [flags/](../flags/)).

## 6. Skin-/Template-System

Skins (`skins/Standard_Skin/*.php`, aktuell nur ein Skin vorhanden) sind **ausführbare
PHP-Dateien**, keine passiven Templates. Sie rufen die in `index.php` definierten
Helferfunktionen auf (`EntryName()`, `EntryText()`, `EntryIfCountry(...)`, `EntryIfEmail(...)`,
`FormName(...)`, `FormIfCountry(...)`, `Out(LANG_KONSTANTE)`, …), die wiederum Platzhalter-Strings
mit einer eigenen Mini-Template-Syntax interpretieren:

- Positions-Platzhalter `^1`, `^2`, `^3`, … (`^` = konfigurierbares `SCHAR`/`SPECIALCHAR`, Default
  `^`), werden durch Feldwerte ersetzt.
- `{...}`-Blöcke markieren optionale/wiederholte Abschnitte, die nur gerendert werden, wenn der
  zugehörige Wert vorhanden ist (z. B. `EntryIfEmail('...^3...')`, `EntryIfPicture(...)`).
- `vgb_divideString()` zerlegt Template-Strings am obersten `SCHAR` für Listen-Wrapper
  (`makeEntryList($inString)`, `index.php:1065`).

Die Funktionsnamen selbst sind ein nützliches **Feld-Inventar** (siehe
[visitor-features.md](visitor-features.md)): `EntryName`, `EntryText`, `EntryDate`/`EntryTime`,
`EntryNumber`, `EntryIfCountry/Email/Homepage/ICQ/AIM/MSN/YAHOO/Skype/Jabber/GaduGadu/Gender/
Picture/Custom/Rating/Comment`, `EntryOSName`/`EntryBrowserName` (User-Agent-Parsing),
`FormName/Text/IfCountry/Gender/Private/Picture/Picturetext/Custom/Rating/Email/HideEmail/
Homepage/ICQ/.../Validation`, `FormSendButton`/`FormPreviewButton`.

Dieses ganze Template-Layer wird durch React-Komponenten ersetzt — für die Migration nur als
Referenz für „welche Felder muss die neue UI abdecken“ relevant, nicht als zu portierender Code.

## 7. Sprachen (i18n)

- `lang/langindex[ID].inc` — UI-Strings (`$lang['key']`-Array), geladen in `index.php`
  (nicht `functions.php`).
- Sprachauswahl ist rein parameter-/cookie-/einstellungsbasiert (`$prm[34]`), **keine**
  Accept-Language-Auto-Erkennung. `detection/detection.php` liefert nur Browser/OS/Robot-Muster
  für die Anzeige „Browser: Firefox“ etc., nicht für Sprachwahl.
- Aktuell nur `lang/English/` vorhanden.

## 8. Bekannte Altlasten (bewusst NICHT in die neue Architektur übernehmen)

- `$prm[]`-Parameter-Verschleierung (Abschnitt 1).
- String-verkettetes SQL ohne Prepared Statements (Abschnitt 4).
- `magic_quotes_gpc`-Kompatibilitätscode in `vgb_getParameters()` — totaler Dead Code auf
  PHP 7/8.
- E-Mail-Adress-Verschleierung via clientseitigem JavaScript (`vgb_encmail`, `vgb_javaquote`) —
  bei einer JSON-API/React-Frontend gegenstandslos.
- Frames-Modus (`mainFrameset.php` etc.) — reines Altlast-Feature, für die SPA irrelevant.
- MAINSCRIPT/SCRIPTPATH/PFIX-Einbettungsmechanismus (Einbetten des Gästebuchs in eine fremde
  Host-Seite per PHP-Include) — durch die entkoppelte SPA+API-Architektur gegenstandslos.
