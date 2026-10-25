// A Discord channel with Nexo cards, close to how the bot's Components V2 messages look: banner in the role's
// colour (drawn by the bot's own banner code), accent stripe, kicker, title, sections and buttons coloured by action.
import type { ReactNode } from 'react';
import type { MessagePalette, MessageRole } from '../../src/shared/theme';
import { actionColour } from '../../src/shared/buttonStyle';

export interface DiscordButton { label: string; link?: boolean; disabled?: boolean }

export function DiscordMessage({ palette, role, motif, kicker, title, time, buttons, ephemeral, children }: {
  palette: MessagePalette; role: MessageRole; motif?: string; kicker?: string; title: string; time: string;
  buttons?: DiscordButton[]; ephemeral?: boolean; children?: ReactNode;
}) {
  const accent = palette[role];
  return (
    <div className="dc-msg">
      <img className="dc-avatar" src="/dashboard/nexo.svg" alt="" />
      <div className="dc-body">
        <div className="dc-author"><b>Nexo</b><span className="dc-app">APP</span><span className="dc-time">Heute um {time}</span></div>
        <div className="dc-card" style={{ borderLeftColor: accent }}>
          <img className="dc-banner" src={`/dashboard/banners/${motif ?? role}.png?c=${accent.slice(1)}&v=4`} alt="" />
          <div>
            {kicker && <div className="dc-kicker">{kicker}</div>}
            <div className="dc-title">{title}</div>
          </div>
          {children}
          {buttons && (
            <div className="dc-buttons">
              {buttons.map((button) => (
                <span key={button.label} className={`dc-btn ${button.link ? 'link' : actionColour(button.label)}${button.disabled ? ' off' : ''}`}>{button.label}</span>
              ))}
            </div>
          )}
        </div>
        {ephemeral && <div className="dc-eph">Nur du kannst das sehen · <span>Nachricht verwerfen</span></div>}
      </div>
    </div>
  );
}

export const Bar = ({ value, max }: { value: number; max: number }) => {
  const filled = Math.round((value / max) * 10);
  return <span className="dc-bar">{'▰'.repeat(filled)}{'▱'.repeat(10 - filled)}</span>;
};

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
.dc-channel.light { background: #ffffff; color: #313338; }
.dc-channel.light .dc-head { background: #ffffff; color: #060607; border-bottom-color: #e3e5e8; }
.dc-channel.light .dc-author b, .dc-channel.light .dc-title { color: #060607; }
.dc-channel.light .dc-card { background: #f2f3f5; border-color: #e3e5e8; }
.dc-channel.light .dc-kicker, .dc-channel.light .dc-small, .dc-channel.light .dc-time, .dc-channel.light .dc-eph { color: #5c5e66; }
.dc-channel.light .dc-sep { background: #e3e5e8; } .dc-channel.light .dc-bar { color: #4e5058; }
.dc-channel.light .dc-mention { background: rgba(88,101,242,.15); color: #505cdc; } .dc-channel.light .dc-ts { background: rgba(6,6,7,.06); }
.dc-channel.light .dc-btn.link { background: #6d6f78; } .dc-channel.light .dc-eph span { color: #006ce7; }
`;
