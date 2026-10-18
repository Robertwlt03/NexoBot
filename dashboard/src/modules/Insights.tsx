// Statistiken: one filter row (range + member) scoping four tabs, an optional member profile and the tracking setting.
import { useRef } from 'react';
import { useSearchParams } from 'react-router';
import type { InsightsResponse } from '../../../src/web/dto/insights';
import type { ActivityResponse, InsightsSettings, MemberProfile, MembersResponse, ModerationInsights } from '../../../src/web/dto/insightsDetail';
import { useApi, useGuild } from '../api';
import { Notice, PageHeader, Spinner, Tabs } from '../components/ui';
import { Activity } from './insights/Activity';
import { MemberPicker } from './insights/MemberPicker';
import { MemberProfileCard } from './insights/MemberProfileCard';
import { Members } from './insights/Members';
import { Moderation } from './insights/Moderation';
import { Overview } from './insights/Overview';
import { Loaded, RANGES, SECTIONS, STACK } from './insights/shared';
import type { RangeId, Section } from './insights/shared';
import { TrackingCard } from './insights/TrackingCard';
import { isUserId } from './rankingKit';

export default function Insights() {
  const { guild } = useGuild();
  const [params, setParams] = useSearchParams();
  const filterRow = useRef<HTMLDivElement>(null);
  const range = RANGES.find((r) => r.id === params.get('range'))?.id ?? '30';
  const section = SECTIONS.find((s) => s.id === params.get('tab'))?.id ?? 'overview';
  const memberParam = params.get('member') ?? '';
  const member = isUserId(memberParam) ? memberParam : null;
  const update = (patch: { range?: RangeId; tab?: Section; member?: string | null }) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    return next;
  }, { replace: true });
  const select = (userId: string | null) => {
    update({ member: userId });
    if (userId) filterRow.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const base = `/guilds/${guild.id}/insights`;
  const settings = useApi<InsightsSettings>(`${base}/settings`);
  const profileState = useApi<MemberProfile>(member ? `${base}/members/${member}?range=${range}` : null);
  const profile = member && profileState.data?.userId === member ? profileState.data : null;
  const needsOverview = section === 'overview' || section === 'moderation';
  const overview = useApi<InsightsResponse>(needsOverview ? `${base}?range=${range}` : null);
  const activity = useApi<ActivityResponse>(section === 'activity' && !member ? `${base}/activity?range=${range}` : null);
  const members = useApi<MembersResponse>(section === 'members' ? `${base}/members?range=${range}` : null);
  const moderation = useApi<ModerationInsights>(section === 'moderation' ? `${base}/moderation?range=${range}` : null);
  const tracking = settings.data?.memberTracking;

  return (
    <>
      <PageHeader icon="stats" title="Statistiken" description="Wachstum, Aktivität und Zahlen aus allen Modulen – für den ganzen Server oder ein Mitglied." />
      <div className={STACK}>
        <div ref={filterRow} className="flex scroll-mt-4 flex-wrap items-center gap-3 [&>.tabs]:mb-0">
          <Tabs value={range} onChange={(id) => update({ range: id })} items={RANGES} />
          <div className="min-w-[220px] max-w-sm flex-1">
            <MemberPicker base={base} onSelect={select}
              selected={member ? profile ?? { userId: member, name: profileState.error ? member : 'Lädt …', avatarUrl: null } : null} />
          </div>
        </div>

        {member && (profileState.error && !profile
          ? <Notice tone="danger">{profileState.error}</Notice>
          : profile ? <div className={profileState.loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}><MemberProfileCard profile={profile} onSelect={select} /></div> : <Spinner />)}

        <Tabs value={section} onChange={(id) => update({ tab: id })} items={SECTIONS} />

        {member && section !== 'activity' && (
          <Notice>Diese Ansicht zeigt den ganzen Server – der Mitgliederfilter wirkt nur unter „Aktivität“.</Notice>
        )}

        {section === 'overview' && <Loaded state={overview}>{(data) => <Overview data={data} />}</Loaded>}
        {section === 'activity' && (member
          ? (profile
            ? <Loaded state={profileState}>{(data) => <Activity data={data.activity} tracking={tracking ?? data.activity.memberTracking} memberName={data.name} onSelect={select} />}</Loaded>
            : !profileState.error && <Spinner />)
          : <Loaded state={activity}>{(data) => <Activity data={data} tracking={tracking ?? data.memberTracking} memberName={null} onSelect={select} />}</Loaded>)}
        {section === 'members' && <Loaded state={members}>{(data) => <Members data={data} tracking={tracking ?? true} onSelect={select} />}</Loaded>}
        {section === 'moderation' && (
          <Loaded state={overview}>{(data) => <Loaded state={moderation}>{(mod) => <Moderation overview={data} data={mod} onSelect={select} />}</Loaded>}</Loaded>
        )}

        <TrackingCard path={`${base}/settings`} settings={settings} />
      </div>
    </>
  );
}
