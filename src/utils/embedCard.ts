// Moves Nexo's embed-based messages onto the Nexo card layout without rewriting each one. embedToCard() turns an
// embed into a V2 container in a fixed, reversible shape – every part carries a component id (banner 5, head 10,
// content 11, description 12, gallery 20, footer 30, fields 100+) – so cardToEmbed()/messageEmbed() can read a card back as the
// embed it came from (tickets, reaction-role panels and applications read their data from their messages).
// toCardPayload() converts a whole send/reply/edit payload; InteractionHelper, channel sends and message.edit use it.

import {
  BaseGuildTextChannel, BaseGuildVoiceChannel, ComponentType, ContainerBuilder, DMChannel, EmbedBuilder, FileBuilder,
  MediaGalleryBuilder, Message, MessageFlags, MessageFlagsBitField, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder,
  ThreadChannel, ThumbnailBuilder, type APIEmbed, type APIEmbedField,
} from 'discord.js';
import { ACCENTS } from './nexoMessage.js';
import { cardBanner } from './cardBanner.js';

/** Discord allows 4000 characters of text per V2 message; keep room for content and footers. */
const TEXT_BUDGET = 3800;
/** Discord allows 40 components per V2 message (nested ones and buttons included). */
const COMPONENT_LIMIT = 40;
const ID = { banner: 5, head: 10, lead: 11, description: 12, gallery: 20, files: 21, footer: 30, field: 100 } as const;
const IMAGE = /\.(png|jpe?g|gif|webp|avif)$/i;

const fieldText = (field: APIEmbedField) => (field.inline ? `**${field.name}:** ${field.value}` : `**${field.name}**\n${field.value}`);

/** One embed as a Nexo card. `lead` (former message content with mentions) goes first; `files` are attachment names. */
export function embedToCard(input: EmbedBuilder | APIEmbed, lead = '', files: string[] = [], { compact = false } = {}): ContainerBuilder {
  const embed = input instanceof EmbedBuilder ? input.toJSON() : input;
  const container = new ContainerBuilder().setAccentColor(embed.color ?? ACCENTS.nexo);
  let budget = TEXT_BUDGET;
  const fit = (text: string) => {
    const piece = text.length > budget ? `${text.slice(0, Math.max(0, budget - 1))}…` : text;
    budget -= piece.length;
    return piece;
  };
  const text = (id: number, content: string) => new TextDisplayBuilder().setId(id).setContent(fit(content));
  const description = embed.description?.trim();
  const thumbnail = embed.thumbnail?.url;

  // Every card opens with a banner in its colour, unless it already shows a big picture of its own.
  const banner = embed.image?.url || (!description && thumbnail) ? null : cardBanner(embed.color ?? ACCENTS.nexo);
  if (banner) container.addMediaGalleryComponents(new MediaGalleryBuilder().setId(ID.banner).addItems({ media: { url: banner } }));

  const title = embed.title ? (embed.url ? `[${embed.title}](${embed.url})` : embed.title) : '';
  const head = [embed.author?.name ? `-# ${embed.author.name.toUpperCase()}` : '', title ? `## ${title}` : ''].filter(Boolean).join('\n');
  if (head) container.addTextDisplayComponents(text(ID.head, head));
  if (lead.trim()) container.addTextDisplayComponents(text(ID.lead, lead.trim()));

  if (description && thumbnail) {
    container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(text(ID.description, description)).setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail)));
  } else if (description) {
    container.addTextDisplayComponents(text(ID.description, description));
  }
  const fields = embed.fields ?? [];
  if (description && fields.length) container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  // Compact (only when a card must stay a card but is too big): all fields in one text, no longer readable back.
  if (compact && fields.length) container.addTextDisplayComponents(text(ID.field, fields.map(fieldText).join('\n')));
  else fields.forEach((field, index) => container.addTextDisplayComponents(text(ID.field + index, fieldText(field))));

  const referenced = (url?: string) => url?.startsWith('attachment://') ? url.slice('attachment://'.length) : null;
  const shown = new Set([referenced(embed.image?.url), referenced(thumbnail)].filter(Boolean));
  const images = [...(embed.image?.url ? [embed.image.url] : []), ...(!description && thumbnail ? [thumbnail] : [])];
  // Attachments the embed did not show would be invisible in a card: images join the gallery, others become files.
  const extraImages = files.filter((name) => !shown.has(name) && IMAGE.test(name));
  const others = files.filter((name) => !shown.has(name) && !IMAGE.test(name));
  const gallery = [...images, ...extraImages.map((name) => `attachment://${name}`)];
  if (gallery.length) container.addMediaGalleryComponents(new MediaGalleryBuilder().setId(ID.gallery).addItems(...gallery.slice(0, 10).map((url) => ({ media: { url } }))));
  others.forEach((name) => container.addFileComponents(new FileBuilder().setURL(`attachment://${name}`)));
  if (embed.footer?.text) container.addTextDisplayComponents(text(ID.footer, `-# ${embed.footer.text}`));
  return container;
}

