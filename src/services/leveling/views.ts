// Discord messages of the leveling feature (embeds and components). Controllers call these; the service never does.

import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from 'discord.js';
import type { Guild, GuildMember, TextChannel, User } from 'discord.js';
import { getColor } from '../../config/bot.js';
import { createEmbed } from '../../utils/embeds.js';
import { getXpForLevel, progressPercent } from './core.js';
import type { GuildLevelingConfig, LevelData } from './core.js';
import type { LeaderboardEntry } from './leveling.js';

export function disabledEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setColor('#f1c40f')
        .setDescription('Das Leveling-System ist auf diesem Server derzeit deaktiviert.');
}

export function leaderboardEmbed(leaderboard: LeaderboardEntry[]): EmbedBuilder {
    const medals = ['🥇', '🥈', '🥉'];
    const lines = leaderboard.map((user, index) => {
        const rankPrefix = medals[index] ?? `**${index + 1}.**`;
        return `${rankPrefix} <@${user.userId}> – Level ${user.level} (${user.xp}/${getXpForLevel(user.level + 1)} XP)`;
    });
    return new EmbedBuilder()
        .setTitle('Level-Bestenliste')
        .setColor('#2ecc71')
        .setDescription('Die 10 aktivsten Mitglieder auf diesem Server:')
        .setTimestamp()
        .addFields({ name: 'Rangliste', value: lines.join('\n') });
}

function progressBar(percentage: number, length: number): string {
    const filled = Math.round((percentage / 100) * length);
    return '█'.repeat(filled) + '░'.repeat(length - filled);
}

/** Text fallback of the rank card. */
export function rankEmbed(member: GuildMember, data: LevelData): EmbedBuilder {
    const xpNeeded = getXpForLevel(data.level + 1);
    const progress = progressPercent(data.xp, xpNeeded);
    return new EmbedBuilder()
        .setTitle(`Rang von ${member.displayName}`)
        .setThumbnail(member.displayAvatarURL())
        .addFields(
            { name: 'Level', value: data.level.toString(), inline: true },
            { name: 'XP', value: `${data.xp}/${xpNeeded}`, inline: true },
            { name: 'Gesamt-XP', value: data.totalXp.toString(), inline: true },
            { name: `Fortschritt bis Level ${data.level + 1}`, value: `${progressBar(progress, 20)} ${progress}%` },
        )
        .setColor('#2ecc71')
        .setTimestamp();
}

export function levelsAddedEmbed(user: User, levels: number, data: LevelData): EmbedBuilder {
    return createEmbed({
        title: 'Level hinzugefügt',
        description: `${user.tag} hat ${levels} Level erhalten.\n**Neues Level:** ${data.level}`,
        color: 'success',
    });
}

export function levelsRemovedEmbed(user: User, levels: number, data: LevelData): EmbedBuilder {
    return createEmbed({
        title: 'Level abgezogen',
        description: `${user.tag} wurden ${levels} Level abgezogen.\n**Neues Level:** ${data.level}`,
        color: 'success',
    });
}

export function levelSetEmbed(user: User, level: number, data: LevelData): EmbedBuilder {
    return createEmbed({
        title: 'Level gesetzt',
        description: `Das Level von ${user.tag} ist jetzt **${level}**.\n**Gesamt-XP:** ${data.totalXp}`,
        color: 'success',
    });
}

export function setupDoneEmbed(channel: TextChannel, xpMin: number, xpMax: number, xpCooldown: number, message: string): EmbedBuilder {
    return createEmbed({
        title: 'Leveling-System eingerichtet',
        description:
            `Das Leveling-System ist jetzt **aktiviert** und einsatzbereit.\n\n` +
            `**Level-up-Kanal:** ${channel}\n` +
            `**XP pro Nachricht:** ${xpMin} – ${xpMax}\n` +
            `**XP-Cooldown:** ${xpCooldown}s\n` +
            `**Level-up-Nachricht:** \`${message}\`\n\n` +
            `Mit \`/level dashboard\` kannst du diese Einstellungen jederzeit anpassen.`,
        color: 'success',
    });
}

