// Shared goals of the running events: one bar per server the member is on, on the season page.
import type { CommunityResponse } from '../../../src/web/dto/profile';
import { useApi } from '../api';
import { num } from './api';
import { Bernis, Glyph } from './visuals';

export function CommunityGoals() {
  const { data } = useApi<CommunityResponse>('/me/community');
  const goals = data?.goals ?? [];
  if (!goals.length) return null;
  return (
    <section className="mb-6 mt-6">
      <h2 className="mb-1 text-[19px] font-semibold tracking-tight">Gemeinschaftsziel</h2>
      <p className="mb-3.5 text-[13.5px] text-mute">Schafft ihr auf eurem Server die Nachrichten bis zum Event-Ende, bekommt jeder, der mitgeschrieben hat, eine Belohnung.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {goals.map((goal) => {
          const reached = goal.progress >= goal.target;
          return (
            <article key={`${goal.eventId}-${goal.guildId}`} className="card !p-4">
              <div className="flex items-center gap-3">
                {goal.guildIconUrl
                  ? <img src={goal.guildIconUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl" />
                  : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[.06] text-[14px] font-semibold text-ink">{goal.guildName.slice(0, 1)}</span>}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-ink">{goal.guildName}</div>
                  <div className="text-[12px] text-faint">{goal.eventName}</div>
                </div>
                {reached && <span className="badge badge-on shrink-0">Geschafft</span>}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.06]">
                <div className={`h-full rounded-full ${reached ? 'bg-pos' : 'bg-accent'}`} style={{ width: `${Math.min(100, (goal.progress / goal.target) * 100)}%` }} />
              </div>
              <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-[12.5px] text-mute">
                <span><span className="tabular-nums text-ink">{num(goal.progress)}</span> von {num(goal.target)} Nachrichten</span>
                <span>Du: <span className="tabular-nums text-ink">{num(goal.mine)}</span></span>
              </div>
              <p className="mt-3 flex items-center gap-2 text-[12.5px] text-body">
                <Glyph name={goal.paid ? 'check' : 'heart'} size={15} />
                {goal.paid
                  ? <span>Belohnung bekommen: +<Bernis amount={goal.reward} nowrap /></span>
                  : goal.mine >= goal.minimum
                    ? <span>Du bist dabei: +<Bernis amount={goal.reward} nowrap />{reached ? ' – kommt in einer Minute' : ', sobald das Ziel steht'}</span>
                    : <span>Schreib noch {goal.minimum - goal.mine} {goal.minimum - goal.mine === 1 ? 'Nachricht' : 'Nachrichten'}, dann bist du dabei: +<Bernis amount={goal.reward} nowrap /></span>}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
