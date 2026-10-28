# Architektur-Umbau: Feature-Scheiben

Dieses Dokument ist der Bauplan für den Umbau von NexoBot auf Feature-Scheiben. Jedes Feature bekommt dieselbe
innere Aufteilung wie bei MVC, und jede Scheibe wird als eigener Pull-Request umgebaut. Leveling ist der Pilot
(PR #32) und gilt als Vorlage für alle weiteren Features.

## Zielbild

Jedes Feature liegt mit seiner Logik in `src/services/<feature>/` und besteht aus vier Teilen. Die Controller bleiben
an ihren heutigen Orten, weil die Loader Commands, Events und Interactions über ihre Pfade finden und die customIds
nicht geändert werden dürfen.

| Rolle | Ort | Darf | Darf nicht |
| --- | --- | --- | --- |
| Controller | `src/commands/<Kategorie>/`, `src/interactions/`, `src/handlers/`, `src/events/`, `src/web/modules/` | Eingaben lesen und prüfen, Service aufrufen, View rendern | Datenbank anfassen, Regeln selbst rechnen |
| Service | `src/services/<feature>/<feature>.ts` | Abläufe und Regeln, Store und Kern aufrufen, Fehler werfen | Werte aus `discord.js` oder `express` importieren (Typen sind erlaubt) |
| Store | `src/services/<feature>/store.ts` | als einziges Modul die Daten des Features lesen und schreiben, SQL für Ranglisten und Listen | Embeds bauen, Discord aufrufen |
| Kern | `src/services/<feature>/core.ts` | reine Funktionen: Rechnen, Regeln, Standardwerte | Datenbank, Netzwerk, Zeit ohne Parameter |
| View | `src/services/<feature>/views.ts` (Discord), `dashboard/src/` (Web) | Embeds, Buttons, Menüs, Modals bauen | Datenbank, Geschäftsregeln |

Die Abhängigkeiten zeigen nur nach unten: Controller → Service → Store und Kern. Views werden nur von Controllern
aufgerufen. Ein Feature darf ein anderes nur über dessen Service benutzen, nie über dessen Store.

## Regeln für jeden Umbau

- Ein Feature pro Pull-Request, von einem aktuellen `main` aus.
- Tabellen, Spalten, Key-Präfixe `guild:{guildId}:...`, das Schema-Ledger, die Defaults in
  `src/config/database/postgres.ts` und alle customIds bleiben unverändert. Es wird Code verschoben, keine Datenhaltung.
- Deutsche Texte und das sichtbare Verhalten bleiben gleich. Absichtliche Abweichungen stehen im PR-Text.
- Jede Schleife mit einem Datenbankzugriff pro Eintrag (N+1) wird im Store durch eine einzige Abfrage ersetzt und gegen
  den alten Ablauf geprüft (wie im Pilot mit PGlite).
- Der Kern bekommt einen kleinen Test in `tests/<feature>Core.test.ts`.
- Vor jedem Commit sind `npm run typecheck`, `npm run build` und `npm test` grün. Vor dem Merge wird das Feature mit
  dem Test-Bot und Docker-Postgres ausprobiert, nie mit der Railway-Datenbank.
- Nach dem Merge: Branch lokal und auf GitHub löschen, `main` ziehen, Railway neu deployen.

## Reihenfolge und Stand

Die Reihenfolge beginnt mit kleinen Features, deren Daten heute in `src/utils/database.ts` liegen. So schrumpft diese
Sammeldatei Schritt für Schritt, bis sie am Ende verschwindet.

### Vorbereitung

- [x] `chore/cleanup` pushen, PR öffnen und mergen (toter Code, Duplikate; enthält schon Teile, die der Umbau braucht)
- [x] PR #32 (Leveling-Pilot) mit dem Test-Bot prüfen und mergen; Konflikte mit `chore/cleanup` stehen im PR-Text
- [x] Architektur-Test anlegen, der die Regeln prüft: Services ohne Wert-Import aus `discord.js`/`express`, Controller
      ohne direkten Datenbankzugriff (`tests/architecture.test.ts`). Noch nicht umgebaute Dateien stehen auf einer
      Ausnahmeliste, die mit jedem PR schrumpft

### Welle 1: kleine Features mit Daten in `utils/database.ts`

- [x] Leveling (Pilot, PR #32): Kern, Store mit einer Ranglisten-Abfrage, Views
- [x] Geburtstage: `birthdayService.ts`, Commands `Birthday/`, Web `birthdays.ts`; Daten aus `utils/database.ts`
      (`getGuildBirthdays`, `setBirthday`, `deleteBirthday`); `/birthday next` holt Mitglieder einzeln
- [x] Server-Statistiken: `serverstatsService.ts`, Commands `ServerStats/`, Buttons `counter`, Web `serverstats.ts`
- [x] Gewinnspiele: `giveawayService.ts`, `giveawayActions.ts`, `utils/giveaways.ts`, Buttons `giveaway`; der Service
      baut heute Embeds und Buttons (in die View verschieben)
- [x] Join-to-Create: `joinToCreateService.ts`, Event `voiceStateUpdate.ts`, Web `jointocreate.ts`; Daten aus
      `utils/database.ts` (Konfiguration, temporäre Kanäle)

### Welle 2: Features mit großen Dashboards in Discord

- [ ] Willkommen und Abschied: `utils/welcome.ts`, `welcomeCardRenderer.ts`, Commands `Welcome/` mit
      `greet_dashboard.ts`, Events `guildMemberAdd`/`Remove`, Web `welcome.ts`
- [ ] Bewerbungen: `applicationService.ts`, Commands `Community/` (`app_dashboard.ts`, `apply.ts`, `app-admin.ts`),
      Web `applications.ts`; Bewerbungslisten lesen einen Key pro Bewerbung
- [ ] Tickets: `ticket.ts` (über 1.000 Zeilen, baut viele Embeds), `ticketPanel.ts`, `utils/database/tickets.ts`,
      `handlers/ticketButtons.ts`, Commands `Ticket/`, Web `tickets.ts`; Ticketlisten lesen einen Key pro Ticket
- [ ] Verifizierung: `verificationService.ts`, `verificationPanel.ts`, Buttons `verification`, Commands
      `Verification/`, Web `verification.ts`

### Welle 3: große Datenbereiche

- [ ] Wirtschaft: `utils/economy.ts`, `economyService.ts`, Commands `Economy/` (24 Dateien), Web `economy.ts`;
      Bestenliste und `economy_dashboard.ts` lesen einen Key pro Nutzer
- [ ] Moderation: `services/moderation/` (Verwarnungen, Notizen), `utils/moderation.ts`, Commands `Moderation/`
      (22 Dateien), Web `moderation.ts`; Verwarnungen und Notizen lesen pro Nutzer einzeln
- [ ] Logging: `loggingService.ts`, `utils/logging/`, Buttons und Menüs `logging`, Web `logging.ts`
- [ ] Reaktionsrollen: `reactionRoleService.ts`, `reactionRolePanel.ts`, Command `Reaction_roles/` (851 Zeilen),
      Web `reactionroles.ts`
- [ ] Automod: `automodService.ts`, Web `automod.ts`
- [ ] Zählspiel: `countingGameService.ts`, Web `counting.ts`

### Welle 4: Rest und Abschluss

- [ ] Musik: `services/music/` (hat schon eine eigene Struktur; Store für den Zustand pro Server, der heute nie
      gelöscht wird)
- [ ] Kern-Commands: `Core/` (Hilfe, Konfiguration, Command-Zugriff), `commandAccessService.ts`, Web `commands.ts`,
      `general.ts`
- [ ] Werkzeuge und Spaß: `Tools/`, `Utility/`, `Fun/`, `Search/`, `services/games/`; meist nur Controller und Views
- [ ] Cosmetics: `services/cosmetics/` ist schon eine Scheibe; nur prüfen und `achievements.ts`, `linkedRoles.ts` und
      `web/publicProfile.ts` über den Leveling-Store lesen lassen statt direkt aus `user_levels`
- [ ] `src/utils/database.ts` ist leer und wird gelöscht
- [ ] Architektur-Test gilt für alle Features, die Ausnahmeliste ist leer

## Offene Befunde aus dem Aufräumen

Diese Punkte gehören zum jeweiligen Feature-Umbau und werden dort erledigt. Was beim Test mit dem Test-Bot auffiel
(Fehler, Banner, Werkzeuge), steht in `docs/BEFUNDE.md`.

- Zwei `getColor` mit unterschiedlichem Rückgabetyp (`config/bot.ts` liefert eine Zahl, `utils/database.ts` einen
  Hex-String).
- `extractId` in `interactions/modals/config/config_modal.ts` und `commands/Core/configWizard.ts` verhalten sich
  unterschiedlich.
- Discord-IDs werden mal mit 17–19, mal mit 17–20 und mal mit 18–20 Ziffern geprüft; einheitlich `isSnowflake` aus
  `utils/validation.ts` verwenden.
- Ungenutzte Zweige in `appConfig` (`config/application.ts`).
- `getLegacyVariantsForCanonical` in `utils/database/keys.ts` ignoriert das Muster der Resolver; erst mit einem Test
  absichern.
