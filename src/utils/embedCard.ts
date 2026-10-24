// Moves the existing embed-based messages onto the Nexo card layout without rewriting each one: embedToCard()
// turns an embed into a V2 container (author → kicker, title, description, fields as label lines, thumbnail as a
// section picture, image as a gallery, footer as small text), toCardPayload() does it for a whole reply/edit/send
// payload (content moves into the card, rows and files stay). Every send AND edit of a converted message must go
// through toCardPayload, because a V2 message cannot take embeds again.

import { ComponentType, EmbedBuilder, Message, MessageFlags, type APIEmbed, type ContainerBuilder } from 'discord.js';
import { ACCENTS, nexoCard, type NexoBlock } from './nexoMessage.js';

/** Discord allows 4000 characters of text per V2 message; keep room for content and footers. */
const TEXT_BUDGET = 3800;

function fieldBlocks(fields: NonNullable<APIEmbed['fields']>): string[] {
  const blocks: string[] = [];
  let inline: string[] = [];
  const flush = () => {
    if (inline.length) blocks.push(inline.join('\n'));
    inline = [];
  };
  for (const field of fields) {
    if (field.inline) {
      inline.push(`**${field.name}:** ${field.value}`);
    } else {
      flush();
      blocks.push(`**${field.name}**\n${field.value}`);
    }
  }
  flush();
  return blocks;
}

/** One embed as a Nexo card. `lead` (e.g. former message content with mentions) goes first. */
export function embedToCard(input: EmbedBuilder | APIEmbed, lead = ''): ContainerBuilder {
  const embed = input instanceof EmbedBuilder ? input.toJSON() : input;
  const texts: string[] = [];
  if (lead.trim()) texts.push(lead.trim());
  if (embed.description?.trim()) texts.push(embed.description.trim());
  texts.push(...fieldBlocks(embed.fields ?? []));

  // Stay inside the V2 text budget: cut the longest blocks last.
  let budget = TEXT_BUDGET - (embed.title?.length ?? 0) - (embed.footer?.text.length ?? 0) - (embed.author?.name.length ?? 0);
  const fitted = texts.map((text) => {
    const piece = text.length > budget ? `${text.slice(0, Math.max(0, budget - 1))}…` : text;
    budget -= piece.length;
    return piece;
  }).filter(Boolean);

  const blocks: NexoBlock[] = [];
  fitted.forEach((text, index) => {
    // The embed's thumbnail sits next to the first text block, like it did next to the description.
    if (index === 0 && embed.thumbnail?.url) blocks.push({ text, thumbnail: embed.thumbnail.url });
    else blocks.push({ text });
    // A thin line between the description and the fields.
    if (index === 0 && fitted.length > 1 && embed.description?.trim() && !lead.trim()) blocks.push({ separator: true });
  });
  if (!fitted.length && embed.thumbnail?.url) blocks.push({ images: [embed.thumbnail.url] });
  if (embed.image?.url) blocks.push({ images: [embed.image.url] });

  const title = embed.title ? (embed.url ? `[${embed.title}](${embed.url})` : embed.title) : undefined;
  return nexoCard({ kicker: embed.author?.name, title, accent: embed.color ?? ACCENTS.nexo, blocks, footer: embed.footer?.text });
}

type AnyPayload = Record<string, unknown> & { content?: string | null; embeds?: (EmbedBuilder | APIEmbed)[]; components?: unknown[]; flags?: unknown; ephemeral?: boolean };

/**
 * A reply/edit/send payload with its embeds as Nexo cards (V2). Content moves into the first card, components and
 * files stay, an ephemeral flag is kept. Payloads without embeds that already are V2 pass through.
 */
export function toCardPayload<T extends AnyPayload>(payload: T): Omit<T, 'content' | 'embeds' | 'ephemeral'> & { components: unknown[]; flags: number } {
  const { content, embeds = [], components = [], flags, ephemeral, ...rest } = payload;
  const numericFlags = Number(flags ?? 0);
  const ephemeralFlag = ephemeral || (numericFlags & MessageFlags.Ephemeral) ? MessageFlags.Ephemeral : 0;
  const cards = embeds.map((embed, index) => embedToCard(embed, index === 0 ? content ?? '' : ''));
  if (!cards.length && content?.trim()) cards.push(nexoCard({ blocks: [{ text: content }] }));
  return { ...rest, components: [...cards, ...components], flags: MessageFlags.IsComponentsV2 | ephemeralFlag | (numericFlags & ~MessageFlags.Ephemeral & ~MessageFlags.IsComponentsV2) } as never;
}

// ---------- Central conversion ----------

export const hasEmbeds = (options: unknown): options is AnyPayload =>
  Boolean(options) && typeof options === 'object' && Array.isArray((options as AnyPayload).embeds) && (options as AnyPayload).embeds!.length > 0;

/** Whether a message already uses the card layout (Components V2). */
export const isCardMessage = (message: { flags?: { has(flag: number): boolean } | null } | null | undefined): boolean =>
  Boolean(message?.flags?.has(MessageFlags.IsComponentsV2));

/** The top-level button/select rows of a message (kept when an edit only changes its embed). */
export const messageRows = (message: { components?: { type: number }[] } | null | undefined): unknown[] =>
  (message?.components ?? []).filter((component) => component.type === ComponentType.ActionRow);

/** Title of a message's first embed or card ("## …" heading of its first text), for code that recognises views. */
export function messageTitle(message: { embeds?: { title?: string | null }[]; components?: unknown[] } | null | undefined): string | null {
  const fromEmbed = message?.embeds?.[0]?.title;
  if (fromEmbed) return fromEmbed;
  // Walk the V2 tree for the first "## " heading of a text display.
  const stack: unknown[] = [...(message?.components ?? [])].map((c) => (typeof (c as { toJSON?: () => unknown }).toJSON === 'function' ? (c as { toJSON(): unknown }).toJSON() : c));
  while (stack.length) {
    const node = stack.shift() as { content?: string; components?: unknown[] } | null;
    const heading = node?.content?.split('\n').find((line) => line.startsWith('## '));
    if (heading) return heading.slice(3);
    if (node?.components) stack.unshift(...node.components);
  }
  return null;
}

/** An edit/update payload for a card message: embeds → cards, ephemeral dropped, rows kept when the edit had none. */
export function cardEdit(options: AnyPayload, existingRows: unknown[]): AnyPayload {
  const converted = toCardPayload(options.components === undefined ? { ...options, components: existingRows } : options);
  return { ...converted, flags: converted.flags & ~MessageFlags.Ephemeral };
}

// Edits through message.edit (collectors, services) on card messages convert as well; plain embed messages
// (panels and logs posted with channel.send) stay embeds.
const originalEdit = Message.prototype.edit;
Message.prototype.edit = function editAsCard(this: Message, options: Parameters<Message['edit']>[0]) {
  if (isCardMessage(this) && hasEmbeds(options)) return originalEdit.call(this, cardEdit(options, messageRows(this)) as never);
  return originalEdit.call(this, options);
} as Message['edit'];
