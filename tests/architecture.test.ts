import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Enforces the rules of docs/ARCHITEKTUR.md by reading the source files.
// Features that are not converted yet stay on the allow-lists below; every feature PR removes its files.

const root = new URL('../', import.meta.url);
const tsFiles = (dir: string) =>
  readdirSync(new URL(dir, root), { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.ts'))
    .map((name) => `${dir}/${name}`)
    .sort();
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

// Services may import types from discord.js/express, but no values. Views build embeds and are exempt.
const SERVICES_WITH_DISCORD_VALUES = new Set<string>([
  'src/services/applicationService.ts',
  'src/services/automodService.ts',
  'src/services/config/configService.ts',
  'src/services/contextMenus.ts',
  'src/services/cosmetics/achievements.ts',
  'src/services/cosmetics/botProfile.ts',
  'src/services/cosmetics/community.ts',
  'src/services/cosmetics/hooks.ts',
  'src/services/cosmetics/linkedRoles.ts',
  'src/services/cosmetics/presence.ts',
  'src/services/cosmetics/reminders.ts',
  'src/services/giveawayService.ts',
  'src/services/joinToCreateService.ts',
  'src/services/loggingService.ts',
  'src/services/moderation/moderationService.ts',
  'src/services/music/musicActions.ts',
  'src/services/music/musicEmbeds.ts',
  'src/services/music/prefixSupport.ts',
  'src/services/music/riffySetup.ts',
  'src/services/profileCardRenderer.ts',
  'src/services/reactionRolePanel.ts',
  'src/services/statsTracker.ts',
  'src/services/ticket.ts',
  'src/services/ticketPanel.ts',
  'src/services/verificationPanel.ts',
  'src/services/verificationService.ts',
]);

// Controllers go through a service; they never touch the database themselves.
const CONTROLLERS_WITH_DB_ACCESS = new Set<string>([
  'src/commands/Community/app-admin.ts',
  'src/commands/Community/apply.ts',
  'src/commands/Community/modules/app_dashboard.ts',
  'src/commands/Economy/modules/economy_dashboard.ts',
  'src/commands/Fun/modules/spiel.ts',
  'src/commands/JoinToCreate/jointocreate.ts',
  'src/commands/JoinToCreate/modules/config_setup.ts',
  'src/commands/JoinToCreate/modules/setup.ts',
  'src/commands/Profile/profil.ts',
  'src/commands/Ticket/modules/ticket_dashboard.ts',
  'src/commands/Ticket/ticket.ts',
  'src/commands/Utility/todo.ts',
  'src/commands/Verification/modules/autoVerify.ts',
  'src/commands/Verification/modules/autoVerifyDashboard.ts',
  'src/commands/Verification/modules/verification.ts',
  'src/commands/Verification/modules/verification_dashboard.ts',
  'src/commands/Welcome/modules/autorole.ts',
  'src/commands/Welcome/modules/goodbye.ts',
  'src/commands/Welcome/modules/greet_dashboard.ts',
  'src/commands/Welcome/modules/welcome.ts',
  'src/interactions/buttons/ticket/ticketFeedback.ts',
  'src/interactions/modals/ticket/ticketFeedbackComment.ts',
  'src/interactions/selectMenus/ticket/ticketFeedback.ts',
  'src/handlers/todoButtons.ts',
  'src/handlers/wipedataButtons.ts',
  'src/events/channelDelete.ts',
  'src/events/guildMemberAdd.ts',
  'src/events/guildMemberRemove.ts',
  'src/events/interactionCreate.ts',
  'src/events/voiceStateUpdate.ts',
  'src/web/modules/applications.ts',
  'src/web/modules/insights.ts',
  'src/web/modules/jointocreate.ts',
  'src/web/modules/me.ts',
  'src/web/modules/owner.ts',
  'src/web/modules/tickets.ts',
  'src/web/modules/verification.ts',
  'src/web/modules/welcome.ts',
]);

const importsValueFrom = (source: string, modules: RegExp) =>
  [...source.matchAll(/^\s*import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm)].some(([, typeOnly, clause, from]) => {
    if (typeOnly || !modules.test(from)) return false;
    const named = clause.match(/^\{([\s\S]*)\}$/);
    return !named || named[1].split(',').some((spec) => spec.trim() && !spec.trim().startsWith('type '));
  }) || [...source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].some(([, from]) => modules.test(from));

const DB_MODULE = /(^|\/)(utils\/database|config\/database|services\/[^/]+\/(store|db))(\.js|\/|$)/;
const accessesDb = (source: string) =>
  /\bclient\.db\b|\bpool\b|\.query\(/.test(source) ||
  [...source.matchAll(/(?:from\s+|import\(\s*)['"]([^'"]+)['"]/g)].some(([, from]) => DB_MODULE.test(from));

const services = tsFiles('src/services').filter((path) => !path.endsWith('/views.ts'));
const controllers = ['src/commands', 'src/interactions', 'src/handlers', 'src/events', 'src/web/modules'].flatMap(tsFiles);

function checkRule(files: string[], breaks: (source: string) => boolean, allowed: Set<string>, rule: string) {
  const offenders = files.filter((path) => breaks(read(path)));
  assert.deepEqual(offenders.filter((path) => !allowed.has(path)), [], `${rule}; move the code into the feature slice`);
  assert.deepEqual([...allowed].filter((path) => !offenders.includes(path)), [], 'already clean, remove from the allow-list');
}

test('services import no values from discord.js or express', () => {
  checkRule(services, (source) => importsValueFrom(source, /^(discord\.js|express)$/), SERVICES_WITH_DISCORD_VALUES,
    'service imports values from discord.js/express');
});

test('controllers do not access the database directly', () => {
  checkRule(controllers, accessesDb, CONTROLLERS_WITH_DB_ACCESS, 'controller accesses the database');
});
