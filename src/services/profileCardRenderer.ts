// Renders profile and level-up cards to PNG with @napi-rs/canvas (shared renderer in src/shared/profileCard.ts).
// Fonts and the SSRF-safe image loader come from the welcome card renderer.

import { createCanvas } from '@napi-rs/canvas';
import { AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { PetData, ProfileCardSubject, ResolvedCosmetics } from '../shared/cosmetics.js';
import { drawPet } from '../shared/pets.js';
import {
  LEVELUP_CARD_HEIGHT, LEVELUP_CARD_WIDTH, PROFILE_CARD_HEIGHT, PROFILE_CARD_WIDTH, YEAR_CARD_HEIGHT, YEAR_CARD_WIDTH, renderLevelUpCard, renderProfileCard,
  renderYearCard, type YearReview,
} from '../shared/profileCard.js';
import { getBalance, getProfileSettings, getResolvedCosmetics } from './cosmetics/store.js';
import { getEquippedPetLook } from './cosmetics/pets.js';
import { getRank, getUserLevelData, getXpForLevel } from './leveling/leveling.js';
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

/** The pet on a small dark stage with a soft spotlight (/profil pet), 2× for crisp edges. */
export async function renderPetPng(pet: PetData, stage: number, hungry: boolean): Promise<Buffer> {
  const [w, h, scale] = [360, 220, 2];
  const canvas = createCanvas(w * scale, h * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const back = ctx.createLinearGradient(0, 0, 0, h);
  back.addColorStop(0, '#1d1a26');
  back.addColorStop(1, '#0f0d14');
  ctx.fillStyle = back;
  ctx.fillRect(0, 0, w, h);
  const spot = ctx.createRadialGradient(w / 2, h * 0.62, 10, w / 2, h * 0.62, w * 0.5);
  spot.addColorStop(0, stage >= 4 ? 'rgba(255, 214, 102, 0.22)' : 'rgba(255, 255, 255, 0.10)');
  spot.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, w, h);
  drawPet(ctx as unknown as Parameters<typeof drawPet>[0], pet, w / 2, h / 2 - 8, 74, stage, hungry);
  return canvas.encode('png');
}

export async function renderLevelUpCardPng(subject: ProfileCardSubject, cosmetics: ResolvedCosmetics, level: number, reward: number): Promise<Buffer> {
  const avatar = subject.avatarUrl ? await loadRemoteImage(subject.avatarUrl) : null;
  const canvas = createCanvas(LEVELUP_CARD_WIDTH, LEVELUP_CARD_HEIGHT);
  renderLevelUpCard(canvas.getContext('2d'), subject, cosmetics, level, reward, { avatar });
  return canvas.encode('png');
}

/** The year review card (/profil jahr) as attachment, or null when rendering fails. */
export async function yearCardAttachment(client: NexoClient, member: GuildMember, review: YearReview): Promise<AttachmentBuilder | null> {
  try {
    const { subject, cosmetics } = await loadProfileCardData(client, member, false);
    const avatar = subject.avatarUrl ? await loadRemoteImage(subject.avatarUrl) : null;
    const canvas = createCanvas(YEAR_CARD_WIDTH, YEAR_CARD_HEIGHT);
    renderYearCard(canvas.getContext('2d'), subject, cosmetics, review, { avatar });
    return new AttachmentBuilder(await canvas.encode('png'), { name: `nexo-jahr-${review.year}.png` });
  } catch (error) {
    logger.warn(`Year card render failed for ${member.id}:`, error);
    return null;
  }
}

/** Everything the cards need for `member` on its server (level data, rank, global cosmetics and wallet). */
export async function loadProfileCardData(client: NexoClient, member: GuildMember, withRank = true): Promise<{ subject: ProfileCardSubject; cosmetics: ResolvedCosmetics }> {
  const [levelData, settings, cosmetics, balance, rank, pet] = await Promise.all([
    getUserLevelData(client, member.guild.id, member.id),
    getProfileSettings(member.id),
    getResolvedCosmetics(member.id),
    getBalance(member.id),
    withRank ? getRank(client, member.guild.id, member.id) : Promise.resolve(null),
    getEquippedPetLook(member.id),
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
      petStage: pet.stage,
      petHungry: pet.hungry,
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
