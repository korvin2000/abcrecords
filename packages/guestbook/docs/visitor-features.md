# Besucher-Feature-Inventar (funktionale Spezifikation für die Migration)

Diese Liste beschreibt **alle** Besucher-sichtbaren Funktionen der Altanwendung, damit die neue
React-/REST-Lösung funktional äquivalent sein kann. Admin-Funktionen (`admin.php`, `admin/*`)
sind bewusst ausgeklammert — siehe [migration-plan.md](migration-plan.md) für den Scope.

## 1. Einträge ansehen (Liste)

- Paginierte Liste, Seitengröße konfigurierbar (`SETTINGS.MAXENTRIESPERPAGE`).
- Feste Sortierung: `STICKY DESC, DATE DESC, SIGNTIME DESC, ID DESC` (angepinnte Einträge zuerst,
  dann neueste zuerst). **Keine** vom Besucher wählbare Sortierung (kein „älteste zuerst“-Toggle).
- Fortlaufende Eintragsnummer wird pro Request berechnet (`maxEntry - offset + PASTENTRIES`), nicht
  gespeichert.

  ⚠️ **Die laufende Nummer ist keine Kennung.** Sie ist eine Positionsangabe und verschiebt sich,
  sobald ein Eintrag gelöscht wird. `ENTRY.ID` und Nummer laufen deshalb auseinander: bei dieser
  Installation trägt Nummer 151 die ID 176, weil über die Jahre 25 Einträge gelöscht wurden
  (153 Zeilen bei `AUTO_INCREMENT = 179`). Die API adressiert Einträge und Kommentar-Threads
  ausschließlich über die ID; die Nummer wird nur zur Anzeige mitgeliefert. In der SPA ist die
  angezeigte Nummer ein Anker-Link auf `#entry-<ID>`, dessen Tooltip die ID nennt — sonst ist
  beim Prüfen nicht nachvollziehbar, welcher Datensatz hinter „Nr. 151" steckt.
- Angezeigte Felder pro Eintrag: Name, Nachrichtentext (BBCode→HTML gerendert, mit Emoticons,
  Badword-gefiltert, Auto-Links), Datum/Uhrzeit, Land (Flagge), optional E-Mail (falls nicht
  `HIDEEMAIL`), Homepage-Link, IM-Handles (ICQ/AIM/MSN/Yahoo/Skype/Jabber/GaduGadu) sofern gesetzt,
  Geschlecht-Icon, Bild + Bildunterschrift, Bewertungen (falls Bewertungs-Boxen konfiguriert),
  Zusatzfelder (falls konfiguriert), Browser/OS (aus User-Agent geparst).
- Nur Einträge mit `UNMODERATED = 0` sind sichtbar (Moderationsmodus, siehe Abschnitt 6).
- **Private Einträge**: `ENTRY.PRIVATE` (Passwort) gesetzt → Eintrag wird nur mit
  Platzhalter/Passwort-Aufforderung gerendert, bis der Besucher das Passwort korrekt eingibt
  (siehe Abschnitt 5).
- Optionaler Seiten-Cache für Seite 1 ohne aktiven Filter (`SETTINGS.USECACHE`) — reines
  Implementierungsdetail, keine Fachanforderung.

## 2. Suche / Filter

Zugriff über ein Suchformular (Felder siehe unten); Ausführung als dynamisch gebautes SQL
`WHERE` (nicht parametrisiert im Altcode — in der neuen API zwingend als Prepared Statement).

Filterbare Felder: Name, Nachrichtentext, Geschlecht, E-Mail, Homepage, ICQ, AIM, MSN, Yahoo,
Skype, Jabber, GaduGadu, Land, „nur Einträge mit Bild“, beliebige konfigurierte Zusatzfelder
(Text/Zahl mit Vergleichsoperator `< / = / >`), beliebige konfigurierte Bewertungs-Boxen
(numerischer Vergleich `< / = / >`).

Freitextfelder werden als `LIKE '%wert%'` (Substring) gesucht; Land als exakte ID-Gleichheit;
Zahlenfelder/Bewertungen mit wählbarem Operator.

Filter werden **nicht** serverseitig als „Suchsitzung“ gespeichert — jeder Paginierungslink muss
alle aktiven Filterparameter erneut mitführen.

## 3. Neuen Eintrag verfassen

Formularfelder (Pflicht/optional je nach `SETTINGS`-Konfiguration):