/** How many components a payload part counts towards Discord's limit of 40 (nested ones included). */
function countComponents(component: unknown): number {
  const json = (typeof (component as { toJSON?: () => unknown })?.toJSON === 'function' ? (component as { toJSON(): unknown }).toJSON() : component) as { components?: unknown[]; accessory?: unknown } | null;
  if (!json || typeof json !== 'object') return 0;
  return 1 + (json.components ?? []).reduce<number>((sum, child) => sum + countComponents(child), 0) + (json.accessory ? 1 : 0);
}

/** Embeds an admin designed themselves (embed builder) are posted exactly as designed, never as cards. */
const keptEmbeds = new WeakSet<object>();
export function keepAsEmbed<T extends EmbedBuilder>(embed: T): T {
  keptEmbeds.add(embed);
  return embed;
}

type AnyPayload = Record<string, unknown> & {
  content?: string | null; embeds?: (EmbedBuilder | APIEmbed)[]; components?: unknown[]; flags?: unknown; ephemeral?: boolean; files?: unknown[];
};

type Mentions = { parse?: readonly string[]; users?: readonly string[]; roles?: readonly string[]; repliedUser?: boolean };

/**
 * Mentions in embeds never pinged anyone, mentions in card text do. So a converted message may only ping what its
 * former content would have pinged (the ids written there), within whatever the caller allowed. Pure, for tests.
 */
export function contentOnlyMentions(content: string, allowed: Mentions | undefined): Mentions {
  const ids = (pattern: RegExp) => [...content.matchAll(pattern)].map((match) => match[1]);
  const may = (kind: 'users' | 'roles') => !allowed || allowed.parse?.includes(kind) || allowed[kind] !== undefined;
  const pick = (kind: 'users' | 'roles', found: string[]) => (!may(kind) ? [] : allowed?.[kind] ? found.filter((id) => allowed[kind]!.includes(id)) : found);
  const everyone = /@(everyone|here)\b/.test(content) && (!allowed || allowed.parse?.includes('everyone'));
  return {
    parse: everyone ? ['everyone'] : [],
    users: [...new Set(pick('users', ids(/<@!?(\d+)>/g)))],
    roles: [...new Set(pick('roles', ids(/<@&(\d+)>/g)))],
    ...(allowed?.repliedUser !== undefined ? { repliedUser: allowed.repliedUser } : {}),
  };
}

const fileName = (file: unknown): string | null => {
  if (typeof file === 'string') return file.split(/[\\/]/).pop() ?? null;
  const named = file as { name?: string | null; attachment?: unknown } | null;
  return named?.name ?? (typeof named?.attachment === 'string' ? named.attachment.split(/[\\/]/).pop() ?? null : null);
};

/**
 * A reply/edit/send payload with its embeds as Nexo cards (V2). Content moves into the first card, components and
 * files stay (unshown files appear in the card), an ephemeral flag is kept. Returns the payload unchanged when the
 * cards would exceed Discord's component limit – that message simply stays an embed.
 */
