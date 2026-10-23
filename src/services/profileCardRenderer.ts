// Renders profile and level-up cards to PNG with @napi-rs/canvas (shared renderer in src/shared/profileCard.ts).
// Fonts and the SSRF-safe image loader come from the welcome card renderer.

import { createCanvas } from '@napi-rs/canvas';
import { AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { ProfileCardSubject, ResolvedCosmetics } from '../shared/cosmetics.js';
import {
  LEVELUP_CARD_HEIGHT, LEVELUP_CARD_WIDTH, PROFILE_CARD_HEIGHT, PROFILE_CARD_WIDTH, renderLevelUpCard, renderProfileCard,
} from '../shared/profileCard.js';
import { getBalance, getPetStage, getProfileSettings, getResolvedCosmetics } from './cosmetics/store.js';
import { getLeaderboard, getUserLevelData, getXpForLevel } from './leveling/leveling.js';
import { loadRemoteImage } from './welcomeCardRenderer.js';
import { logger } from '../utils/logger.js';
import type { NexoClient } from '../types/index.js';

const avatarUrl = (member: GuildMember) => member.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });

export async function renderProfileCardPng(subject: ProfileCardSubject, cosmetics: ResolvedCosmetics): Promise<Buffer> {
  const avatar = subject.avatarUrl ? await loadRemoteImage(subject.avatarUrl) : null;
  const canvas = createCanvas(PROFILE_CARD_WIDTH, PROFILE_CARD_HEIGHT);
  renderProfileCard(canvas.getContext('2d'), subject, cosmetics, { avatar });
  return canvas.encode('png');
}

export async function renderLevelUpCardPng(subject: ProfileCardSubject, cosmetics: ResolvedCosmetics, level: number, reward: number): Promise<Buffer> {
  const avatar = subject.avatarUrl ? await loadRemoteImage(subject.avatarUrl) : null;
  const canvas = createCanvas(LEVELUP_CARD_WIDTH, LEVELUP_CARD_HEIGHT);
  renderLevelUpCard(canvas.getContext('2d'), subject, cosmetics, level, reward, { avatar });
  return canvas.encode('png');
}

// ponytail: rank = position in the top 100 (same source as /rank leaderboard); members below that show "–".
async function findRank(client: NexoClient, guildId: string, userId: string): Promise<number | null> {
  try {
    const board = await getLeaderboard(client, guildId, 100);
    return board.find((entry) => entry.userId === userId)?.rank ?? null;
  } catch {
    return null;
  }
}

/** Everything the cards need for `member` on its server (level data, rank, global cosmetics and wallet). */
export async function loadProfileCardData(client: NexoClient, member: GuildMember, withRank = true): Promise<{ subject: ProfileCardSubject; cosmetics: ResolvedCosmetics }> {
  const [levelData, settings, cosmetics, balance, rank, stage] = await Promise.all([
    getUserLevelData(client, member.guild.id, member.id),
    getProfileSettings(member.id),
    getResolvedCosmetics(member.id),
    getBalance(member.id),
    withRank ? findRank(client, member.guild.id, member.id) : Promise.resolve(null),
    getPetStage(member.id),
  ]);
  return {
    cosmetics,
    subject: {
      name: member.displayName,
      username: member.user.username,
      avatarUrl: avatarUrl(member),
      bio: settings.bio,
      level: levelData.level,
      xp: levelData.xp,
      // Same threshold addXp uses to level up.
      xpNeeded: getXpForLevel(levelData.level),
      rank,
      serverName: member.guild.name,
      balance,
      petStage: stage,
    },
  };
}

/** The member's profile card as attachment, or null when rendering fails (callers fall back to text). */
export async function profileCardAttachment(client: NexoClient, member: GuildMember, name = 'profil.png'): Promise<AttachmentBuilder | null> {
  try {
    const { subject, cosmetics } = await loadProfileCardData(client, member);
    return new AttachmentBuilder(await renderProfileCardPng(subject, cosmetics), { name });
  } catch (error) {
    logger.warn(`Profile card render failed for ${member.id}:`, error);
    return null;
  }
}

/** The level-up card as attachment, or null when rendering fails. */
export async function levelUpCardAttachment(client: NexoClient, member: GuildMember, level: number, reward: number): Promise<AttachmentBuilder | null> {
  try {
    const { subject, cosmetics } = await loadProfileCardData(client, member, false);
    return new AttachmentBuilder(await renderLevelUpCardPng(subject, cosmetics, level, reward), { name: 'levelup.png' });
  } catch (error) {
    logger.warn(`Level-up card render failed for ${member.id}:`, error);
    return null;
  }
}

/** Whether Nexo may attach files where `interaction` answers (slash: app permissions, prefix: channel permissions). */
export function canAttachFiles(interaction: Pick<ChatInputCommandInteraction, 'appPermissions' | 'guild' | 'channel'>): boolean {
  if (interaction.appPermissions) return interaction.appPermissions.has(PermissionFlagsBits.AttachFiles);
  const me = interaction.guild?.members.me;
  const channel = interaction.channel;
  if (!me || !channel || channel.isDMBased()) return false;
  return channel.permissionsFor(me)?.has(PermissionFlagsBits.AttachFiles) ?? false;
}
