// Draws Nexo's Components V2 messages (the JSON the bot sends: containers, text, galleries, separators, sections,
// button rows) the way Discord shows them, with Discord's markdown for the parts Nexo uses.
import { Fragment, type ReactNode } from 'react';
import type { CoinTier } from '../../src/shared/coins';
import { CoinIcon } from '../src/components/CoinIcon';

/** Discord's component types and button styles (discord-api-types), as far as Nexo's cards use them. */
const TYPE = { row: 1, button: 2, section: 9, text: 10, thumbnail: 11, gallery: 12, separator: 14, container: 17 } as const;
const BUTTON = { 1: 'primary', 2: 'secondary', 3: 'success', 4: 'danger', 5: 'link' } as Record<number, string>;

export interface Part {
  type: number; components?: Part[]; accessory?: Part; content?: string; accent_color?: number | null;
  items?: { media: { url: string } }[]; media?: { url: string }; divider?: boolean; spacing?: number;
  style?: number; label?: string; disabled?: boolean; emoji?: { name?: string };
}

/** Sample members and commands behind the ids in the sample messages. */
const MEMBERS: Record<string, string> = { 1: 'Alex', 2: 'Max', 3: 'Lena' };

/** Inline markdown: bold, italic, strike, code, mentions, command mentions, timestamps and coin emojis. */
function inline(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|`[^`]+`|<@!?\d+>|<\/[^:>]+:\d+>|<t:\d+(?::[a-zA-Z])?>|<a?:\w+:\d+>)/g;
  return text.split(pattern).map((part, i) => {
    if (part.startsWith('**')) return <b key={i}>{inline(part.slice(2, -2))}</b>;
    if (part.startsWith('~~')) return <s key={i}>{inline(part.slice(2, -2))}</s>;
    if (part.startsWith('`')) return <code key={i} className="dc-code">{part.slice(1, -1)}</code>;
    if (/^\*[^*]+\*$/.test(part)) return <i key={i}>{inline(part.slice(1, -1))}</i>;
    if (part.startsWith('<@')) return <span key={i} className="dc-mention">@{MEMBERS[part.replace(/\D/g, '')] ?? 'Mitglied'}</span>;
    if (part.startsWith('</')) return <span key={i} className="dc-mention">/{part.slice(2, part.lastIndexOf(':'))}</span>;
    if (part.startsWith('<t:')) return <span key={i} className="dc-ts">in 3 Stunden</span>;
    const coin = /^<a?:coin_(\w+):\d+>$/.exec(part);
    if (coin) return <CoinIcon key={i} tier={coin[1] as CoinTier} size={18} style={{ verticalAlign: -4 }} />;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** One text display: line by line, with Discord's headings, small text, quotes and lists. */
function Markdown({ text }: { text: string }) {
  return (
    <div className="dc-text">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('-# ')) return <p key={i} className="dc-small">{inline(line.slice(3))}</p>;
        if (line.startsWith('## ')) return <p key={i} className="dc-title">{inline(line.slice(3))}</p>;
        if (line.startsWith('### ')) return <p key={i} className="dc-h3">{inline(line.slice(4))}</p>;
        if (line.startsWith('> ')) return <p key={i} className="dc-quote">{inline(line.slice(2))}</p>;
        if (line.startsWith('- ')) return <p key={i} className="dc-li">{inline(line.slice(2))}</p>;
        return <p key={i}>{line ? inline(line) : '\u00a0'}</p>;
      })}
    </div>
  );
}

/** Banners point at the public dashboard; here the Storybook server draws them with the same code. */
const local = (url: string) => url.replace(/^https?:\/\/[^/]+(?=\/dashboard\/banners\/)/, '');

function Button({ part }: { part: Part }) {
  const style = BUTTON[part.style ?? 2] ?? 'secondary';
  return <span className={`dc-btn ${style}${part.disabled ? ' off' : ''}`}>{part.emoji?.name}{part.label}</span>;
}