export function toCardPayload<T extends AnyPayload>(payload: T, { force = false } = {}): Omit<T, 'content' | 'embeds' | 'ephemeral'> & { components: unknown[]; flags: number } {
  const { content, embeds = [], components = [], flags, ephemeral, ...rest } = payload;
  // `force`: the target already is a card (an edit), so falling back to an embed is not possible.
  if (!force && embeds.some((embed) => keptEmbeds.has(embed as object))) return payload as never;
  const files = (payload.files ?? []).map(fileName).filter((name): name is string => Boolean(name));
  // Flags come as numbers, bitfields or names (['Ephemeral']); resolve them all.
  const numericFlags = Number(MessageFlagsBitField.resolve((flags ?? 0) as never));
  const ephemeralFlag = ephemeral || (numericFlags & MessageFlags.Ephemeral) ? MessageFlags.Ephemeral : 0;
  const build = (compact: boolean) => {
    const cards = embeds.map((embed, index) => embedToCard(embed, index === 0 ? content ?? '' : '', index === 0 ? files : [], { compact }));
    if (!cards.length && content?.trim()) cards.push(new ContainerBuilder().setAccentColor(ACCENTS.nexo).addTextDisplayComponents(new TextDisplayBuilder().setId(ID.lead).setContent(content)));
    // A card needs something to show; an edit that must stay a card gets a quiet dash.
    for (const card of cards) if (!(card.toJSON().components ?? []).length && force) card.addTextDisplayComponents(new TextDisplayBuilder().setContent('–'));
    return [...cards, ...components];
  };
  const size = (list: unknown[]) => list.reduce<number>((sum, component) => sum + countComponents(component), 0);
  let all = build(false);
  // An embed with nothing a card can show (e.g. only a colour) stays an embed; an empty card would be rejected.
  if (all.some((component) => componentType(component) === ComponentType.Container && !(raw(component).components ?? []).length)) return payload as never;
  if (size(all) > COMPONENT_LIMIT) {
    if (!force) return payload as never;
    all = build(true);
  }
  return {
    ...rest,
    allowedMentions: contentOnlyMentions(content ?? '', rest.allowedMentions as Mentions | undefined),
    components: all,
    flags: MessageFlags.IsComponentsV2 | ephemeralFlag | (numericFlags & ~MessageFlags.Ephemeral & ~MessageFlags.IsComponentsV2),
  } as never;
}

// ---------- Reading cards back ----------

interface RawNode { type?: number; id?: number; content?: string; components?: RawNode[]; accessory?: { media?: { url?: string } }; items?: { media?: { url?: string } }[]; accent_color?: number | null }

const componentType = (component: unknown): number | undefined => raw(component)?.type;

/** The lead text (former content, id 11) of a message's first card. */
function leadOf(existing: unknown[] | undefined): string {
  const card = (existing ?? []).map(raw).find((node) => node.type === ComponentType.Container);
  return card?.components?.map(raw).find((node) => node.id === ID.lead)?.content ?? '';
}

const raw = (component: unknown): RawNode => (typeof (component as { toJSON?: () => unknown })?.toJSON === 'function' ? (component as { toJSON(): RawNode }).toJSON() : component as RawNode);

