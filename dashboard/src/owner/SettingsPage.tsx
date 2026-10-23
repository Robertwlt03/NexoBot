import { useCallback } from 'react';
import type { ReactNode } from 'react';
import type { EconomyConfig } from '../../../src/web/dto/profile';
import { api, useApi } from '../api';
import { Card, Field, Notice, NumberInput, PageHeader, SaveBar, Spinner } from '../components/ui';
import { num, useDraft } from '../me/api';
import { Bernis } from '../me/visuals';

/** `coins`: the value is an amount in bronze; the hint shows it as coins while typing. */
function NumberField({ label, hint, value, onChange, min = 0, max, step, coins = false }: {
  label: string; hint?: ReactNode; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; coins?: boolean;
}) {
  const shown = coins ? <>In Bronze, entspricht <Bernis amount={value} nowrap />{hint ? <>. {hint}</> : null}</> : hint;
  return <Field label={label} hint={shown}><NumberInput value={value} onChange={onChange} min={min} max={max} step={step} /></Field>;
}

/** Level-up reward with the draft values (same formula as levelUpReward in shared/cosmetics.ts). */
const reward = (c: EconomyConfig, level: number) => {
  const base = Math.round(c.levelUpBase + level * c.levelUpPerLevel);
  return level % 10 === 0 ? Math.round(base * c.milestoneMultiplier) : base;
};

export default function OwnerSettingsPage() {
  const { data, setData, error, loading } = useApi<EconomyConfig>('/owner/config');
  const persist = useCallback(async (draft: EconomyConfig) => { setData(await api<EconomyConfig>('/owner/config', { method: 'PUT', body: draft })); }, [setData]);
  const form = useDraft(data, persist);
  const c = form.draft;
  if (loading && !c) return <Spinner />;
  if (!c) return <Notice tone="danger">{error ?? 'Keine Daten.'}</Notice>;
  const set = (patch: Partial<EconomyConfig>) => form.setDraft({ ...c, ...patch });

  return (
    <>
      <PageHeader kicker="Owner" title="Einstellungen" description="Wie viele Bernis Nexo wofür verteilt. Änderungen gelten sofort für alle Server." />
      <Card title="Level-ups & Minispiele" description="Diese Einnahmen zählen zusammen gegen das Tageslimit.">
        <div className="grid-2">
          <NumberField coins label="Tageslimit" value={c.dailyEarnCap} onChange={(dailyEarnCap) => set({ dailyEarnCap })} />
          <NumberField label="Meilenstein-Faktor (alle 10 Level)" value={c.milestoneMultiplier} onChange={(milestoneMultiplier) => set({ milestoneMultiplier })} min={1} step={0.1} />
          <NumberField coins label="Level-up: Grundbetrag" value={c.levelUpBase} onChange={(levelUpBase) => set({ levelUpBase })} />
          <NumberField coins label="Level-up: pro Level" value={c.levelUpPerLevel} onChange={(levelUpPerLevel) => set({ levelUpPerLevel })} />
          <NumberField coins label="Minispiel: mindestens" value={c.minigameReward.min} onChange={(min) => set({ minigameReward: { ...c.minigameReward, min } })} />
          <NumberField coins label="Minispiel: höchstens" value={c.minigameReward.max} onChange={(max) => set({ minigameReward: { ...c.minigameReward, max } })} />
        </div>
        <p className="faint mt-4">Beispiel: Level 5 bringt <Bernis amount={reward(c, 5)} nowrap />, Level 10 <Bernis amount={reward(c, 10)} nowrap />, Level 25 <Bernis amount={reward(c, 25)} nowrap />.</p>
      </Card>
      <Card title="Tagesbonus">
        <div className="grid-2">
          <NumberField coins label="Grundbetrag" value={c.dailyBonus.base} onChange={(base) => set({ dailyBonus: { ...c.dailyBonus, base } })} />
          <NumberField coins label="Plus pro Tag in Folge" value={c.dailyBonus.perStreakDay} onChange={(perStreakDay) => set({ dailyBonus: { ...c.dailyBonus, perStreakDay } })} />
          <NumberField coins label="Serienbonus höchstens" value={c.dailyBonus.maxStreakBonus} onChange={(maxStreakBonus) => set({ dailyBonus: { ...c.dailyBonus, maxStreakBonus } })} />
        </div>
        <p className="faint mt-4">Höchstens <Bernis amount={c.dailyBonus.base + c.dailyBonus.maxStreakBonus} nowrap /> pro Tag, nach {c.dailyBonus.perStreakDay ? Math.ceil(c.dailyBonus.maxStreakBonus / c.dailyBonus.perStreakDay) : 0} Tagen in Folge.</p>
      </Card>
      <Card title="Monatsranglisten" description="Belohnung pro Server und Rangliste für die Plätze 1–5.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {c.monthlyRewards.map((amount, i) => (
            <NumberField key={i} coins label={`Platz ${i + 1}`} value={amount} onChange={(value) => set({ monthlyRewards: c.monthlyRewards.map((v, j) => (j === i ? value : v)) })} />
          ))}
        </div>
        <div className="grid-2 mt-4">
          <NumberField label="Mindestens Menschen auf dem Server" value={c.monthlyMinHumans} onChange={(monthlyMinHumans) => set({ monthlyMinHumans })} min={1} />
          <NumberField label="Höchstens Server pro Person" value={c.monthlyMaxServers} onChange={(monthlyMaxServers) => set({ monthlyMaxServers })} min={1} />
        </div>
        <p className="faint mt-4">Pro Monat höchstens <Bernis amount={(c.monthlyRewards[0] ?? 0) * 2 * c.monthlyMaxServers} nowrap /> pro Person (Platz 1 in beiden Ranglisten auf {num(c.monthlyMaxServers)} Servern).</p>
      </Card>
      <Card title="Black Market">
        <NumberField label="Artikel pro Woche" value={c.blackMarketSize} onChange={(blackMarketSize) => set({ blackMarketSize })} min={1} max={12} />
      </Card>
      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onReset={form.reset} />
    </>
  );
}