function Component({ part }: { part: Part }) {
  switch (part.type) {
    case TYPE.text: return <Markdown text={part.content ?? ''} />;
    case TYPE.gallery: return <div className="dc-gallery">{part.items?.map((item) => <img key={item.media.url} className={item.media.url.includes('/banners/') ? 'dc-banner' : 'dc-image'} src={local(item.media.url)} alt="" />)}</div>;
    case TYPE.separator: return part.divider === false ? <div style={{ height: part.spacing === 2 ? 16 : 6 }} /> : <div className="dc-sep" />;
    case TYPE.row: return <div className="dc-buttons">{part.components?.map((button, i) => <Button key={i} part={button} />)}</div>;
    case TYPE.section: return (
      <div className="dc-section">
        <div>{part.components?.map((child, i) => <Component key={i} part={child} />)}</div>
        {part.accessory?.type === TYPE.thumbnail ? <img className="dc-thumb" src={part.accessory.media?.url} alt="" /> : part.accessory && <Button part={part.accessory} />}
      </div>
    );
    default: return null;
  }
}

const hex = (color: number | null | undefined) => `#${(color ?? 0x8fb36b).toString(16).padStart(6, '0')}`;

/** A whole bot answer: author line, the cards and loose button rows, and Discord's note for ephemeral answers. */
export function NexoAnswer({ components, flags, time }: { components: Part[]; flags?: number; time: string }) {
  return (
    <div className="dc-msg">
      <img className="dc-avatar" src="/dashboard/nexo.svg" alt="" />
      <div className="dc-body">
        <div className="dc-author"><b>Nexo</b><span className="dc-app">APP</span><span className="dc-time">Heute um {time}</span></div>
        {components.map((part, i) => part.type === TYPE.container
          ? <div key={i} className="dc-card" style={{ borderLeftColor: hex(part.accent_color) }}>{part.components?.map((child, j) => <Component key={j} part={child} />)}</div>
          : <Component key={i} part={part} />)}
        {Boolean((flags ?? 0) & 64) && <div className="dc-eph">Nur du kannst das sehen · <span>Nachricht verwerfen</span></div>}
      </div>
    </div>
  );
}

