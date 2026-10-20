// Right half of the item detail: shows exactly what you get, on your own things — the profile card wearing the item,
// and the same card the way Nexo posts it in a Discord chat (or the level-up message for level-up styles).
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { levelUpReward } from '../../../src/shared/cosmetics';
import type { CosmeticItem } from '../../../src/shared/cosmetics';
import { useUser } from '../api';
import { LevelUpPreview, ProfileCardPreview } from '../components/ProfileCardPreview';
import { NexoLogo } from '../components/NexoLogo';
import { Icon } from '../icons';
import { cardSubject, equipItem, resolveCosmetics, useMe } from './api';
import { backgroundStyle } from './visuals';

/** The member's card with `item` put on (temporarily), or the level-up message for level-up styles. */
export function TryOnPreview({ item, className = 'w-full' }: { item: CosmeticItem; className?: string }) {
  const { me, items } = useMe();
  const user = useUser();
  const catalog = useMemo(() => new Map(items).set(item.id, item), [items, item]);
  const subject = cardSubject(user, me, null, me.profile.bio);
  const cosmetics = resolveCosmetics(equipItem(me.profile.equipped, item), catalog);
  return item.slot === 'levelup'
    ? <LevelUpPreview subject={subject} cosmetics={cosmetics} level={subject.level + 1} reward={levelUpReward(subject.level + 1)} className={className} />
    : <ProfileCardPreview subject={subject} cosmetics={cosmetics} className={className} />;
}

/** Discord look-alike message by Nexo carrying the card, so you see it where your friends will see it. */
function ChatPreview({ item }: { item: CosmeticItem }) {
  const user = useUser();
  const { me } = useMe();
  const name = user?.globalName ?? user?.username ?? 'Du';
  const level = (me.levels[0]?.level ?? 0) + 1;
  const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="w-full max-w-[600px] rounded-2xl bg-[#313338] p-4 text-left shadow-[0_30px_80px_-24px_rgba(0,0,0,.9)] ring-1 ring-black/40" style={{ fontFamily: '"gg sans", var(--font)' }}>
      {item.slot !== 'levelup' && (
        <div className="mb-1 flex items-center gap-1.5 pl-[54px] text-[12.5px] text-[#b5bac1]">
          {user && <img src={user.avatarUrl} alt="" className="h-4 w-4 rounded-full" />}
          <span className="font-medium text-[#f2f3f5]">{name}</span> hat <span className="rounded bg-[#5865f2]/30 px-1 text-[#c9cdfb]">/profil</span> verwendet
        </div>
      )}
      <div className="flex gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1e1f22]"><NexoLogo className="w-8" animated={false} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#f2f3f5]">Nexo</span>
            <span className="rounded-[3px] bg-[#5865f2] px-1 py-px text-[10px] font-semibold text-[#fff]">BOT</span>
            <span className="text-[12px] text-[#949ba4]">Heute um {time}</span>
          </div>
          {item.slot === 'levelup' && (
            <p className="mt-0.5 text-[15px] text-[#dbdee1]">GG <span className="rounded bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]">@{name}</span>, du bist jetzt Level {level}!</p>
          )}
          <div className="mt-1.5 max-w-[460px] overflow-hidden rounded-lg"><TryOnPreview item={item} /></div>
        </div>
      </div>
    </div>
  );
}

const VIEWS = [
  { id: 'card', label: 'Deine Karte' },
  { id: 'chat', label: 'Im Discord-Chat' },
] as const;

/** Stage with the item shown in context; the backdrop is the item itself (backgrounds) or its rarity light. */
export function ProductStage({ item, tint, kicker }: { item: CosmeticItem; tint: string; kicker: string }) {
  const [view, setView] = useState(0);
  const step = (dir: number) => setView((current) => (current + dir + VIEWS.length) % VIEWS.length);
  const backdrop: CSSProperties = item.slot === 'background'
    ? backgroundStyle(item.data)
    : { background: `radial-gradient(70% 70% at 50% 45%, color-mix(in srgb, ${tint} 40%, transparent), transparent 75%), #0d0b0a` };
  return (
    <div data-mode="dark" className="relative flex h-full min-h-[300px] flex-col overflow-clip bg-[#0d0b0a]">
      <div className="absolute inset-0 scale-110 blur-2xl" style={backdrop} />
      <div className="absolute inset-0 bg-black/35" />
      <div className="game-tile-field absolute inset-0 opacity-50" style={{ '--tile': tint } as CSSProperties} />
      <div className="relative flex items-center gap-2 p-4">
        <span className="rounded-xl bg-black/45 px-3 py-1.5 text-[12.5px] font-semibold text-white backdrop-blur">{kicker}</span>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-6">
        {VIEWS[view].id === 'card'
          ? <div className="w-full max-w-[620px] overflow-hidden rounded-2xl shadow-[0_30px_80px_-24px_rgba(0,0,0,.9)] ring-1 ring-white/10"><TryOnPreview item={item} /></div>
          : <ChatPreview item={item} />}
        <button type="button" aria-label="Vorherige Ansicht" onClick={() => step(-1)} className="icon-btn absolute left-3 top-1/2 z-10 -translate-y-1/2 bg-black/45 text-white backdrop-blur hover:bg-black/60"><Icon name="arrowLeft" size={18} /></button>
        <button type="button" aria-label="Nächste Ansicht" onClick={() => step(1)} className="icon-btn absolute right-3 top-1/2 z-10 -translate-y-1/2 bg-black/45 text-white backdrop-blur hover:bg-black/60"><Icon name="arrowRight" size={18} /></button>
      </div>
      <div className="relative flex justify-center gap-2 pb-4">
        {VIEWS.map((v, i) => (
          <button key={v.id} type="button" onClick={() => setView(i)} aria-pressed={view === i}
            className={`cursor-pointer rounded-full border-0 px-3 py-1 text-[12px] font-medium backdrop-blur transition ${view === i ? 'bg-white text-[#111]' : 'bg-black/45 text-white/80 hover:text-white'}`}>{v.label}</button>
        ))}
      </div>
    </div>
  );
}
