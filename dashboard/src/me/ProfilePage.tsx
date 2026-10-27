import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { useGSAP } from '@gsap/react';
import { COSMETIC_SLOTS, DAILY_BONUS, STREAK_SHIELD, MAX_BIO_LENGTH, MAX_EQUIPPED_BADGES, SLOT_LABELS, STICKER_SPOTS, levelUpReward } from '../../../src/shared/cosmetics';
import { PROFILE_CARD_HEIGHT, PROFILE_CARD_WIDTH, drawSticker, profileGeometry, stickerPoint, stickerRadius } from '../../../src/shared/profileCard';
import type { CosmeticItem, CosmeticSlot, ResolvedCosmetics, StickerData, StickerSpot, UserProfileSettings } from '../../../src/shared/cosmetics';
import type { DailyClaimResult, LinkedRoleValues, MeProfileResponse, QuestsResponse } from '../../../src/web/dto/profile';
import { api, useToast, useUser } from '../api';
import { LevelUpPreview, ProfileCardPreview } from '../components/ProfileCardPreview';
import { Icon } from '../icons';
import { Badge, Card, Meter, PageHeader, SaveBar, Select, Switch, SwitchRow, TextArea } from '../components/ui';
import {
  cardSubject, countdown, equipItem, isEquipped, num, reducedMotion, resolveCosmetics, unequipItem, useCountUp, useDraft, useMe, useMutation, useNow, useWalletUpdate,
} from './api';
import { Glyph, ItemVisual, Bernis, CoinStacks, RARITY_CLASS } from './visuals';
import { FoodIcon, PetCareCard } from './PetCare';

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
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="text-[36px] font-light leading-none tracking-[-0.03em] text-ink"><Bernis amount={shown} large nowrap /></div>
        <CoinStacks amount={me.wallet.balance} />
      </div>
      <p className="mt-2 text-[12.5px] text-faint">Insgesamt verdient: <Bernis amount={me.wallet.lifetimeEarned} nowrap /></p>
      <div className="mt-4">
        <div className="flex justify-between text-[12px] text-mute"><span>Heute aus Level & Minispielen</span><span className="text-right"><Bernis amount={todayEarned} nowrap /> von <Bernis amount={dailyCap} nowrap /></span></div>
        <Meter className="mt-1.5" value={todayEarned} max={dailyCap} label="Heute aus Level und Minispielen" />
      </div>
    </section>
  );
}

