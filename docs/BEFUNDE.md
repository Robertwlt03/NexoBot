# Befunde aus dem Test mit „NexoBot Test“

Diese Liste sammelt alles, was beim Prüfen von PR #32 (Leveling-Scheibe) mit dem neuen Test-Bot am 28.10.2026
aufgefallen ist. Jeder Punkt sagt, was passiert, woran es liegt und was der Vorschlag ist. Die Punkte sind nach
Dringlichkeit sortiert; erledigte Punkte werden abgehakt.

## Fehler

- [ ] **XP-Anzeige ein Level zu hoch.** Die Rangliste zeigt bei Level 5 „0/530 XP“, die Rang-Karte richtig „0/425 XP“.
      Beim Aufsteigen rechnet der Bot mit `getXpForLevel(level)` (`services/leveling/core.ts`, `applyXp`), vier Stellen
      zeigen aber `getXpForLevel(level + 1)` (Stand PR #32): die Rangliste und das Level-Embed in `services/leveling/views.ts`
      (Zeilen 28 und 45) sowie `xpNeeded` und der Platzhalter `{xpNeeded}` der Level-up-Nachricht in
      `services/leveling/xpSystem.ts` (Zeilen 94 und 164). War schon vor dem Umbau so. Vorschlag: überall `level`
      nehmen und mit einem Test in `tests/levelingCore.test.ts` absichern.
- [ ] **Event-Banner im Bot-Profil: Text liegt unter dem Profilbild.** `services/cosmetics/botProfile.ts` zeichnet den
      Eventnamen auf halber Höhe und die Rabattzeile („−15 % im Nexo-Shop“) darunter, beides links. Genau dort legt
      Discord das Profilbild über das Banner, deshalb ist die Rabattzeile bei allen Events mit Rabatt nur noch als
      „–1… -Shop“ zu sehen (geprüft für alle neun festen Events und ein eigenes Event).
- [ ] **Event-Banner: Discord schneidet oben und unten ab.** Das Banner ist 960 × 384 (5 : 2), das Profil zeigt es aber
      etwa im Verhältnis 17 : 6. Oben und unten fallen rund 24 px weg, Symbole am Rand werden angeschnitten.
- [ ] **Event-Banner: lange Namen werden gestaucht.** Der Name hat eine feste Höchstbreite (`W * 0.52`); ein eigenes
      Event wie „Sommerfest im Café“ wird schmal gedrückt statt kleiner gesetzt oder umbrochen.
- [ ] **Leere Rangliste meldet „Datenbankfehler“.** `commands/Leveling/modules/leaderboard.ts` wirft bei leerer Liste
      einen `NexoBotError` vom Typ `DATABASE`; der Nutzer sieht einen roten „Datenbankfehler“ mit Ref-Nummer, obwohl
      nichts kaputt ist. Vorschlag: eine normale Info-Karte („Noch keine Level-Daten …“) statt eines Fehlers.

## Banner auf den Antworten des Bots

- [ ] **Der Test-Bot zeigt keine Karten-Banner.** Alle Antworten kommen als Nexo-Karte, aber ohne Banner, weil
      `utils/cardBanner.ts` nur dann ein Banner einsetzt, wenn `DASHBOARD_URL` eine öffentliche https-Adresse ist; lokal
      ist sie leer. Das ist so gewollt, verhindert aber, die Banner lokal zu prüfen. Vorschlag: in `.env.local`
      `DASHBOARD_URL` auf die öffentliche Dashboard-Adresse des Live-Bots setzen (der Banner-Endpunkt
      `/dashboard/banners/<motiv>.png` ist öffentlich und zeichnet jede Farbe), oder lokal einen Tunnel nutzen. Danach
      jede Antwort einmal durchklicken und prüfen, dass alle Karten ein Banner haben.
- [ ] **Bewusst ohne Banner prüfen.** `embedToCard` lässt das Banner weg, wenn die Karte ein eigenes Bild hat (z. B. die
      Rang-Karte) oder nur ein Vorschaubild ohne Text. Beim Durchklicken klären, ob das überall so gewollt ist.
- [ ] **Fehlerkarte des Live-Bots ohne Banner.** Die Meldung „Datenbankfehler“ des Live-Bots kam ohne Banner. Nach dem
      nächsten Deploy prüfen, ob Fehlerkarten ein Banner bekommen sollen und ob die Live-Version aktuell ist.

## Profil des Bots

- [ ] **Event-Banner neu aufteilen.** Vorschlag: Name und Rabatt in die obere Hälfte und nach rechts, die Symbole nach
      links oben und in die Mitte, die linke untere Ecke (etwa 35 % Breite, untere 45 % Höhe) frei für das Profilbild.
      Alles mit rund 30 px Abstand zum oberen und unteren Rand, damit Discords Zuschnitt nichts abschneidet. Lange
      Namen kleiner setzen statt stauchen. Nach dem Umbau alle Events als Vorschau mit Profilbild prüfen (wie in
      dieser Prüfung).
- [ ] **Event-Banner im gleichen Stil wie das Dashboard.** Die Event-Banner sind heute Farbverläufe mit verstreuten
      Symbolen. Vorschlag: das Walnussholz mit der eingebrannten Ranke als Grund nehmen (wie die Seitenköpfe im
      Dashboard und das neue Profil-Banner) und das Event nur über Farbe, Symbole und Namen zeigen.
- [ ] **Event-Look überdeckt das Test-Banner.** Der Test-Bot läuft gegen dieselbe Datenbank und setzt während eines
      Events sein Server-Profil ebenfalls auf das Event-Banner und die Event-Bio. Das selbst hochgeladene Test-Banner
      mit gelbem Rand ist dann auf dem Testserver nicht zu sehen. Vorschlag: `startBotProfiles` nur im Live-Betrieb
      starten oder beim Test-Bot ein „TEST“ in Banner und Bio einsetzen.

## Testen und Betrieb

- [ ] **Lokaler Start fällt still in den Speicher-Modus.** Mit `NODE_ENV=production` verlangt der Bot SSL zur
      Datenbank; der Docker-Postgres kann kein SSL, und der Bot läuft ohne Abbruch mit Daten nur im Speicher weiter.
      Vorschlag: für `localhost` kein SSL verlangen und im Entwicklungsmodus abbrechen statt still weiterzulaufen.
- [ ] **`.env` enthält den Live-Token.** Wer lokal mit `.env` startet, betreibt den Live-Bot ein zweites Mal; beide
      beantworten dann dieselben Befehle. Seit dieser Prüfung gibt es `.env.local` mit dem Test-Bot
      (`DOTENV_CONFIG_PATH=.env.local node dist/app.js`). Vorschlag: das in `docs/SETUP.md` und `.env.example`
      beschreiben und lokal nur noch `.env.local` nutzen.
- [ ] **Slash-Commands werden bei jedem Start global registriert.** Das gilt auch für den Test-Bot. Vorschlag: im
      Entwicklungsmodus nur für `GUILD_ID` registrieren; das wirkt sofort und berührt nichts außerhalb des Testservers.
- [ ] **Railway-CLI abgemeldet.** `railway variables` und `railway redeploy` brauchen erst wieder `railway login`.
      Ob die Live-Version auf dem Stand von `main` ist, ließ sich deshalb nicht prüfen.

## Kleinigkeiten

- [ ] **Leeres Feld im `/level`-Dashboard.** Ein Leerfeld (`​`) für die Spaltenaufteilung erscheint im schmalen
      Discord-Fenster als einzelner Doppelpunkt. War schon vor dem Umbau so. Vorschlag: das Feld weglassen, die
      Karten-Darstellung braucht es nicht.
- [ ] **README-Banner veraltet.** `assets/banner*.webp` zeigen noch den älteren Stil; das Dashboard nutzt inzwischen
      Walnussholz mit eingebrannter Ranke. Vorschlag: die README-Banner im neuen Stil neu erzeugen.
