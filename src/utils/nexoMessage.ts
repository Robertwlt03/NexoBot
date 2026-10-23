// Nexo's premium message look: one Components V2 container (accent bar, kicker, title, text blocks, separators,
// images, buttons) instead of an embed. Text displays are not run through the embed sanitizer, so emojis, coin
// emojis and command mentions stay. A V2 message must keep the flag on every edit and cannot carry embeds/content.

import {
  ActionRowBuilder, ButtonBuilder, ContainerBuilder, MediaGalleryBuilder, MessageFlags, SectionBuilder, SeparatorBuilder,
  SeparatorSpacingSize, TextDisplayBuilder, ThumbnailBuilder,
} from 'discord.js';

/** Moss green of the Nexo look (the dashboard's and the profile card's default accent). */
export const NEXO_ACCENT = 0x8fb36b;
export const ACCENTS = { nexo: NEXO_ACCENT, gold: 0xf5c451, warn: 0xf59e0b, danger: 0xef4444, calm: 0x64748b } as const;

export type NexoBlock =
  | { text: string }
  /** Text with a small picture on the right. */
  | { text: string; thumbnail: string }
  /** Text with a button on the right. */
  | { text: string; button: ButtonBuilder }
  | { separator: true; large?: boolean; hidden?: boolean }
  /** Images (URLs or attachment://name) in a gallery. */
  | { images: string[] }
  | { buttons: ButtonBuilder[] };

export interface NexoCardOptions {
  /** Small line above the title, e.g. "Tagesaufgaben". */
  kicker?: string;
  title?: string;
  accent?: number;
  blocks: NexoBlock[];
  /** Quiet last line (-# small text). */
  footer?: string;
}

export function nexoCard({ kicker, title, accent = NEXO_ACCENT, blocks, footer }: NexoCardOptions): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(accent);
  const head = [kicker ? `-# ${kicker.toUpperCase()}` : '', title ? `## ${title}` : ''].filter(Boolean).join('\n');
  if (head) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(head));
  for (const block of blocks) {
    if ('separator' in block) {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(!block.hidden).setSpacing(block.large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small));
    } else if ('images' in block) {
      if (block.images.length) container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...block.images.slice(0, 10).map((url) => ({ media: { url } }))));
    } else if ('buttons' in block) {
      if (block.buttons.length) container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(block.buttons.slice(0, 5)));
    } else if ('thumbnail' in block) {
      container.addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(block.text))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(block.thumbnail)));
    } else if ('button' in block) {
      container.addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(block.text))
        .setButtonAccessory(block.button));
    } else if (block.text.trim()) {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block.text));
    }
  }
  if (footer) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footer}`));
  return container;
}

/** Message payload for one or more V2 containers (plus loose button rows below them). */
export function nexoMessage(containers: ContainerBuilder | ContainerBuilder[], options: { ephemeral?: boolean; rows?: ActionRowBuilder<ButtonBuilder>[] } = {}) {
  return {
    components: [...(Array.isArray(containers) ? containers : [containers]), ...(options.rows ?? [])],
    flags: (MessageFlags.IsComponentsV2 | (options.ephemeral ? MessageFlags.Ephemeral : 0)) as number,
  };
}

/** A progress bar of `width` cells for text displays. */
export function textBar(current: number, target: number, width = 10): string {
  const filled = Math.max(0, Math.min(width, Math.round((current / Math.max(1, target)) * width)));
  return `${'▰'.repeat(filled)}${'▱'.repeat(width - filled)}`;
}
