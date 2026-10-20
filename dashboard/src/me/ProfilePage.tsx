import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { COSMETIC_SLOTS, DAILY_BONUS, MAX_BIO_LENGTH, MAX_EQUIPPED_BADGES, SLOT_LABELS, levelUpReward } from '../../../src/shared/cosmetics';
import type { CosmeticItem, CosmeticSlot, UserProfileSettings } from '../../../src/shared/cosmetics';
import type { DailyClaimResult, MeProfileResponse } from '../../../src/web/dto/profile';
import { api, useUser } from '../api';
import { LevelUpPreview, ProfileCardPreview } from '../components/ProfileCardPreview';
import { Icon } from '../icons';
import { Card, PageHeader, SaveBar, Select, SwitchRow, TextArea } from '../components/ui';
import {
  cardSubject, countdown, equipItem, isEquipped, num, reducedMotion, resolveCosmetics, unequipItem, useCountUp, useDraft, useMe, useMutation, useNow, useWalletUpdate,
} from './api';
import { Glyph, ItemVisual, Bernis, RARITY_CLASS } from './visuals';

const STREAK_DAYS = DAILY_BONUS.maxStreakBonus / DAILY_BONUS.perStreakDay;

function WalletCard() {
  const { me } = useMe();
  const shown = useCountUp(me.wallet.balance);
  const { todayEarned, dailyCap } = me.wallet;
  return (
    <section className="card !p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] text-mute">Kontostand</span>
        <Link to="/me/verlauf" className="arrow-btn hover:no-underline" aria-label="Verlauf"><span className="inline-block rotate-[135deg]"><Icon name="arrowLeft" size={14} /></span></Link>
      </div>
      <div className="mt-3 text-[36px] font-light leading-none tracking-[-0.03em] text-ink"><Bernis amount={shown} large /></div>
      <p className="mt-2 text-[12.5px] text-faint">Insgesamt verdient: {num(me.wallet.lifetimeEarned)}</p>
      <div className="mt-4">
        <div className="flex justify-between text-[12px] text-mute"><span>Heute aus Level & Minispielen</span><span className="tabular-nums">{num(todayEarned)} / {num(dailyCap)}</span></div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[.06]">
          <div className="h-full rounded-full bg-white/50" style={{ width: `${Math.min(100, (todayEarned / Math.max(dailyCap, 1)) * 100)}%` }} />
        </div>
      </div>
    </section>
  );
}