/** Daily bonus: the page's one hero surface (its claim button is the primary action here). */
function DailyCard() {
  const { me, setMe } = useMe();
  const updateWallet = useWalletUpdate();
  const { run, busy } = useMutation();
  const { run: toggleReminders, busy: reminderBusy } = useMutation();
  const { run: runShield, busy: shieldBusy } = useMutation();
  const buyShield = async () => {
    const result = await runShield<Pick<DailyClaimResult, 'wallet' | 'daily'>>('/me/daily/shield', 'POST', undefined, 'Serien-Schutz gekauft.');
    if (!result) return;
    updateWallet(result.wallet);
    setMe((prev) => ({ ...prev, daily: result.daily }));
  };
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
        <span className="text-[12.5px] text-accent-mute">Serie: <b className="font-medium text-ink">{daily.streak} {daily.streak === 1 ? 'Tag' : 'Tage'}</b></span>
      </div>
      <div className="relative mt-3 flex items-end gap-3">
        <span className="text-[36px] font-light leading-none tracking-[-0.03em] text-ink"><Bernis amount={daily.nextAmount} large /></span>
        {gain !== null && <span className="js-gain invisible pb-1 text-[15px] font-semibold text-pos">+{num(gain)}</span>}
      </div>
      <div className="js-streak mt-4 flex gap-1" aria-label={`Serienbonus ${Math.min(daily.streak, STREAK_DAYS)} von ${STREAK_DAYS}`}>
        {Array.from({ length: STREAK_DAYS }, (_, i) => (
          <span key={i} className={`h-2 flex-1 origin-bottom rounded-full ${i < Math.min(daily.streak, STREAK_DAYS) ? 'bg-accent' : 'bg-tint-strong'}`} />
        ))}
      </div>
      <p className="mt-2 text-[12px] text-accent-mute">+{DAILY_BONUS.perStreakDay} pro Tag in Folge, bis +{DAILY_BONUS.maxStreakBonus}</p>
      {daily.available && daily.saving > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-line-strong bg-tint-strong px-3 py-2 text-[12.5px] text-ink">
          <Glyph name="shield" size={16} /> Dein Serien-Schutz rettet deine Serie: {daily.saving === 1 ? 'ein verpasster Tag wird' : `${daily.saving} verpasste Tage werden`} überbrückt.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[12.5px] text-accent-mute">
        <span className="flex flex-wrap items-center gap-1.5">
          {Array.from({ length: STREAK_SHIELD.max }, (_, i) => (
            <span key={i} className={i < daily.shields ? 'text-ink' : 'opacity-35'}><Glyph name="shield" size={16} /></span>
          ))}
          Serien-Schutz {daily.shields} von {STREAK_SHIELD.max}
          <span className="basis-full">Jeder Serien-Schutz überbrückt einen verpassten Tag.</span>
        </span>
        {daily.shields < STREAK_SHIELD.max && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={shieldBusy || me.wallet.balance < STREAK_SHIELD.price} onClick={buyShield}>
            Kaufen für <Bernis amount={STREAK_SHIELD.price} nowrap />
          </button>
        )}
      </div>
      <div className="mt-4">
        {daily.available
          ? <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={claim}>{busy ? 'Einen Moment …' : 'Bonus abholen'}</button>
          : <div className="rounded-xl border border-line-strong bg-tint-strong px-3 py-2 text-center text-[13px] text-body">Nächster Bonus in <span className="tabular-nums text-ink">{daily.nextAt ? countdown(daily.nextAt, now) : 'Kürze'}</span></div>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-[12.5px] text-accent-mute">
        <span>Um 19 Uhr per DM erinnern, wenn noch etwas offen ist</span>
        <Switch checked={me.reminders} label="Erinnerung per DM" disabled={reminderBusy}
          onChange={async (enabled) => { if (await toggleReminders<{ enabled: boolean }>('/me/reminders', 'PUT', { enabled }, enabled ? 'Erinnerung an.' : 'Erinnerung aus.')) setMe((prev) => ({ ...prev, reminders: enabled })); }} />
      </div>
    </section>
  );
}

