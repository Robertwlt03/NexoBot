// Registry of dashboard API modules. Each module is mounted at /dashboard/api/guilds/:guildId/<id>;
// the guild access check has already run, so handlers read guild/member/session via locals(res).

import type { Router } from 'express';
import type { NexoClient } from '../../types/index.js';
import { generalModule } from './general.js';
import { commandsModule } from './commands.js';
import { automodModule } from './automod.js';
import { moderationModule } from './moderation.js';
import { loggingModule } from './logging.js';
import { welcomeModule } from './welcome.js';
import { verificationModule } from './verification.js';
import { reactionrolesModule } from './reactionroles.js';
import { ticketsModule } from './tickets.js';
import { applicationsModule } from './applications.js';
import { levelingModule } from './leveling.js';
import { economyModule } from './economy.js';
import { giveawaysModule } from './giveaways.js';
import { birthdaysModule } from './birthdays.js';
import { countingModule } from './counting.js';
import { jointocreateModule } from './jointocreate.js';
import { serverstatsModule } from './serverstats.js';
import { musicModule } from './music.js';
import { reportsModule } from './reports.js';

export interface DashboardModule {
  id: string;
  router: (client: NexoClient) => Router;
}

export const dashboardModules: DashboardModule[] = [
  generalModule,
  commandsModule,
  automodModule,
  moderationModule,
  loggingModule,
  welcomeModule,
  verificationModule,
  reactionrolesModule,
  ticketsModule,
  applicationsModule,
  levelingModule,
  economyModule,
  giveawaysModule,
  birthdaysModule,
  countingModule,
  jointocreateModule,
  serverstatsModule,
  musicModule,
  reportsModule,
];
