// Right-click (user) commands: "Profilkarte ansehen" shows a member's card just for you, "Zum Spiel herausfordern"
// picks a game in a small menu and posts the challenge in the channel (the same game flow as /fun spiel).
// Registered next to the slash commands (handlers/loaders/commandLoader.ts), dispatched in events/interactionCreate.

import {
  ActionRowBuilder, ApplicationCommandType, ButtonBuilder, ButtonStyle, ComponentType, ContextMenuCommandBuilder,
  InteractionContextType, StringSelectMenuBuilder, type Message, type UserContextMenuCommandInteraction,
} from 'discord.js';
import type { NexoClient } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { InteractionHelper } from '../utils/interactionHelper.js';
import { ACCENTS, nexoCard, nexoMessage } from '../utils/nexoMessage.js';
import { publicDashboardUrl } from '../web/dashboard.js';
import { challengeProblem, playGame, refusalMessage, type GameKind } from '../commands/Fun/modules/spiel.js';
import { canAttachFiles, profileCardAttachment } from './profileCardRenderer.js';

interface ContextMenu {
  data: ContextMenuCommandBuilder;
  execute(interaction: UserContextMenuCommandInteraction, client: NexoClient): Promise<void>;
}

const userCommand = (name: string) => new ContextMenuCommandBuilder().setName(name).setType(ApplicationCommandType.User).setContexts(InteractionContextType.Guild);

const GAMES: { value: GameKind; label: string; description: string; emoji: string }[] = [
  { value: 'viergewinnt', label: 'Vier gewinnt', description: 'Vier Steine in einer Reihe gewinnen', emoji: '🔴' },
  { value: 'tictactoe', label: 'Tic-Tac-Toe', description: 'Drei in einer Reihe auf 3×3 Feldern', emoji: '❌' },
  { value: 'quiz', label: 'Quiz-Duell', description: '5 Fragen – wer zuerst richtig liegt, punktet', emoji: '🧠' },
];

export const CONTEXT_MENUS: ContextMenu[] = [
  {
    data: userCommand('Profilkarte ansehen'),
    async execute(interaction, client) {
      await InteractionHelper.safeDefer(interaction);
      const member = await interaction.guild?.members.fetch(interaction.targetId).catch(() => null);
      if (!member) {
        await InteractionHelper.safeEditReply(interaction, nexoMessage(nexoCard({ kicker: 'Profil', title: 'Nicht auf diesem Server', accent: ACCENTS.warn, blocks: [{ text: 'Dieses Mitglied ist nicht (mehr) auf diesem Server.' }] })));
        return;
      }
      const card = canAttachFiles(interaction) ? await profileCardAttachment(client, member) : null;
      const base = publicDashboardUrl();
      const own = member.id === interaction.user.id;
      const buttons = own && base ? [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Profil gestalten').setURL(`${base}/me`)] : [];
      await InteractionHelper.safeEditReply(interaction, card
        ? { ...nexoMessage(nexoCard({ blocks: [{ images: [`attachment://${card.name}`] }, { buttons }] })), files: [card] }
        : nexoMessage(nexoCard({ kicker: 'Profil', title: member.displayName, blocks: [{ text: 'Die Profilkarte kann hier gerade nicht gezeigt werden (Nexo darf keine Dateien senden).' }, { buttons }] })));
    },
  },
  {
    data: userCommand('Zum Spiel herausfordern'),
    async execute(interaction) {
      const p2 = interaction.targetUser;
      const problem = await challengeProblem(interaction.user, p2, 0);
      if (problem) {
        await InteractionHelper.safeReply(interaction, refusalMessage('viergewinnt', problem));
        return;
      }
      const select = new StringSelectMenuBuilder().setCustomId(`spielwahl_${interaction.id}`).setPlaceholder('Spiel auswählen')
        .addOptions(GAMES.map((game) => ({ label: game.label, value: game.value, description: game.description, emoji: game.emoji })));
      await InteractionHelper.safeReply(interaction, nexoMessage(
        nexoCard({ kicker: 'Spiel gegen andere', title: `🎲 Gegen ${p2.username}`, blocks: [{ text: 'Was wollt ihr spielen? Einen Einsatz in Bernis kannst du mit /fun spiel festlegen.' }] }),
        { ephemeral: true, rows: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)] },
      ));
      const reply = await interaction.fetchReply();
      const choice = await reply.awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60_000, filter: (i) => i.user.id === interaction.user.id }).catch(() => null);
      if (!choice) {
        await interaction.editReply(nexoMessage(nexoCard({ kicker: 'Spiel gegen andere', title: 'Abgebrochen', accent: ACCENTS.calm, blocks: [{ text: 'Kein Spiel ausgewählt.' }] }))).catch(() => undefined);
        return;
      }
      const kind = choice.values[0] as GameKind;
      await choice.update(nexoMessage(nexoCard({ kicker: 'Spiel gegen andere', title: 'Herausforderung gesendet', blocks: [{ text: `${p2.username} kann jetzt im Kanal annehmen.` }] })));
      await playGame({ kind, p1: interaction.user, p2, stake: 0, guildId: interaction.guildId, seed: interaction.id },
        async (payload) => await choice.followUp(payload) as Message);
    },
  },
];

/** Runs the matching user command; false when it is not one of ours. */
export async function handleContextMenu(interaction: UserContextMenuCommandInteraction, client: NexoClient): Promise<boolean> {
  const menu = CONTEXT_MENUS.find((entry) => entry.data.name === interaction.commandName);
  if (!menu) return false;
  try {
    await menu.execute(interaction, client);
  } catch (error) {
    logger.warn(`Kontextmenü „${interaction.commandName}“ fehlgeschlagen:`, (error as Error).message);
  }
  return true;
}