/** Today's three quests; polled once a minute while visible, since they pay out on their own. */
function QuestsCard() {
  const { me, setMe } = useMe();
  const updateWallet = useWalletUpdate();
  const now = useNow(30_000);
  const { quests, bonus, resetsAt } = me.quests;
  useEffect(() => {
    const poll = async () => {
      if (document.hidden) return;
      const result = await api<QuestsResponse>('/me/quests').catch(() => null);
      if (!result) return;
      setMe((prev) => ({ ...prev, quests: result.quests }));
      updateWallet(result.wallet);
    };
    const timer = window.setInterval(poll, 60_000);
    return () => window.clearInterval(timer);
  }, [setMe, updateWallet]);
  const doneCount = quests.filter((quest) => quest.done).length;

  return (
    <section className="card !p-5 md:col-span-2 xl:col-span-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[13px] text-mute">Tagesaufgaben · {doneCount} von {quests.length}</span>
        <span className="text-[12px] text-faint">Neue in <span className="tabular-nums">{countdown(resetsAt, now)}</span></span>
      </div>
      <ul className="mt-3 flex list-none flex-col gap-3 p-0">
        {quests.map((quest) => (
          <li key={quest.id}>
            <div className="flex items-start gap-2.5">
              <span className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full ${quest.done ? 'bg-pos text-canvas' : 'border border-control'}`}>
                {quest.done && <Glyph name="check" size={12} />}
              </span>
              <span className={`min-w-0 flex-1 text-[13.5px] leading-snug ${quest.done ? 'text-mute' : 'text-ink'}`}>{quest.label}</span>
              <span className="shrink-0 text-[12.5px] text-mute">+<Bernis amount={quest.reward} nowrap /></span>
            </div>
            {!quest.done && (
              <div className="ml-[30px] mt-1.5 flex items-center gap-2">
                <Meter className="flex-1" value={quest.current} max={quest.target} label={quest.label} />
                <span className="text-[11.5px] tabular-nums text-faint">{quest.current} / {quest.target}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className={`mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] ${bonus.done ? 'border-pos/30 bg-pos/10 text-ink' : 'border-line bg-tint text-mute'}`}>
        <Glyph name="gift" size={16} />
        <span className="min-w-0 flex-1">{bonus.done ? 'Alle geschafft – Bonus kassiert!' : 'Alle drei geschafft:'}</span>
        <span className="shrink-0">+<Bernis amount={bonus.reward} nowrap /></span>
        {bonus.food && <span className="flex shrink-0 items-center gap-1">+1 <FoodIcon size={17} /> Futter</span>}
      </div>
      <p className="mt-2 text-[11.5px] text-faint">Zählt auf allen Servern mit Nexo. Fertige Aufgaben zahlen sich von selbst aus.</p>
    </section>
  );
}

/** Opt-in public profile link; posted in Discord it unfurls into the card with level and season. */
function ShareProfile() {
  const { me, setMe } = useMe();
  const user = useUser();
  const toast = useToast();
  const { run, busy } = useMutation();
  const link = `${window.location.origin}/dashboard/p/${user?.id ?? ''}`;
  const toggle = async (enabled: boolean) => {
    if (await run<{ enabled: boolean }>('/me/share', 'PUT', { enabled }, enabled ? 'Profil-Link ist an.' : 'Profil-Link ist aus.')) setMe((prev) => ({ ...prev, shareProfile: enabled }));
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link kopiert – füg ihn in Discord ein.');
    } catch {
      toast('Kopieren ging nicht – markier den Link und kopier ihn selbst.', true);
    }
  };
  return (
    <>
      <SwitchRow title="Profil-Link teilen" description="Ein öffentlicher Link zu deiner Profilkarte. In Discord gepostet, zeigt er Karte, Level und Saison als Vorschau."
        checked={me.shareProfile} disabled={busy} onChange={toggle} />
      {me.shareProfile && (
        <div className="flex flex-wrap gap-2">
          <input readOnly value={link} aria-label="Dein Profil-Link" className="input min-w-0 flex-[1_1_220px] font-mono text-[12.5px]" onFocus={(event) => event.currentTarget.select()} />
          <button type="button" className="btn btn-secondary" onClick={copy}>Kopieren</button>
        </div>
      )}
    </>
  );
}

const ROLE_VALUES: { key: keyof LinkedRoleValues; label: string }[] = [
  { key: 'level', label: 'Höchstes Level' }, { key: 'season_tier', label: 'Saison-Stufe' }, { key: 'achievements', label: 'Erfolge' },
  { key: 'chat_days', label: 'Chat-Tage' }, { key: 'bernis', label: 'Verdiente Bernis' },
];

/** Linked Roles: servers hand out roles by these values once the member linked Nexo in Discord. */
function LinkedRoleCard() {
  const { me, setMe } = useMe();
  const { run, busy } = useMutation();
  const { linked, values } = me.linkedRole;
  const apply = (result: { linkedRole: MeProfileResponse['linkedRole'] } | null) => { if (result) setMe((prev) => ({ ...prev, linkedRole: result.linkedRole })); };
  return (
    <Card title="Verknüpfte Rollen" description="Server können dir Rollen geben, wenn du bestimmte Nexo-Werte erreichst – etwa ab Level 10 oder Saison-Stufe 5.">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {ROLE_VALUES.map(({ key, label }) => (
          <div key={key} className="flex flex-col-reverse rounded-xl border border-line bg-tint px-3 py-2">
            <dt className="text-[12px] text-mute">{label}</dt>
            <dd className="m-0 text-[18px] font-medium text-ink">{key === 'bernis' ? <Bernis amount={values.bernis} nowrap /> : num(values[key])}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {linked ? (
          <>
            <Badge tone="pos">Mit Discord verknüpft</Badge>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={async () => apply(await run('/me/linked-role/sync', 'POST', undefined, 'Werte an Discord übertragen.'))}>Jetzt aktualisieren</button>
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={async () => apply(await run('/me/linked-role', 'DELETE', undefined, 'Verknüpfung getrennt.'))}>Trennen</button>
          </>
        ) : (
          <a href="/dashboard/linked-role" className="btn btn-primary hover:no-underline">Mit Discord verknüpfen</a>
        )}
      </div>
      <p className="mt-3 text-[12px] text-faint">
        {linked ? 'Nexo überträgt deine Werte stündlich. Trennen entfernt auch die Rollen, die davon abhängen.' : 'Du verknüpfst einmal, danach hält Nexo die Werte stündlich aktuell. Du kannst es jederzeit wieder trennen.'}
      </p>
    </Card>
  );
}

function SlotTile({ selected, onClick, title, children }: { selected: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`relative min-w-0 cursor-pointer rounded-xl border bg-transparent p-1 font-[inherit] text-left transition ${selected ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-control'}`}>
      {children}
      <span className={`mt-1 block break-words px-0.5 leading-tight text-[11.5px] ${selected ? 'text-ink' : 'text-mute'}`}>{title}</span>
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
    <div className="divide-y divide-line">
      {COSMETIC_SLOTS.map((slot) => {
        const list = owned.get(slot) ?? [];
        const isDefault = slot === 'badge' ? value.equipped.badges.length === 0 : value.equipped[slot] === null;
        return (
          <div key={slot} className="grid grid-cols-1 gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[150px_minmax(0,1fr)]">
            <div className="pt-1">
              <div className="text-[14px] font-medium text-ink">{SLOT_LABELS[slot]}</div>
              {slot === 'badge' && <div className="text-[12px] text-faint">{value.equipped.badges.length} / {MAX_EQUIPPED_BADGES} angelegt</div>}
              {slot === 'pet' && <div className="text-[12px] text-faint">Wächst, wenn du es fütterst (Begleiter oben)</div>}
            </div>
            {/* Wraps onto more rows instead of scrolling sideways, so every item is one click away. */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
              <SlotTile selected={isDefault} onClick={() => clear(slot)} title={slot === 'badge' ? 'Keine' : 'Standard'}>
                <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-tint text-[11px] text-faint">Nexo</div>
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

const SPOT_LABELS: Record<StickerSpot, string> = { tl: 'oben links', tr: 'oben rechts', bl: 'unten links', br: 'unten rechts', avatar: 'auf deinem Avatar' };

gsap.registerPlugin(Draggable, InertiaPlugin);

/** The sticker exactly as the card renderer paints it, on its own small canvas (in card units × 2). */
function StickerCanvas({ sticker }: { sticker: StickerData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const box = stickerRadius(sticker.corner) * 2.6;
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, box, box);
    drawSticker(ctx, sticker, box / 2, box / 2);
  }, [sticker, box]);
  return <canvas ref={ref} width={box * 2} height={box * 2} className="pointer-events-none block h-full w-full" />;
}

/**
 * The member's sticker as a GSAP Draggable over the card (the card itself is drawn without it). Grab it and it
 * lifts (bigger, tilted, deeper shadow); the spot it would land on lights up; let go or throw it and it flies to
 * the nearest spot and settles with a little bounce. A short press (or Enter) lifts it so a spot can be tapped;
 * right after picking a sticker from the inventory the spots show too. Reduced motion: no flight, just the move.
 */
function StickerPlacement({ sticker, layout, placing, setPlacing, onPick }: {
  sticker: StickerData; layout: ResolvedCosmetics['layout']; placing: boolean; setPlacing: (placing: boolean) => void; onPick: (spot: StickerSpot) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const piece = useRef<HTMLDivElement>(null);
  const current = sticker.corner;
  const [lifted, setLifted] = useState(false);
  const [target, setTarget] = useState<StickerSpot>(current);
  const avatar = profileGeometry(layout?.layout ?? 'classic').avatar;
  const points = STICKER_SPOTS.map((spot) => ({ spot, ...stickerPoint(spot, avatar) }));
  const pct = (x: number, y: number) => ({ left: `${(x / PROFILE_CARD_WIDTH) * 100}%`, top: `${(y / PROFILE_CARD_HEIGHT) * 100}%` });
  // Draggable's x/y are offsets from where the sticker sits now; convert spots into that space (in px).
  const live = useRef({ current, points, onPick, setPlacing });
  live.current = { current, points, onPick, setPlacing };
  const offsetOf = (spot: StickerSpot) => {
    const { width, height } = root.current!.getBoundingClientRect();
    const all = live.current.points;
    const from = all.find((p) => p.spot === live.current.current)!;
    const to = all.find((p) => p.spot === spot)!;
    return { x: ((to.x - from.x) / PROFILE_CARD_WIDTH) * width, y: ((to.y - from.y) / PROFILE_CARD_HEIGHT) * height };
  };
  const nearest = (x: number, y: number) => live.current.points.reduce((best, p) => {
    const a = offsetOf(p.spot);
    const b = offsetOf(best.spot);
    return Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? p : best;
  }).spot;

  const { contextSafe } = useGSAP(() => {
    const el = piece.current!;
    gsap.set(el, { xPercent: -50, yPercent: -50 });
    const calm = reducedMotion();
    const settle = (spot: StickerSpot) => {
      gsap.to(el, { scale: 1, rotation: 0, duration: calm ? 0 : 0.45, ease: 'back.out(3)' });
      setLifted(false);
      if (spot !== live.current.current) live.current.onPick(spot);
    };
    const [drag] = Draggable.create(el, {
      type: 'x,y',
      bounds: root.current,
      inertia: !calm,
      // A short glide: where you let go matters most, a flick still carries it a bit further.
      throwResistance: 2500,
      maxDuration: 0.6,
      minDuration: 0.2,
      minimumMovement: 4,
      // Let go near a spot and it lands there; thrown into open space, the glide decides. Always on a spot.
      snap: {
        points: (point: { x: number; y: number }) => {
          const drop = offsetOf(nearest(drag.x, drag.y));
          const capture = root.current!.getBoundingClientRect().width * 0.12;
          return Math.hypot(drop.x - drag.x, drop.y - drag.y) < capture ? drop : offsetOf(nearest(point.x, point.y));
        },
      },
      onPress() {
        setTarget(live.current.current);
        gsap.to(el, { scale: 1.2, rotation: 8, duration: calm ? 0 : 0.2, ease: 'power2.out' });
        setLifted(true);
      },
      onDrag() { setTarget(nearest(this.x, this.y)); },
      onThrowUpdate() { setTarget(nearest(this.x, this.y)); },
      onRelease() {
        if (calm || !this.isThrowing) {
          const spot = nearest(this.x, this.y);
          gsap.set(el, offsetOf(spot));
          settle(spot);
        }
      },
      onThrowComplete() { settle(nearest(this.x, this.y)); },
      onClick() {
        gsap.to(el, { scale: 1, rotation: 0, duration: calm ? 0 : 0.2 });
        setLifted(false);
        live.current.setPlacing(true);
      },
    });
  }, { scope: root });

  // Once React has moved the sticker to its new spot, the drag offset goes back to zero (no jump).
  useLayoutEffect(() => { if (piece.current) gsap.set(piece.current, { x: 0, y: 0 }); }, [current]);

  const flyTo = contextSafe((spot: StickerSpot) => {
    setPlacing(false);
    if (spot === current) return;
    gsap.to(piece.current, { ...offsetOf(spot), duration: reducedMotion() ? 0 : 0.5, ease: 'back.out(1.6)', onComplete: () => onPick(spot) });
  });

  const box = stickerRadius(current) * 2.6;
  const at = points.find((p) => p.spot === current)!;
  const showSpots = placing || lifted;
  return (
    <div ref={root} className="absolute inset-0">
      {showSpots && points.map(({ spot, x, y }) => (
        <button key={spot} type="button" aria-label={`Sticker ${SPOT_LABELS[spot]} aufkleben`} aria-pressed={spot === current}
          onClick={() => flyTo(spot)} style={pct(x, y)} tabIndex={lifted ? -1 : 0}
          className={`absolute grid aspect-square h-[14%] min-h-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-2 p-0 transition duration-200 ${lifted ? 'pointer-events-none' : ''} ${(lifted ? spot === target : spot === current) ? 'scale-110 border-accent bg-accent/15' : 'border-dashed border-control bg-transparent hover:border-accent hover:bg-tint-strong'}`} />
      ))}
      <div ref={piece} role="button" tabIndex={0} aria-label={`Sticker ${SPOT_LABELS[current]} – zum Verschieben ziehen oder drücken`}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPlacing(true); } }}
        style={{ ...pct(at.x, at.y), width: `${(box / PROFILE_CARD_WIDTH) * 100}%` }}
        className={`absolute z-10 aspect-square cursor-grab touch-none select-none rounded-full outline-none transition-[filter] duration-200 focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing ${lifted ? 'drop-shadow-[0_14px_14px_rgba(0,0,0,.55)]' : ''}`}>
        <StickerCanvas sticker={sticker} />
      </div>
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
  const cosmetics = resolveCosmetics(value.equipped, items, value.stickerSpot);
  // A sticker that was just picked from the inventory gets placed right away: show the spots.
  const [placing, setPlacing] = useState(false);
  const lastSticker = useRef(value.equipped.sticker);
  useEffect(() => {
    if (value.equipped.sticker && value.equipped.sticker !== lastSticker.current) setPlacing(true);
    if (!value.equipped.sticker) setPlacing(false);
    lastSticker.current = value.equipped.sticker;
  }, [value.equipped.sticker]);

  return (
    <>
      <PageHeader kicker="Mein Profil" title={`Hey ${subject.name}!`}
        description="Gestalte deine Profilkarte. Sie gilt auf allen Servern mit Nexo – nur das Level kommt vom jeweiligen Server."
        actions={<Link to="/me/shop" className="btn btn-secondary hover:no-underline"><Glyph name="bag" size={16} /> Zum Shop</Link>} />

      {/* The card is the centrepiece: full width until there is room for a side column (xl). */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px] [&>*]:mt-0">
        <Card title="Deine Karte" description="So sieht deine Profilkarte gerade aus.">
          <div className="relative">
            <ProfileCardPreview subject={subject} cosmetics={cosmetics} className="w-full" hideSticker />
            {cosmetics.sticker && (
              <StickerPlacement sticker={cosmetics.sticker} layout={cosmetics.layout} placing={placing} setPlacing={setPlacing}
                onPick={(stickerSpot) => form.setDraft({ ...value, stickerSpot })} />
            )}
          </div>
          {cosmetics.sticker && (
            <p className="mt-3 text-[13px] text-mute">
              {placing ? 'Wohin damit? Tippe auf einen Kreis, um deinen Sticker dort aufzukleben.' : 'Zieh deinen Sticker auf der Karte an einen anderen Platz.'}
            </p>
          )}
          {me.levels.length > 1 && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-mute">
              Level von
              <div className="min-w-0 flex-1 sm:max-w-[280px]">
                <Select value={guildId ?? ''} onChange={setGuildId} options={me.levels.map((l) => ({ value: l.guildId, label: `Level ${l.level} · ${l.guildName}` }))} />
              </div>
            </div>
          )}
        </Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-start-2 xl:row-span-3 xl:row-start-1 xl:grid-cols-1 xl:content-start">
          <WalletCard />
          <DailyCard />
          <QuestsCard />
          <PetCareCard />
        </div>
        {/* On xl "Über dich" and the level-up preview stack under the card, next to the side column; equipment spans below. */}
        <div className="min-w-0 xl:col-span-2 xl:row-start-4">
          <Card title="Ausrüstung" description={`Wähle pro Bereich einen Artikel aus deinem Inventar – bei Abzeichen bis zu ${MAX_EQUIPPED_BADGES}.`}>
            <SlotEditor value={value} onChange={form.setDraft} />
          </Card>
        </div>
        <div className="grid-2 xl:contents [&>*]:mt-0 [&>*]:min-w-0">
          <div className="xl:col-start-1 xl:row-start-2">
            <Card title="Über dich" description="Kurzer Text auf deiner Karte.">
              <div className="stack">
                <TextArea value={value.bio} onChange={(bio) => form.setDraft({ ...value, bio })} maxLength={MAX_BIO_LENGTH} rows={3} placeholder="Was sollen andere über dich wissen?" />
                <SwitchRow title="Auf Willkommenskarten zeigen" description="Server, die Mitglieder-Styles erlauben, zeigen deinen Rahmen und deine Farben auf der Willkommenskarte."
                  checked={value.showOnWelcome} onChange={(showOnWelcome) => form.setDraft({ ...value, showOnWelcome })} />
                <ShareProfile />
              </div>
            </Card>
          </div>
          <div className="xl:col-start-1 xl:row-start-3">
            <Card title="Level-up-Nachricht" description="So meldet Nexo deinen nächsten Aufstieg.">
              <LevelUpPreview subject={subject} cosmetics={cosmetics} level={subject.level + 1} reward={levelUpReward(subject.level + 1)} />
            </Card>
          </div>
        </div>
      </div>

      <div className="mt-4"><LinkedRoleCard /></div>
      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onReset={form.reset} />
    </>
  );
}