| Feld | Pflicht? |
|---|---|
| Name | immer Pflicht |
| Nachrichtentext | immer Pflicht |
| E-Mail | optional, außer `ASKEMAIL` + `FORCEEMAIL` aktiv |
| Homepage/URL | optional (führendes `http://` wird beim Speichern entfernt) |
| Land | optional, außer `ASKCOUNTRY` + `FORCECOUNTRY` |
| Geschlecht | optional, außer `ASKGENDER` + `FORCEGENDER` |
| ICQ, AIM, MSN, Yahoo, Skype, Jabber, GaduGadu | optional, je Feld längenbegrenzt |
| Bild-Upload (nur GIF/JPEG) + Bildunterschrift | optional, gated durch `SETTINGS.ASKPICTURE` |
| „Privates Passwort“ (macht den Eintrag passwortgeschützt) | optional, Format `^[a-zA-Z0-9]+$` |
| E-Mail verbergen (Checkbox) | optional |
| Bewertungen (dynamische Boxen) | pro Box einzeln als Pflicht konfigurierbar |
| Zusatzfelder (dynamisch, Text/Zahl/Auswahl) | pro Feld einzeln als Pflicht konfigurierbar |
| Captcha-Antwort | nur falls `SETTINGS.USETICKETS` Bit gesetzt |

### Validierungsregeln (in dieser Reihenfolge geprüft)

1. Name gegen reservierte Namen (`USER.RESERVED=1`) — bei Übereinstimmung + korrektem Passwort
   werden Profildaten aus `USER` übernommen (siehe „Reservierte Namen“ unten).
2. Pflichtfeld-Prüfung (Name, Text, ggf. Land/Geschlecht/E-Mail).
3. Kontrollzeichen-/Nicht-ASCII-Prüfung auf E-Mail, Homepage, AIM, MSN, Yahoo, Skype, Jabber,
   privatem Passwort.
4. Längenprüfung je Feld gegen `SETTINGS.MAXLEN*` (multibyte-sicher).
5. Formatprüfung: Geschlecht/ICQ/GaduGadu als Zahl in gültigem Bereich; E-Mail-Regex (siehe
   [legacy-architecture.md](legacy-architecture.md) Abschnitt 4 — bewusst schwach, in der
   Neuimplementierung verbessern); Homepage als valide URL; privates Passwort nur
   alphanumerisch.
6. Captcha-Prüfung (falls aktiv).
7. Land-Existenzprüfung gegen `COUNTRY`-Tabelle.
8. Bewertungs-Pflichtfelder/Wertebereich.
9. Zusatzfeld-Validierung je Typ (Textlänge, Zahlenbereich, Auswahl-Zugehörigkeit).
10. Duplikatsprüfung: identischer Name+Text bereits vorhanden → Ablehnung als „duplicate“.

**Kein HTML-Escaping/BBCode-Filter beim Absenden** — der Text wird (nach RTF→BBCode-Konvertierung
im Editor) weitgehend roh gespeichert; sämtliche Aufbereitung (BBCode-Rendering, Badword-Filter,
Emoticons, Auto-Links) passiert erst beim Anzeigen. Migrationsentscheidung nötig, siehe
[migration-plan.md](migration-plan.md).

### Vorschau-Modus

Formular hat zwei Buttons: „Vorschau“ und „Absenden“. Bei „Vorschau“ + erfolgreicher Validierung
wird der Eintrag **nicht** gespeichert, sondern formatiert erneut angezeigt (inkl. bereits
eingegebener Werte), bis der Besucher tatsächlich „Absenden“ klickt.

### Nach erfolgreichem Absenden

- Cookies merken Name/E-Mail/Homepage/IM-Handles/Geschlecht/Land/„E-Mail verbergen“/Zusatzfelder
  für 30 Tage (Formular-Vorausfüllung beim nächsten Besuch).
- Bestätigungsmeldung; falls Moderationsmodus aktiv, zusätzlicher Hinweis „wartet auf Freigabe“.
- Bei hochgeladenem Bild: Datei wird aus `upload/preview/` nach `upload/` verschoben.
- Falls `SETTINGS.MAXENTRIES`-Obergrenze überschritten (und nicht im Moderationsmodus): älteste
  nicht-angepinnte Einträge (inkl. ihrer Bewertungen/Zusatzfelder/Kommentare) werden automatisch
  gelöscht, `SETTINGS.PASTENTRIES` wird hochgezählt (für korrekte fortlaufende Nummerierung).

### E-Mail-Benachrichtigungen

- An den Absender: Bestätigungsmail, nur falls E-Mail angegeben und die entsprechende
  E-Mail-Vorlage (`EMAIL.ID=2`) aktiv ist.
- An die Admins: Benachrichtigung über neuen Eintrag (`EMAIL.ID=1`), Empfänger aus
  `SETTINGS.ADMINEMAIL` plus `ADMIN.COMMENTEMAIL`-Einträgen.

## 4. Auf einen Eintrag antworten (Kommentar-Thread)

- Pro Eintrag ein Kommentarthread (`COMMENT`-Tabelle), sofern `ENTRY.CLOSED = 0` und
  `SETTINGS.ALLOWCOMMENTS` aktiv.
- Felder: Name, E-Mail (optional), Text.
- Eigene Flood-Control-Tabelle (`COMMENTSPAM`, pro IP + Eintrag).
- Vorschau-Funktion analog zum Haupt-Formular.
- `COMMENT.ADMIN`-Flag steuert nur die Anzeige (andere Hervorhebung für Admin-Antworten), keine
  Berechtigungslogik — als reines Anzeige-Flag in die neue API übernehmen.