/** The embed a Nexo card was made from (inverse of embedToCard). Pure, for tests. */
export function cardToEmbed(card: unknown): APIEmbed & { fields: APIEmbedField[] } {
  const container = raw(card);
  const embed: APIEmbed & { fields: APIEmbedField[] } = { fields: [], ...(container.accent_color != null ? { color: container.accent_color } : {}) };
  const visit = (node: RawNode) => {
    if (node.type === ComponentType.Section) {
      if (node.accessory?.media?.url) embed.thumbnail = { url: node.accessory.media.url };
      node.components?.forEach((child) => visit(raw(child)));
      return;
    }
    if (node.type === ComponentType.MediaGallery && node.id === ID.gallery && node.items?.[0]?.media?.url) {
      embed.image = { url: node.items[0].media.url };
      return;
    }
    const text = node.content;
    if (node.type !== ComponentType.TextDisplay || text === undefined) return;
    if (node.id === ID.head) {
      for (const line of text.split('\n')) {
        if (line.startsWith('-# ')) embed.author = { name: line.slice(3) };
        else if (line.startsWith('## ')) {
          const linked = /^\[(.*)\]\((.*)\)$/.exec(line.slice(3));
          embed.title = linked ? linked[1] : line.slice(3);
          if (linked) embed.url = linked[2];
        }
      }
    } else if (node.id === ID.description) {
      embed.description = text;
    } else if (node.id === ID.footer) {
      embed.footer = { text: text.replace(/^-# /, '') };
    } else if (node.id !== undefined && node.id >= ID.field) {
      const inline = /^\*\*([\s\S]+?):\*\* ([\s\S]*)$/.exec(text);
      const block = /^\*\*([\s\S]+?)\*\*\n([\s\S]*)$/.exec(text);
      if (block) embed.fields.push({ name: block[1], value: block[2] });
      else if (inline) embed.fields.push({ name: inline[1], value: inline[2], inline: true });
    }
  };
  (container.components ?? []).forEach((child) => visit(raw(child)));
  return embed;
}

/** Whether a message already uses the card layout (Components V2). */
export const isCardMessage = (message: { flags?: { has(flag: number): boolean } | null } | null | undefined): boolean =>
  Boolean(message?.flags?.has(MessageFlags.IsComponentsV2));

/**
 * The message's first embed – or, for a card message, the embed its first card was made from – or null. Use this
 * instead of message.embeds[0] wherever Nexo reads data back from its own messages.
 */
export function messageEmbed(message: { embeds?: unknown[]; components?: unknown[]; flags?: { has(flag: number): boolean } | null } | null | undefined): (APIEmbed & { fields: APIEmbedField[] }) | null {
  if (!message) return null;
  const first = message.embeds?.[0];
  if (first) {
    const json = raw(first) as APIEmbed;
    return { ...json, fields: json.fields ?? [] };
  }
  if (!isCardMessage(message)) return null;
  const card = (message.components ?? []).map(raw).find((node) => node.type === ComponentType.Container);
  return card ? cardToEmbed(card) : null;
}

/** Title of a message's first embed or card, for code that recognises views. */
export const messageTitle = (message: Parameters<typeof messageEmbed>[0]): string | null => messageEmbed(message)?.title ?? null;

// ---------- Central conversion ----------

export const hasEmbeds = (options: unknown): options is AnyPayload =>
  Boolean(options) && typeof options === 'object' && Array.isArray((options as AnyPayload).embeds) && (options as AnyPayload).embeds!.length > 0;

/** The top-level button/select rows of a message (kept when an edit only changes its embed). */
export const messageRows = (message: { components?: { type: number }[] } | null | undefined): unknown[] =>
  (message?.components ?? []).filter((component) => component.type === ComponentType.ActionRow);

/**
 * Edits that only set components (e.g. disabling buttons when a collector ends) would wipe a card: keep the
 * message's cards and replace only its rows. Payloads that bring their own cards or embeds pass through.
 */
export function keepCards<T extends AnyPayload>(options: T, existing: unknown[] | undefined): T {
  if ((options.embeds?.length ?? 0) > 0 || options.components === undefined) return options;
  if (options.components.some((component) => componentType(component) === ComponentType.Container)) return options;
  const cards = (existing ?? []).filter((component) => componentType(component) !== ComponentType.ActionRow);
  return { ...options, components: [...cards, ...options.components] };
}

/** An edit/update payload for a card message: embeds → cards, ephemeral dropped, rows kept when the edit had none. */
export function cardEdit(options: AnyPayload, existingRows: unknown[]): AnyPayload {
  const converted = toCardPayload(options.components === undefined ? { ...options, components: existingRows } : options, { force: true });
  return { ...converted, flags: converted.flags & ~MessageFlags.Ephemeral };
}

/**
 * Any edit of a card message: embeds or text become the card (rows kept when the edit had none), components-only
 * edits keep the card, empty content keys are dropped (a card message cannot carry content).
 */
export function cardMessageEdit(options: unknown, existing: unknown[] | undefined): unknown {
  if (typeof options === 'string') options = { content: options };
  if (!options || typeof options !== 'object') return options;
  const payload = { ...(options as AnyPayload) };
  const text = typeof payload.content === 'string' && payload.content.trim() ? payload.content : '';
  // Without a content key a classic edit kept the old content: keep the card's lead line (mentions) the same way.
  const lead = 'content' in payload ? text : leadOf(existing);
  delete payload.content;
  // `embeds: []` (clearing) is meaningless on a card and must not reach it.
  if (Array.isArray(payload.embeds) && !payload.embeds.length) delete payload.embeds;
  if (hasEmbeds(payload) || text) return cardEdit({ ...payload, ...(lead ? { content: lead } : {}) }, (existing ?? []).filter((component) => componentType(component) === ComponentType.ActionRow));
  return keepCards(payload, existing);
}

// Edits through message.edit (collectors, services) of card messages convert as well; messages that are still
// classic embeds (older posts, oversized ones) stay embeds.
const originalEdit = Message.prototype.edit;
Message.prototype.edit = function editAsCard(this: Message, options: Parameters<Message['edit']>[0]) {
  return originalEdit.call(this, (isCardMessage(this) ? cardMessageEdit(options, this.components) : options) as never);
} as Message['edit'];

// Posts (panels, tickets, giveaways, logs, welcome …) go out as cards too: every text-capable channel class.
for (const ChannelClass of [BaseGuildTextChannel, BaseGuildVoiceChannel, ThreadChannel, DMChannel]) {
  const proto = ChannelClass.prototype as unknown as { send(options: unknown): Promise<Message> };
  const originalSend = proto.send;
  proto.send = function sendAsCard(this: unknown, options: unknown) {
    return originalSend.call(this, hasEmbeds(options) ? toCardPayload(options) : options);
  };
}

// message.reply builds a MessagePayload before channel.send, so it converts here.
const originalMessageReply = Message.prototype.reply;
Message.prototype.reply = function replyAsCard(this: Message, options: Parameters<Message['reply']>[0]) {
  return originalMessageReply.call(this, (hasEmbeds(options) ? toCardPayload(options) : options) as never);
} as Message['reply'];
