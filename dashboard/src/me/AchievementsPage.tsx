import type { CSSProperties } from 'react';
import type { AchievementsResponse } from '../../../src/web/dto/profile';
import { useApi } from '../api';
import { Card, Empty, Notice, PageHeader, Spinner, Stats } from '../components/ui';
import { formatDate, num, useMe } from './api';
import { GLYPHS, Glyph, Bernis } from './visuals';

export default function AchievementsPage() {
  const { items } = useMe();
  const { data, error, loading, reload } = useApi<AchievementsResponse>('/me/achievements');
  const list = data?.achievements ?? [];
  const unlocked = list.filter((a) => a.unlockedAt);
  // Unlocked first, then by progress.
  const sorted = [...list].sort((a, b) => Number(Boolean(b.unlockedAt)) - Number(Boolean(a.unlockedAt))
    || (b.progress ? b.progress.current / b.progress.target : 0) - (a.progress ? a.progress.current / a.progress.target : 0));

  return (
    <>
      <PageHeader kicker="Mein Profil" title="Erfolge" description="Kleine Ziele mit Belohnung: Bernis, ein Abzeichen und ein Titel, die es nirgends zu kaufen gibt." />
      {loading && !data && <Spinner />}
      {error && <Notice tone="danger" onRetry={reload}>{error}</Notice>}
      {data && (
        <Stats items={[
          { label: 'Freigeschaltet', value: `${unlocked.length} / ${list.length}` },
          { label: 'Damit verdient', value: <Bernis amount={unlocked.reduce((sum, a) => sum + a.reward, 0)} /> },
          { label: 'Noch offen', value: <Bernis amount={list.filter((a) => !a.unlockedAt).reduce((sum, a) => sum + a.reward, 0)} /> },
        ]} />
      )}
      {data && list.length === 0 && <Card><Empty title="Noch keine Erfolge" /></Card>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((a) => {
          const item = a.itemId ? items.get(a.itemId) : undefined;
          const title = a.titleId ? items.get(a.titleId) : undefined;
          const badge = item?.slot === 'badge' ? item.data : null;
          const pct = a.progress ? Math.min(100, (a.progress.current / Math.max(a.progress.target, 1)) * 100) : a.unlockedAt ? 100 : 0;
          return (
            <article key={a.id} className={`flex flex-col rounded-2xl border p-4 ${a.unlockedAt ? 'border-white/[.1] bg-surface' : 'border-white/[.05] bg-white/[.015]'}`}>
              <div className="flex items-start gap-3">
                {/* The achievement's own badge symbol, in its colour once unlocked (mixed with the text colour for contrast). */}
                <span className={`icon-tile ${a.unlockedAt ? '' : '!text-faint'}`}
                  style={a.unlockedAt && badge ? { color: `color-mix(in srgb, ${badge.color} 70%, var(--text-strong))`, background: `color-mix(in srgb, ${badge.color} 12%, transparent)` } : undefined}>
                  <Glyph name={badge && badge.glyph in GLYPHS ? badge.glyph : 'medal'} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className={`text-[14.5px] font-medium ${a.unlockedAt ? '' : 'text-body'}`}>{a.name}</h3>
                  <p className="mt-0.5 text-[12.5px] text-mute">{a.description}</p>
                </div>
              </div>
              <div className="mt-4">
                {a.progress && !a.unlockedAt && (
                  <>
                    <div className="flex justify-between text-[12px] text-mute"><span>Fortschritt</span><span className="tabular-nums">{num(a.progress.current)} / {num(a.progress.target)}</span></div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-white/50" style={{ width: `${pct}%` }} /></div>
                  </>
                )}
                {a.unlockedAt && <span className="badge badge-on">Freigeschaltet am {formatDate(a.unlockedAt)}</span>}
              </div>
              <div className="mt-auto flex items-center gap-3 border-t border-white/[.05] pt-3 text-[13px]">
                <Bernis amount={a.reward} className="text-ink" />
                {(a.itemId || title) && (
                  <span className="ml-auto flex min-w-0 items-center gap-2 text-right text-[12.5px] text-mute">
                    <span className="min-w-0">
                      {a.itemId && <span className="block truncate">+ {item ? `Abzeichen „${item.name}“` : 'Abzeichen'}</span>}
                      {title?.slot === 'title' && <span className="block truncate">+ Titel <span className="title-tint" style={{ '--tint': title.data.color } as CSSProperties}>„{title.data.text}“</span></span>}
                    </span>
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
