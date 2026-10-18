import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { IconName } from '../icons';

export const GROUPS = ['Allgemein', 'Moderation', 'Community', 'Engagement', 'Server & Tools'] as const;
export type ModuleGroup = (typeof GROUPS)[number];

export interface ModuleDef {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  group: ModuleGroup;
  component: LazyExoticComponent<ComponentType>;
}

export const MODULES: ModuleDef[] = [
  { id: 'general', label: 'Allgemein', description: 'Prefix, Moderator- und Admin-Rolle, Grundeinstellungen', icon: 'settings', group: 'Allgemein', component: lazy(() => import('./General')) },
  { id: 'commands', label: 'Commands', description: 'Commands und Kategorien für diesen Server an- und ausschalten', icon: 'commands', group: 'Allgemein', component: lazy(() => import('./Commands')) },
  { id: 'automod', label: 'AutoMod', description: 'Spam, Links, Einladungen, Schimpfwörter und Erwähnungen filtern', icon: 'shield', group: 'Moderation', component: lazy(() => import('./Automod')) },
  { id: 'moderation', label: 'Moderation', description: 'Fälle, Verwarnungen und Moderationsprotokoll', icon: 'gavel', group: 'Moderation', component: lazy(() => import('./Moderation')) },
  { id: 'logging', label: 'Logging', description: 'Welche Ereignisse in welchen Kanal protokolliert werden', icon: 'log', group: 'Moderation', component: lazy(() => import('./Logging')) },
  { id: 'welcome', label: 'Willkommen', description: 'Begrüßung, Abschied und Auto-Rollen für neue Mitglieder', icon: 'wave', group: 'Community', component: lazy(() => import('./Welcome')) },
  { id: 'verification', label: 'Verifizierung', description: 'Verifizierungs-Panel und automatische Verifizierung', icon: 'verify', group: 'Community', component: lazy(() => import('./Verification')) },
  { id: 'reactionroles', label: 'Reaktionsrollen', description: 'Rollen zur Selbstauswahl über Menüs', icon: 'reaction', group: 'Community', component: lazy(() => import('./ReactionRoles')) },
  { id: 'tickets', label: 'Tickets', description: 'Ticket-Panel, Support-Team, Kategorien und Transkripte', icon: 'ticket', group: 'Community', component: lazy(() => import('./Tickets')) },
  { id: 'applications', label: 'Bewerbungen', description: 'Bewerbungsrollen, Fragen und Bearbeitung', icon: 'clipboard', group: 'Community', component: lazy(() => import('./Applications')) },
  { id: 'leveling', label: 'Leveling', description: 'XP, Level-Up-Nachrichten und Level-Rollen', icon: 'level', group: 'Engagement', component: lazy(() => import('./Leveling')) },
  { id: 'economy', label: 'Economy', description: 'Shop, Premium-Rolle und Kontostände', icon: 'coins', group: 'Engagement', component: lazy(() => import('./Economy')) },
  { id: 'giveaways', label: 'Giveaways', description: 'Giveaways starten, beenden und neu auslosen', icon: 'gift', group: 'Engagement', component: lazy(() => import('./Giveaways')) },
  { id: 'birthdays', label: 'Geburtstage', description: 'Geburtstagskanal, Rolle und gespeicherte Geburtstage', icon: 'cake', group: 'Engagement', component: lazy(() => import('./Birthdays')) },
  { id: 'counting', label: 'Zählspiel', description: 'Zählkanal, Regeln und Bestenliste', icon: 'hash', group: 'Engagement', component: lazy(() => import('./Counting')) },
  { id: 'jointocreate', label: 'Join-to-Create', description: 'Temporäre Sprachkanäle mit Vorlagen und Limits', icon: 'mic', group: 'Server & Tools', component: lazy(() => import('./JoinToCreate')) },
  { id: 'serverstats', label: 'Server-Statistiken', description: 'Zähler-Kanäle für Mitglieder, Bots und mehr', icon: 'stats', group: 'Server & Tools', component: lazy(() => import('./ServerStats')) },
  { id: 'music', label: 'Musik', description: 'Musik-Einstellungen wie 24/7-Modus', icon: 'music', group: 'Server & Tools', component: lazy(() => import('./Music')) },
  { id: 'reports', label: 'Meldungen', description: 'Kanal für Nutzermeldungen', icon: 'flag', group: 'Server & Tools', component: lazy(() => import('./Reports')) },
];