export function buildDashboardEmbed(cfg: GuildLevelingConfig, guild: Guild) {
    const channel = cfg.levelUpChannel ? `<#${cfg.levelUpChannel}>` : '`Nicht gesetzt`';
    const xpMin = cfg.xpRange?.min ?? cfg.xpPerMessage?.min ?? 15;
    const xpMax = cfg.xpRange?.max ?? cfg.xpPerMessage?.max ?? 25;
    const cooldown = cfg.xpCooldown ?? 60;
    const rawMsg = cfg.levelUpMessage || '{user} ist auf Level {level} aufgestiegen!';
    const msgPreview = `\`${rawMsg.length > 60 ? rawMsg.substring(0, 60) + '…' : rawMsg}\``;

    const rewards = cfg.roleRewards ?? {};
    const rewardEntries = Object.entries(rewards).sort(([a], [b]) => Number(a) - Number(b));
    const rewardsValue = rewardEntries.length > 0
        ? rewardEntries.map(([lvl, roleId]) => `Level **${lvl}** → <@&${roleId}>`).join('\n')
        : '`Keine eingerichtet`';

    const ignoredChannels = cfg.ignoredChannels ?? [];
    const ignoredRoles = cfg.ignoredRoles ?? [];
    const ignoredChValue = ignoredChannels.length > 0 ? ignoredChannels.map(id => `<#${id}>`).join(',') : '`Keine`';
    const ignoredRoValue = ignoredRoles.length > 0 ? ignoredRoles.map(id => `<@&${id}>`).join(',') : '`Keine`';

    return new EmbedBuilder()
        .setTitle('⚡ Leveling-Dashboard')
        .setDescription(`Verwalte die Leveling-Einstellungen für **${guild.name}**.\nWähle unten eine Option, um eine Einstellung zu ändern.`)
        .setColor(getColor('info'))
        .addFields(
            { name: 'Level-up-Kanal', value: channel, inline: true },
            { name: 'Systemstatus', value: cfg.enabled ? '**Aktiviert**' : '**Deaktiviert**', inline: true },
            { name: 'Ankündigungen', value: cfg.announceLevelUp !== false ? '**Aktiviert**' : '**Deaktiviert**', inline: true },
            { name: 'XP pro Nachricht', value: `\`${xpMin} – ${xpMax}\``, inline: true },
            { name: 'XP-Cooldown', value: `\`${cooldown}s\``, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Level-up-Nachricht', value: msgPreview, inline: false },
            { name: 'Rollen-Belohnungen', value: rewardsValue, inline: false },
            { name: 'Ignorierte Kanäle', value: ignoredChValue, inline: true },
            { name: 'Ignorierte Rollen', value: ignoredRoValue, inline: true },
        )
        .setFooter({ text: 'Das Dashboard schließt sich nach 10 Minuten Inaktivität' })
        .setTimestamp();
}

export function buildSelectMenu(guildId: string) {
    return new StringSelectMenuBuilder()
        .setCustomId(`level_cfg_${guildId}`)
        .setPlaceholder('Wähle eine Einstellung...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Level-up-Kanal ändern')
                .setDescription('Lege fest, in welchem Kanal Level-up-Benachrichtigungen gesendet werden')
                .setValue('channel')
                .setEmoji('📢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Level-up-Nachricht bearbeiten')
                .setDescription('Passe die Nachricht an, die beim Level-up eines Nutzers erscheint')
                .setValue('message')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('XP-Bereich festlegen')
                .setDescription('Lege die minimalen und maximalen XP pro Nachricht fest')
                .setValue('xp_range')
                .setEmoji('🎲'),
            new StringSelectMenuOptionBuilder()
                .setLabel('XP-Cooldown festlegen')
                .setDescription('Sekunden zwischen XP-Vergaben für denselben Nutzer')
                .setValue('xp_cooldown')
                .setEmoji('⏱️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Rollen-Belohnung hinzufügen')
                .setDescription('Vergib eine Rolle, wenn ein Nutzer ein bestimmtes Level erreicht')
                .setValue('role_reward_add')
                .setEmoji('🏆'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Rollen-Belohnung entfernen')
                .setDescription('Entferne die Rollen-Belohnung eines bestimmten Levels')
                .setValue('role_reward_remove')
                .setEmoji('\ud83d\uddd1\ufe0f'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Ignorierte Kanäle')
                .setDescription('Kanäle umschalten, in denen keine XP vergeben werden')
                .setValue('ignore_channels')
                .setEmoji('\ud83d\udeab'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Ignorierte Rollen')
                .setDescription('Rollen umschalten, die keine XP erhalten')
                .setValue('ignore_roles')
                .setEmoji('\ud83d\udeab'),
        );
}

export function buildButtonRow(cfg: GuildLevelingConfig, guildId: string, disabled = false) {
    const announceOn = cfg.announceLevelUp !== false;
    const systemOn = cfg.enabled !== false;
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`level_cfg_toggle_announce_${guildId}`)
            .setLabel('Ankündigungen')
            .setStyle(announceOn ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji('📣')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`level_cfg_toggle_system_${guildId}`)
            .setLabel('Leveling')
            .setStyle(systemOn ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji('⚡')
            .setDisabled(disabled),
    );
}