export const discordStyles = `
.dc-channel { min-height: 100vh; background: #313338; color: #dbdee1; font: 15px/1.45 Inter, "gg sans", system-ui, sans-serif; padding: 0 0 40px; }
.dc-head { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 10px; padding: 14px 24px; background: #313338; border-bottom: 1px solid rgba(0,0,0,.3); color: #f2f3f5; font-weight: 600; }
.dc-head i { color: #80848e; font-style: normal; font-size: 22px; font-weight: 400; }
.dc-head small { margin-left: auto; color: #949ba4; font-weight: 500; }
.dc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(560px, 100%), 1fr)); gap: 6px 24px; padding: 8px 8px 0; }
.dc-msg { display: flex; gap: 16px; padding: 14px 16px 6px; }
.dc-avatar { width: 40px; height: 40px; border-radius: 50%; flex: none; }
.dc-body { flex: 1; min-width: 0; }
.dc-author { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.dc-author b { color: #f2f3f5; font-weight: 600; font-size: 16px; }
.dc-app { background: #5865f2; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px; }
.dc-time { color: #949ba4; font-size: 12px; margin-left: 4px; }
.dc-card { display: flex; flex-direction: column; gap: 8px; max-width: 520px; background: #2b2d31; border: 1px solid rgba(255,255,255,.06); border-left: 4px solid; border-radius: 8px; padding: 14px 16px 16px 14px; }
.dc-banner { display: block; width: 100%; aspect-ratio: 4 / 1; border-radius: 8px; object-fit: cover; background: #1a120c; }
.dc-kicker { font-size: 12px; font-weight: 600; color: #949ba4; letter-spacing: .02em; text-transform: uppercase; }
.dc-title { font-size: 20px; font-weight: 700; color: #f2f3f5; line-height: 1.3; }
.dc-card p { margin: 0; }
.dc-text { display: grid; gap: 2px; } .dc-h3 { font-size: 16px; font-weight: 700; color: #f2f3f5; } .dc-quote { border-left: 4px solid #4e5058; padding-left: 10px; } .dc-li::before { content: "• "; }
.dc-code { background: #1e1f22; border-radius: 4px; padding: 0 4px; font-size: 13px; } .dc-gallery { display: grid; gap: 4px; } .dc-image { width: 100%; border-radius: 8px; }
.dc-section { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; } .dc-thumb { width: 72px; height: 72px; border-radius: 8px; object-fit: cover; }
.dc-code-block { margin: 6px 0 0 56px; } .dc-code-block summary { cursor: pointer; color: #00a8fc; font-size: 13px; } .dc-code-block pre { margin: 8px 0 0; padding: 12px 14px; max-width: 640px; overflow-x: auto; border-radius: 8px; background: #1e1f22; color: #dbdee1; font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
.dc-small { font-size: 12px; color: #949ba4; }
.dc-sep { height: 1px; background: #3f4147; margin: 4px 0; }
.dc-bar { letter-spacing: 1px; color: #b5bac1; }
.dc-mention { background: rgba(88,101,242,.3); color: #c9cdfb; border-radius: 3px; padding: 0 2px; font-weight: 500; }
.dc-ts { background: rgba(255,255,255,.06); border-radius: 3px; padding: 0 3px; }
.dc-coins { display: inline-flex; align-items: center; gap: 4px; vertical-align: -3px; }
.dc-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.dc-btn { height: 32px; padding: 0 16px; border-radius: 8px; font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; color: #fff; white-space: nowrap; }
.dc-btn.primary { background: #5865f2; } .dc-btn.success { background: #248046; } .dc-btn.danger { background: #da373c; } .dc-btn.link { background: #4e5058; }
.dc-btn.link::after { content: "↗"; font-size: 13px; opacity: .85; } .dc-btn.off { opacity: .5; }
.dc-eph { margin-top: 6px; font-size: 12px; color: #949ba4; } .dc-eph span { color: #00a8fc; }
:root[data-mode="light"] .dc-channel { background: #ffffff; color: #313338; }
:root[data-mode="light"] .dc-channel .dc-head { background: #ffffff; color: #060607; border-bottom-color: #e3e5e8; }
:root[data-mode="light"] .dc-channel .dc-author b, :root[data-mode="light"] .dc-channel .dc-title { color: #060607; }
:root[data-mode="light"] .dc-channel .dc-card { background: #f2f3f5; border-color: #e3e5e8; }
:root[data-mode="light"] .dc-channel .dc-kicker, :root[data-mode="light"] .dc-channel .dc-small, :root[data-mode="light"] .dc-channel .dc-time, :root[data-mode="light"] .dc-channel .dc-eph { color: #5c5e66; }
:root[data-mode="light"] .dc-channel .dc-sep { background: #e3e5e8; } :root[data-mode="light"] .dc-channel .dc-bar { color: #4e5058; }
:root[data-mode="light"] .dc-channel .dc-mention { background: rgba(88,101,242,.15); color: #505cdc; } :root[data-mode="light"] .dc-channel .dc-ts { background: rgba(6,6,7,.06); }
:root[data-mode="light"] .dc-channel .dc-btn.link { background: #6d6f78; } :root[data-mode="light"] .dc-channel .dc-eph span { color: #006ce7; }
:root[data-mode="light"] .dc-channel .dc-h3 { color: #060607; } :root[data-mode="light"] .dc-channel .dc-code { background: #e3e5e8; } :root[data-mode="light"] .dc-channel .dc-quote { border-left-color: #c4c9ce; }
:root[data-mode="light"] .dc-channel .dc-code-block summary { color: #006ce7; } :root[data-mode="light"] .dc-channel .dc-code-block pre { background: #f2f3f5; color: #313338; }
`;