- Moderationsstatus (`UNMODERATED`) analog zu Haupteinträgen.

## 5. Private Einträge entsperren

- Eintrag mit gesetztem `PRIVATE`-Passwort wird in der Liste nur als Platzhalter mit
  Passwort-Eingabefeld gerendert.
- Bei korrekter Eingabe (case-insensitiver Vergleich) wird eine Sitzung in `LOGIN` angelegt
  (zufällige `SESSIONID`), die nachfolgend als `decode`-Parameter mitgeführt wird, um den Eintrag
  aufzulösen.
- 3 Fehlversuche sperren weitere Versuche für diesen Eintrag/diese IP.
- „Passwort per Mail zusenden“-Funktion (an die im Eintrag hinterlegte E-Mail), eigene
  Flood-Control-Tabelle (`MAILSPAM`).

## 6. Moderation

- `SETTINGS.MODERATEDMODE` global aktivierbar.
- Neue Einträge/Kommentare erhalten dann `UNMODERATED = 1` und sind in der öffentlichen Liste
  unsichtbar, bis ein Admin sie freischaltet (Freischaltung selbst ist Admin-Funktion, außerhalb
  des Migrationsumfangs — aber die Besucher-API muss den Status korrekt respektieren und dem
  Besucher eine passende Meldung anzeigen).

## 7. Bewertungen & Zusatzfelder (dynamisch, Admin-konfiguriert)

- **Bewertungs-Boxen**: administrierbare Kategorien (z. B. „Design“, „Inhalt“) mit Skala
  1..`MAXVLUE`; pro Eintrag optional oder Pflicht (`FRCE`), je Box konfigurierbar.
- **Zusatzfelder**: administrierbare Felder vom Typ Text, Zahl (mit Bereich) oder Auswahlliste;
  pro Feld optional oder Pflicht.
- Beide Konzepte sind rein datengetrieben (aus `RATINGBOX`/`CUSTOMFIELD` gelesen) — die neue API
  muss sie dynamisch als Formular-Metadaten ausliefern, nicht hartkodieren.

## 8. Reservierte Namen (optionales Feature)

- Besucher kann einen Namen mit Passwort „reservieren“ (`USER`-Tabelle, Admin-verwaltet).
- Signiert jemand mit diesem Namen + korrektem Passwort, werden Profildaten (E-Mail, Homepage,
  IM-Handles, Land, Geschlecht, Bild, Signaturtext, Zusatzfelder) automatisch übernommen/angehängt.
- Schützt vor Namens-Missbrauch/Identitätsdiebstahl im Gästebuch.

## 9. Captcha / Anti-Spam

- Einfaches Bild-Captcha (Klartext auf PNG, siehe Sicherheitsanmerkung in
  [legacy-architecture.md](legacy-architecture.md)) — nur aktiv, wenn `SETTINGS.USETICKETS`
  gesetzt ist.
- IP-basierte Flood-Control (ein Post pro IP alle `SETTINGS.MAXSPAMTIME` Minuten) für
  Neueinträge, Kommentare und „Passwort per Mail“.
- IP-/Robot-Sperrliste (`SETTINGS.BANLIST`/`BANROBOTS`) blockt den gesamten Gästebuch-Zugriff.

## 10. Sonstige Besucher-Funktionen

- **Emoticon-Hilfeseite**: zeigt alle verfügbaren Emoticon-Codes (`show.php::emoticon()`).
- **BBCode-Hilfeseite**: zeigt verfügbare BBCode-Tags (`show.php::BBCodeInfo()`).
- **Bild-Anzeige/Skalierung**: hochgeladene Bilder werden servergseitig per GD auf
  Vorschaugröße skaliert (`show.php::picture()`).
- **„Nachricht an Autor senden“**: Kontaktformular, das eine E-Mail an den (verborgenen)
  Absender eines Eintrags weiterleitet, ohne dessen Adresse offenzulegen
  (`show.php::mailform()`/`mailer()`/`gbsend()`).
- **Statistikseite**: einfache Besucherzähler-/Eintragszähler-Anzeige (aus `VISITOR`/`ACTION`/
  `SETTINGS.VISITORS`).
- **Sprachumschaltung**: manuell per Parameter, keine Auto-Erkennung.

## Nicht migrierter Scope (Admin-Bereich, zur Klarheit ausgeschlossen)

`admin.php`, `admin/*` (Login, Eintragsverwaltung/-freigabe, Einstellungen, Backup/Restore,
Bewertungs-/Zusatzfeld-Konfiguration, Sprachverwaltung, Design/Skin-Verwaltung). Diese bleiben
vorerst PHP-basiert unverändert bzw. werden in einem späteren, separaten Schritt betrachtet.
