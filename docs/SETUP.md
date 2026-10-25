<p align="center">
  <img src="../assets/banner.webp" alt="Nexo – Ein Bot. Alle Funktionen." width="100%">
</p>

# Nexo selbst betreiben

Alles, was du brauchst, um NexoBot selbst zu hosten: Einrichtung, Umgebungsvariablen, Datenbank, Intents und Berechtigungen. Was Nexo kann, zeigt die [README](../README.md).

- [Commands](#commands)
- [Web-Dashboard](#web-dashboard)
- [Einrichtung](#einrichtung)
  - [Lokal](#lokal)
  - [Docker](#docker)
  - [Railway](#railway)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Intents und Berechtigungen](#intents-und-berechtigungen)

## <img src="../assets/icons/commands.svg" height="33" align="absmiddle" alt="">Commands

NexoBot bündelt die Funktionen in thematische Commands mit Subcommands, zum Beispiel `/eco balance`, `/mod warn` oder `/music play`. Das Profil hat einen eigenen Command: `/profil` mit `ansehen`, `bernis`, `shop`, `aufgaben`, `erinnerung`, `jahr` und `rollen`. Dazu kommen zwei Einträge im Rechtsklick-Menü eines Mitglieds: *Profilkarte ansehen* und *Zum Spiel herausfordern*. Die vollständige Zuordnung der früheren Einzel-Commands steht in [docs/COMMAND_MIGRATION.md](COMMAND_MIGRATION.md). `/help` zeigt alle Commands im Bot an.

## <img src="../assets/icons/dashboard.svg" height="33" align="absmiddle" alt="">Web-Dashboard

Das Dashboard läuft im selben Dienst wie der Bot unter `/dashboard`.

Einrichtung:

1. Im [Discord Developer Portal](https://discord.com/developers/applications) unter **OAuth2** das Client Secret kopieren und als Redirect `<DASHBOARD_URL>/dashboard/auth/callback` eintragen, zum Beispiel `http://localhost:3000/dashboard/auth/callback` lokal oder `https://<dein-dienst>.up.railway.app/dashboard/auth/callback` auf Railway.
2. `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` (z. B. `openssl rand -hex 32`) und `DASHBOARD_URL` setzen.
3. Auf Railway unter **Settings → Networking** eine öffentliche Domain erzeugen.
4. Für verknüpfte Rollen im Developer Portal unter **General Information** die *Linked Roles Verification URL* `<DASHBOARD_URL>/dashboard/linked-role` eintragen.

Ohne `DISCORD_CLIENT_SECRET` oder `SESSION_SECRET` bleibt das Dashboard deaktiviert und der Bot läuft normal weiter. `npm run build` baut Bot und Dashboard; für die Entwicklung startet `npm run dev:dashboard` einen Vite-Server mit Proxy auf den laufenden Bot.

## <img src="../assets/icons/setup.svg" height="33" align="absmiddle" alt="">Einrichtung

Voraussetzungen: ein Bot im [Discord Developer Portal](https://discord.com/developers/applications) mit Token und Client-ID sowie den unten genannten Intents.

### <img src="../assets/icons/local.svg" height="26" align="absmiddle" alt="">Lokal

Benötigt Node.js 20.10 oder neuer und PostgreSQL.

```bash
git clone https://github.com/Robertwlt03/NexoBot.git
cd NexoBot
npm install
cp .env.example .env   # DISCORD_TOKEN, CLIENT_ID und Datenbank eintragen
npm run build
npm start
```

Für die Entwicklung startet `npm run dev` den Bot mit automatischem Neuladen direkt aus den TypeScript-Quellen. `npm run typecheck` prüft die Typen ohne Build. `npm test` führt die Tests aus.

Eine lokale Datenbank lässt sich am einfachsten per Docker starten:

```bash
docker compose up -d db
```

Die Compose-Datenbank läuft dann auf `127.0.0.1:5432` (User/Passwort/DB aus `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`). Sie hat kein SSL: Setze `POSTGRES_SSL=false`, sonst schlägt die Verbindung mit `NODE_ENV=production` fehl und der Bot läuft im In-Memory-Modus.

### <img src="../assets/icons/docker.svg" height="26" align="absmiddle" alt="">Docker

```bash
cp .env.example .env   # mindestens DISCORD_TOKEN, CLIENT_ID, GUILD_ID setzen
docker compose up -d --build
```

Compose startet den Bot und PostgreSQL. Die Datenbank-Defaults (`nexobot` / `password` / `nexobot`) lassen sich über `POSTGRES_USER`, `POSTGRES_PASSWORD` und `POSTGRES_DB` in der `.env` überschreiben. Einen eigenen Lavalink-Knoten startet das Profil `local-lavalink`:

```bash
docker compose --profile local-lavalink up -d
```

Fertige Images: `ghcr.io/robertwlt03/nexobot`.

### <img src="../assets/icons/railway.svg" height="26" align="absmiddle" alt="">Railway

1. Repository in Railway verbinden und einen PostgreSQL-Dienst hinzufügen.
2. Im Bot-Dienst `DISCORD_TOKEN`, `CLIENT_ID` und `GUILD_ID` setzen und `POSTGRES_URL` bzw. `DATABASE_URL` auf die private Railway-Datenbank-URL verweisen lassen.
3. Railway baut über das `Dockerfile`. Migrationen laufen beim Start automatisch (`AUTO_MIGRATE=true`).

Healthchecks: `GET /health` (Prozess lebt) und `GET /ready` (Bot verbunden und Datenbank bereit).

### Storybook

```bash
npm run storybook          # http://localhost:6006
npm run build-storybook    # statische Fassung nach dist/storybook
```

Storybook beginnt mit einer Startseite, die alles erklärt. Es zeigt alle Dashboard-Seiten auf einer Übersicht, eine Seite in allen zwölf Farbvorlagen und Nexos Discord-Nachrichten, gebaut mit dem Code des Bots. Unter „Grundlagen“ stehen Farben, Schrift, Formen, Icons und Farbvorlagen, unter „Komponenten“ jeder Baustein mit Anleitung, Eigenschaften, Beispielen und Code zum Kopieren; dort prüft der Bereich „Accessibility“ Kontrast und Bedienbarkeit. Oben in der Leiste schaltest du Farbvorlage, hell oder dunkel und Desktop oder Handy um, jeweils dort, wo es etwas ändert. Die Beispieldaten kommen aus der lokalen `dashboard/mock-fixtures.ts` (nicht im Repository); ohne sie zeigen die Seiten ihren Fehlerzustand. Die Discord-Nachrichten und ihre Banner baut nur der Entwicklungsserver.

## <img src="../assets/icons/env.svg" height="33" align="absmiddle" alt="">Umgebungsvariablen

Alle Variablen mit Beispielwerten stehen in [.env.example](../.env.example). Die wichtigsten:

| Variable | Pflicht | Beschreibung |
| --- | --- | --- |
| `DISCORD_TOKEN` | ja | Bot-Token aus dem Developer Portal |
| `CLIENT_ID` | ja | Application-ID; Slash-Commands werden global registriert |
| `GUILD_ID` | nein | Server-ID für die Einrichtung |
| `OWNER_IDS` | nein | Kommagetrennte Discord-IDs der Bot-Besitzer |
| `POSTGRES_URL` / `DATABASE_URL` | empfohlen | Verbindungs-URL zur Datenbank |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | alternativ | Einzelwerte statt URL |
| `POSTGRES_SSL` | nein | SSL erzwingen (`true`/`false`) |
| `AUTO_MIGRATE` | nein | Migrationen beim Start ausführen (Standard `true`) |
| `PORT`, `WEB_HOST` | nein | Port und Host für `/health`, `/ready` und das Dashboard (Standard `3000`, `0.0.0.0`) |
| `DISCORD_CLIENT_SECRET` | für Dashboard | OAuth2 Client Secret für die Discord-Anmeldung |
| `SESSION_SECRET` | für Dashboard | Zufälliger Schlüssel zum Signieren der Sitzungs-Cookies |
| `DASHBOARD_URL` | für Dashboard | Öffentliche Basis-URL ohne `/dashboard`, z. B. `https://nexo.up.railway.app` (Standard `http://localhost:<PORT>`). Banner auf den Karten, Profil-Links und Linked Roles brauchen eine öffentliche https-Adresse |
| `LOG_LEVEL`, `LOG_TO_FILE` | nein | Log-Level und Datei-Logging |
| `LAVALINK_NODES_FILE`, `LAVALINK_NODES` | nein | Lavalink-Knoten für Musik |
| `TMDB_API_KEY` | nein | Für die Film- und Seriensuche |
| `SENTRY_DSN` | nein | Fehler an Sentry melden |

Ohne erreichbare Datenbank läuft der Bot in einem eingeschränkten In-Memory-Modus. Für den Produktivbetrieb ist PostgreSQL Pflicht.

### <img src="../assets/icons/database.svg" height="26" align="absmiddle" alt="">Datenbank-Werkzeuge

```bash
npm run migrate          # Schema-Migrationen anwenden
npm run migrate:status   # Stand anzeigen
npm run migrate:check    # prüfen, ob Migrationen offen sind
npm run backup:db        # Backup erstellen (pg_dump)
npm run restore:db       # Backup einspielen
```

Die Skripte laufen aus `dist/scripts/`, also vorher `npm run build` ausführen.

## <img src="../assets/icons/permissions.svg" height="33" align="absmiddle" alt="">Intents und Berechtigungen

Im Developer Portal aktivieren (Privileged Gateway Intents):

- **Server Members Intent**
- **Message Content Intent**

Der Bot nutzt außerdem die Intents Guilds, Guild Messages, Guild Message Reactions, Guild Voice States, Guild Moderation (Bans) und Direct Messages.

Einladung mit den Scopes `bot` und `applications.commands` und diesen Berechtigungen:

- Kanäle ansehen, Nachrichten senden, Links einbetten, Dateien anhängen, Nachrichtenverlauf lesen, Reaktionen hinzufügen, externe Emojis verwenden
- Nachrichten verwalten, Kanäle verwalten, Rollen verwalten
- Server verwalten (für `/automod`), Audit-Log ansehen
- Mitglieder kicken, Mitglieder bannen, Mitglieder moderieren (Timeout)
- Verbinden, Sprechen und Mitglieder verschieben (Musik, Join-to-Create)

Die Einladung über **Nexo einladen** im Dashboard fragt genau diese Berechtigungen an.

<p align="center">
  <img src="../assets/banner-footer.webp" alt="" width="480">
</p>
