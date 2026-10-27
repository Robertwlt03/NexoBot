import type { CSSProperties } from 'react';
import type { Achievement, AchievementsResponse } from '../../../src/web/dto/profile';
import { useApi } from '../api';
import { Badge, Card, Empty, Meter, Notice, PageHeader, Spinner, Stats } from '../components/ui';
import { formatDate, num, useMe } from './api';
import { SectionHead } from './shop';
import { BadgeEmblem, Glyph, Bernis } from './visuals';

// Unlocked first, then by progress.
const byProgress = (a: Achievement, b: Achievement) => Number(Boolean(b.unlockedAt)) - Number(Boolean(a.unlockedAt))
  || (b.progress ? b.progress.current / b.progress.target : 0) - (a.progress ? a.progress.current / a.progress.target : 0);

const MYSTERY = { glyph: 'star', color: '#5B5F6B' } as const;

export default function AchievementsPage() {
  const { data, error, loading, reload } = useApi<AchievementsResponse>('/me/achievements');
  const list = data?.achievements ?? [];
  const unlocked = list.filter((a) => a.unlockedAt);
  const open = list.filter((a) => !a.hidden).sort(byProgress);
  const hidden = list.filter((a) => a.hidden).sort(byProgress);
  const found = hidden.filter((a) => a.unlockedAt).length;

  return (
    <>
      <PageHeader kicker="Mein Profil" title="Erfolge" description="Kleine Ziele mit Belohnung: Bernis, ein Abzeichen und ein Titel, die es nirgends zu kaufen gibt." />
      {loading && !data && <Spinner />}
      {error && <Notice tone="danger" onRetry={reload}>{error}</Notice>}
      {data && (
        <Stats items={[
          { label: 'Freigeschaltet', value: `${unlocked.length} / ${list.length}` },
          { label: 'Versteckte entdeckt', value: `${found} / ${hidden.length}` },
          { label: 'Damit verdient', value: <Bernis amount={unlocked.reduce((sum, a) => sum + a.reward, 0)} /> },
          { label: 'Noch offen', value: <Bernis amount={list.filter((a) => !a.unlockedAt).reduce((sum, a) => sum + a.reward, 0)} /> },
        ]} />
      )}
      {data && list.length === 0 && <Card><Empty title="Noch keine Erfolge" /></Card>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {open.map((a) => <AchievementCard key={a.id} a={a} />)}
      </div>
      {hidden.length > 0 && (
        <section className="mt-10">
          <SectionHead
            title={`Versteckte Erfolge · ${found} von ${hidden.length} entdeckt`}
            text={found === hidden.length ? 'Alle gefunden. Respekt!' : `Noch ${hidden.length - found} geheim: Wofür es sie gibt, erfährst du erst beim Freischalten. Die Belohnung siehst du schon jetzt.`}
          />
          <Meter value={found} max={hidden.length} done={found === hidden.length} label="Versteckte Erfolge entdeckt" className="mb-4" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hidden.map((a) => (a.unlockedAt ? <AchievementCard key={a.id} a={a} /> : <MysteryCard key={a.id} a={a} />))}
          </div>
        </section>
      )}
    </>
  );
}

function AchievementCard({ a }: { a: Achievement }) {
  const { items } = useMe();
  const item = a.itemId ? items.get(a.itemId) : undefined;
  const title = a.titleId ? items.get(a.titleId) : undefined;
  const badge = item?.slot === 'badge' ? { ...item.data, rarity: item.rarity } : null;
  return (
    <article className={`flex flex-col rounded-2xl border p-4 ${a.unlockedAt ? 'border-line-strong bg-surface' : 'border-line bg-tint'}`}>
      <div className="flex items-start gap-3">
        {/* The achievement's own badge as the emblem on the card, grey until unlocked. */}
        {badge ? <BadgeEmblem badge={badge} size={40} locked={!a.unlockedAt} /> : <span className="icon-tile !text-faint"><Glyph name="medal" size={18} /></span>}
        <div className="min-w-0 flex-1">
          <h3 className={`text-[14.5px] font-medium ${a.unlockedAt ? '' : 'text-body'}`}>{a.name}</h3>
          <p className="mt-0.5 text-[12.5px] text-mute">{a.description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {a.progress && !a.unlockedAt && (
          <div className="w-full">
            <div className="flex justify-between text-[12px] text-mute"><span>Fortschritt</span><span className="tabular-nums">{num(a.progress.current)} / {num(a.progress.target)}</span></div>
            <Meter value={a.progress.current} max={a.progress.target} label={`Fortschritt ${a.name}`} className="mt-1.5" />
          </div>
        )}
        {a.unlockedAt && <Badge tone="pos">Freigeschaltet am {formatDate(a.unlockedAt)}</Badge>}
        {a.hidden && <Badge>Versteckt</Badge>}
      </div>
      <div className="mt-auto flex items-center gap-3 border-t border-line pt-3 text-[13px]">
        <Bernis amount={a.reward} className="text-ink" />
        {(a.itemId || title) && (
          <span className="ml-auto flex min-w-0 items-center gap-2 text-right text-[12.5px] text-mute">
            <span className="min-w-0">
              {a.itemId && <span className="block break-words">+ {item ? `Abzeichen „${item.name}“` : 'Abzeichen'}</span>}
              {title?.slot === 'title' && <span className="block break-words">+ Titel <span className="title-tint" style={{ '--tint': title.data.color } as CSSProperties}>„{title.data.text}“</span></span>}
            </span>
          </span>
        )}
      </div>
    </article>
  );
}

/** A secret achievement not yet unlocked: only that it exists and what it pays. */
function MysteryCard({ a }: { a: Achievement }) {
  return (
    <article className="flex flex-col rounded-2xl border border-dashed border-line-strong bg-tint p-4">
      <div className="flex items-start gap-3">
        <BadgeEmblem badge={MYSTERY} size={40} mark="?" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-medium text-body">{a.name}</h3>
          <p className="mt-0.5 text-[12.5px] text-mute">Die Bedingung erfährst du, sobald du ihn freischaltest.</p>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-3 border-t border-line pt-3 text-[13px]">
        <Bernis amount={a.reward} className="text-ink" />
        <span className="ml-auto text-[12.5px] text-mute">+ geheimes Abzeichen und Titel</span>
      </div>
    </article>
  );
}
