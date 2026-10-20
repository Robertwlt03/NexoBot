// Right half of the item and bundle detail: shows exactly what you get, on your own things — the profile card wearing
// the item(s), the same card the way Nexo posts it in a Discord chat, and the level-up message for level-up styles.
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

type Surface = 'card' | 'levelup';

/** The member's card (or level-up message) with `items` put on, temporarily. */
export function TryOnPreview({ items: wearing, surface = 'card', className = 'w-full', resolution = 1 }: { items: CosmeticItem[]; surface?: Surface; className?: string; resolution?: number }) {
  const { me, items } = useMe();
  const user = useUser();
  const catalog = useMemo(() => {
    const map = new Map(items);
    for (const item of wearing) map.set(item.id, item);
    return map;
  }, [items, wearing]);
  const subject = cardSubject(user, me, null, me.profile.bio);
  const cosmetics = resolveCosmetics(wearing.reduce((equipped, item) => equipItem(equipped, item), me.profile.equipped), catalog);
  return surface === 'levelup'
    ? <LevelUpPreview subject={subject} cosmetics={cosmetics} level={subject.level + 1} reward={levelUpReward(subject.level + 1)} className={className} />
    : <ProfileCardPreview subject={subject} cosmetics={cosmetics} className={className} resolution={resolution} />;
}

/** Discord look-alike message by Nexo carrying the card, so you see it where your friends will see it. */
function ChatPreview({ items, surface }: { items: CosmeticItem[]; surface: Surface }) {
  const user = useUser();
  const { me } = useMe();
  const name = user?.globalName ?? user?.username ?? 'Du';
  const level = (me.levels[0]?.level ?? 0) + 1;
  const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="w-full max-w-[600px] rounded-2xl bg-[#313338] p-4 text-left shadow-[0_30px_80px_-24px_rgba(0,0,0,.9)] ring-1 ring-black/40" style={{ fontFamily: '"gg sans", var(--font)' }}>
      {surface === 'card' && (
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
          {surface === 'levelup' && (
            <p className="mt-0.5 text-[15px] text-[#dbdee1]">GG <span className="rounded bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]">@{name}</span>, du bist jetzt Level {level}!</p>
          )}
          <div className="mt-1.5 max-w-[460px] overflow-hidden rounded-lg"><TryOnPreview items={items} surface={surface} /></div>
        </div>
      </div>
    </div>
  );
}

interface View { id: string; label: string; surface: Surface; chat: boolean }

/** Which views make sense: level-up styles are seen in the level-up message, everything else on the card. */
function viewsFor(items: CosmeticItem[]): View[] {
  const onCard = items.some((item) => item.slot !== 'levelup');
  const levelup = items.some((item) => item.slot === 'levelup');
  return [
    ...(onCard ? [{ id: 'card', label: 'Deine Karte', surface: 'card' as const, chat: false }, { id: 'chat', label: 'Im Discord-Chat', surface: 'card' as const, chat: true }] : []),
    ...(levelup ? [{ id: 'levelup', label: 'Level-up', surface: 'levelup' as const, chat: true }] : []),
  ];
}

/** Stage with the item(s) shown in context; the backdrop is a background item itself or the rarity light. */
export function ProductStage({ items, tint, kicker }: { items: CosmeticItem[]; tint: string; kicker: string }) {
  const views = viewsFor(items);
  const [index, setIndex] = useState(0);
  const view = views[Math.min(index, views.length - 1)];
  const step = (dir: number) => setIndex((current) => (current + dir + views.length) % views.length);
  const background = items.find((item) => item.slot === 'background');
  const backdrop: CSSProperties = background?.slot === 'background'
    ? backgroundStyle(background.data)
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
        {view.chat
          ? <ChatPreview items={items} surface={view.surface} />
          : <div className="w-full max-w-[620px] overflow-hidden rounded-2xl shadow-[0_30px_80px_-24px_rgba(0,0,0,.9)] ring-1 ring-white/10"><TryOnPreview items={items} surface={view.surface} /></div>}
        {views.length > 1 && (
          <>
            <button type="button" aria-label="Vorherige Ansicht" onClick={() => step(-1)} className="icon-btn absolute left-3 top-1/2 z-10 -translate-y-1/2 bg-black/45 text-white backdrop-blur hover:bg-black/60"><Icon name="arrowLeft" size={18} /></button>
            <button type="button" aria-label="Nächste Ansicht" onClick={() => step(1)} className="icon-btn absolute right-3 top-1/2 z-10 -translate-y-1/2 bg-black/45 text-white backdrop-blur hover:bg-black/60"><Icon name="arrowRight" size={18} /></button>
          </>
        )}
      </div>
      <div className="relative flex justify-center gap-2 pb-4">
        {views.map((v, i) => (
          <button key={v.id} type="button" onClick={() => setIndex(i)} aria-pressed={view.id === v.id}
            className={`cursor-pointer rounded-full border-0 px-3 py-1 text-[12px] font-medium backdrop-blur transition ${view.id === v.id ? 'bg-white text-[#111]' : 'bg-black/45 text-white/80 hover:text-white'}`}>{v.label}</button>
        ))}
      </div>
    </div>
  );
}