/** Daily bonus: the page's one hero surface (its claim button is the primary action here). */
function DailyCard() {
  const { me, setMe } = useMe();
  const updateWallet = useWalletUpdate();
  const { run, busy } = useMutation();
  const now = useNow();
  const [gain, setGain] = useState<number | null>(null);
  const root = useRef<HTMLElement>(null);
  const { daily } = me;

  useGSAP(() => {
    if (gain === null || reducedMotion()) return;
    gsap.fromTo('.js-gain', { y: 10, autoAlpha: 0, scale: 0.8 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' });
    gsap.to('.js-gain', { y: -8, autoAlpha: 0, duration: 0.6, delay: 2 });
    gsap.fromTo('.js-streak > span', { scaleY: 0.4 }, { scaleY: 1, duration: 0.5, stagger: 0.04, ease: 'back.out(3)' });
  }, { scope: root, dependencies: [gain], revertOnUpdate: true });

  const claim = async () => {
    const result = await run<DailyClaimResult>('/me/daily', 'POST');
    if (!result) return;
    setGain(result.claimed);
    updateWallet(result.wallet);
    setMe((prev) => ({ ...prev, daily: result.daily }));
  };

  return (
    <section ref={root} className="card card-hero relative !p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-accent-text">Tagesbonus</span>
        <span className="text-[12.5px] text-[var(--accent-text-muted)]">Serie: <b className="font-medium text-ink">{daily.streak} {daily.streak === 1 ? 'Tag' : 'Tage'}</b></span>
      </div>
      <div className="relative mt-3 flex items-end gap-3">
        <span className="text-[36px] font-light leading-none tracking-[-0.03em] text-ink"><Bernis amount={daily.nextAmount} large /></span>
        {gain !== null && <span className="js-gain invisible pb-1 text-[15px] font-semibold text-pos">+{num(gain)}</span>}
      </div>
      <div className="js-streak mt-4 flex gap-1" aria-label={`Serienbonus ${Math.min(daily.streak, STREAK_DAYS)} von ${STREAK_DAYS}`}>
        {Array.from({ length: STREAK_DAYS }, (_, i) => (
          <span key={i} className={`h-2 flex-1 origin-bottom rounded-full ${i < Math.min(daily.streak, STREAK_DAYS) ? 'bg-accent' : 'bg-white/[.08]'}`} />
        ))}
      </div>
      <p className="mt-2 text-[12px] text-[var(--accent-text-muted)]">+{DAILY_BONUS.perStreakDay} pro Tag in Folge, bis +{DAILY_BONUS.maxStreakBonus}</p>
      <div className="mt-4">
        {daily.available
          ? <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={claim}>{busy ? 'Einen Moment …' : 'Bonus abholen'}</button>
          : <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center text-[13px] text-body">Nächster Bonus in <span className="tabular-nums text-ink">{daily.nextAt ? countdown(daily.nextAt, now) : 'Kürze'}</span></div>}
      </div>
    </section>
  );
}

function SlotTile({ selected, onClick, title, children }: { selected: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} aria-pressed={selected}
      className={`relative w-[92px] shrink-0 cursor-pointer rounded-xl border bg-transparent p-1 font-[inherit] text-left transition ${selected ? 'border-accent ring-2 ring-accent/30' : 'border-white/[.06] hover:border-white/20'}`}>
      {children}
      <span className={`mt-1 block truncate px-0.5 text-[11.5px] ${selected ? 'text-ink' : 'text-mute'}`}>{title}</span>
      {selected && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-ink"><Glyph name="check" size={12} /></span>}
    </button>
  );
}

function SlotEditor({ value, onChange }: { value: UserProfileSettings; onChange: (next: UserProfileSettings) => void }) {
  const { me, items } = useMe();
  const owned = useMemo(() => {
    const bySlot = new Map<CosmeticSlot, CosmeticItem[]>();
    for (const o of me.inventory) {
      const item = items.get(o.itemId);
      if (item) bySlot.set(item.slot, [...(bySlot.get(item.slot) ?? []), item]);
    }
    return bySlot;
  }, [me.inventory, items]);
  const unknown = me.inventory.filter((o) => !items.has(o.itemId)).length;

  const toggle = (item: CosmeticItem) => {
    const on = isEquipped(value.equipped, item);
    if (!on && item.slot === 'badge' && value.equipped.badges.length >= MAX_EQUIPPED_BADGES) return;
    onChange({ ...value, equipped: on ? unequipItem(value.equipped, item) : equipItem(value.equipped, item) });
  };
  const clear = (slot: CosmeticSlot) => onChange({ ...value, equipped: slot === 'badge' ? { ...value.equipped, badges: [] } : { ...value.equipped, [slot]: null } });

  return (
    <div className="divide-y divide-white/[.05]">
      {COSMETIC_SLOTS.map((slot) => {
        const list = owned.get(slot) ?? [];
        const isDefault = slot === 'badge' ? value.equipped.badges.length === 0 : value.equipped[slot] === null;
        return (
          <div key={slot} className="grid grid-cols-1 gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[150px_minmax(0,1fr)]">
            <div className="pt-1">
              <div className="text-[14px] font-medium text-ink">{SLOT_LABELS[slot]}</div>
              {slot === 'badge' && <div className="text-[12px] text-faint">{value.equipped.badges.length} / {MAX_EQUIPPED_BADGES} angelegt</div>}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <SlotTile selected={isDefault} onClick={() => clear(slot)} title={slot === 'badge' ? 'Keine' : 'Standard'}>
                <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-white/[.03] text-[11px] text-faint">Nexo</div>
              </SlotTile>
              {list.map((item) => (
                <SlotTile key={item.id} selected={isEquipped(value.equipped, item)} onClick={() => toggle(item)} title={item.name}>
                  <ItemVisual item={item} className={`rounded-lg border ${RARITY_CLASS[item.rarity].border}`} />
                </SlotTile>
              ))}
              {list.length === 0 && <Link to="/me/shop" className="self-center pl-2 text-[13px]">Noch nichts – im Shop stöbern</Link>}
            </div>
          </div>
        );
      })}
      {unknown > 0 && <p className="faint pt-4">{unknown} Artikel aus deinem Inventar sind gerade nicht im Katalog und können hier nicht angezeigt werden.</p>}
    </div>
  );
}

export default function ProfilePage() {
  const { me, setMe, items } = useMe();
  const user = useUser();
  const [guildId, setGuildId] = useState<string | null>(me.levels[0]?.guildId ?? null);
  const persist = useCallback(async (draft: UserProfileSettings) => {
    const result = await api<MeProfileResponse>('/me/profile', { method: 'PUT', body: draft });
    setMe(() => result);
  }, [setMe]);
  const form = useDraft(me.profile, persist);
  const value = form.draft ?? me.profile;
  const subject = cardSubject(user, me, guildId, value.bio);
  const cosmetics = resolveCosmetics(value.equipped, items);

  return (
    <>
      <PageHeader kicker="Mein Profil" title={`Hey ${subject.name}!`}
        description="Gestalte deine Profilkarte. Sie gilt auf allen Servern mit Nexo – nur das Level kommt vom jeweiligen Server."
        actions={<Link to="/me/shop" className="btn btn-secondary hover:no-underline"><Glyph name="bag" size={16} /> Zum Shop</Link>} />

      {/* The card is the centrepiece: full width until there is room for a side column (xl). */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card title="Deine Karte" description="So sieht deine Profilkarte gerade aus.">
          <ProfileCardPreview subject={subject} cosmetics={cosmetics} className="w-full" />
          {me.levels.length > 1 && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-mute">
              Level von
              <div className="min-w-0 flex-1 sm:max-w-[280px]">
                <Select value={guildId ?? ''} onChange={setGuildId} options={me.levels.map((l) => ({ value: l.guildId, label: `${l.guildName} · Level ${l.level}` }))} />
              </div>
            </div>
          )}
        </Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1 xl:content-start">
          <WalletCard />
          <DailyCard />
        </div>
      </div>

      <div className="mt-4">
        <Card title="Ausrüstung" description={`Wähle pro Bereich einen Artikel aus deinem Inventar – bei Abzeichen bis zu ${MAX_EQUIPPED_BADGES}.`}>
          <SlotEditor value={value} onChange={form.setDraft} />
        </Card>
        <div className="grid-2 mt-4 [&>*]:mt-0 [&>*]:min-w-0">
          <Card title="Über dich" description="Kurzer Text auf deiner Karte.">
            <div className="stack">
              <TextArea value={value.bio} onChange={(bio) => form.setDraft({ ...value, bio })} maxLength={MAX_BIO_LENGTH} rows={3} placeholder="Was sollen andere über dich wissen?" />
              <SwitchRow title="Auf Willkommenskarten zeigen" description="Server, die Mitglieder-Styles erlauben, zeigen deinen Rahmen und deine Farben auf der Willkommenskarte."
                checked={value.showOnWelcome} onChange={(showOnWelcome) => form.setDraft({ ...value, showOnWelcome })} />
            </div>
          </Card>
          <Card title="Level-up-Nachricht" description="So meldet Nexo deinen nächsten Aufstieg.">
            <LevelUpPreview subject={subject} cosmetics={cosmetics} level={subject.level + 1} reward={levelUpReward(subject.level + 1)} />
          </Card>
        </div>
      </div>
      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onReset={form.reset} />
    </>
  );
}
