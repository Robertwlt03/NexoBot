// Profile of the selected member across all modules.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { MemberProfile } from '../../../../src/web/dto/insightsDetail';
import { Badge, Card } from '../../components/ui';
import { ago, DEFAULT_AVATAR, Facts, number, shortDate } from './shared';

const or = <T,>(value: T | null, show: (v: T) => string) => (value === null ? '–' : show(value));

export function MemberProfileCard({ profile, onSelect }: { profile: MemberProfile; onSelect: (userId: string) => void }) {
  const { leveling, economy, moderation, tickets, applications, birthday, invitedBy } = profile;
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4">
        <img src={profile.avatarUrl ?? DEFAULT_AVATAR} alt="" className="h-14 w-14 rounded-full" />
        <div className="min-w-[180px] flex-1">
          <h2 className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 break-words">{profile.name}</span>
            {profile.bot && <Badge>Bot</Badge>}
            {!profile.inGuild && <Badge on={false}>Nicht mehr auf dem Server</Badge>}
          </h2>
          <p className="faint mt-1">@{profile.username} · {profile.userId}</p>
        </div>
        <Link className="btn btn-secondary btn-sm max-sm:w-full" to={`../moderation?userId=${profile.userId}`}>In Moderation ansehen</Link>
      </div>

      {profile.roles.length > 0 && (
        <div className="chips mt-4">
          {profile.roles.map((role) => (
            <span className="chip pr-[11px]" key={role.id}>
              <span className="dot" style={{ background: role.color !== '#000000' ? role.color : '#99aab5' }} />
              {role.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
        <Facts items={[
          ['Beigetreten', profile.joinedAt ? `${shortDate(profile.joinedAt)} · ${ago(profile.joinedAt)}` : '–'],
          ['Konto erstellt', `${shortDate(profile.accountCreatedAt)} · ${ago(profile.accountCreatedAt)}`],
          // Shown once invite tracking exists; the bot does not record who invited whom yet.
          ...(invitedBy ? [['Eingeladen von', <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-accent-text [font:inherit] hover:underline" onClick={() => onSelect(invitedBy.userId)}>{invitedBy.name}</button>] as [string, ReactNode]] : []),
          ['Geburtstag', or(birthday, (b) => `${String(b.day).padStart(2, '0')}.${String(b.month).padStart(2, '0')}.`)],
        ]} />
        <Facts items={[
          ['Level', or(leveling, (l) => `${l.level} · ${number.format(l.xp)} XP`)],
          ['Rang', or(leveling?.rank ?? null, (rank) => `#${number.format(rank)}`)],
          ['Gesamt-XP', or(leveling, (l) => number.format(l.totalXp))],
          ['Geld (Bar / Bank)', or(economy, (e) => `${number.format(e.wallet)} / ${number.format(e.bank)}`)],
        ]} />
        <Facts items={[
          ['Moderationsfälle', number.format(moderation.cases)],
          ['Letzter Fall', or(moderation.lastCaseAt, shortDate)],
          ['Verwarnungen / Notizen', `${number.format(moderation.warnings)} / ${number.format(moderation.notes)}`],
          ['Tickets', or(tickets, (t) => `${number.format(t.open)} offen · ${number.format(t.total)} gesamt`)],
          ['Bewerbungen', or(applications, (a) => `${number.format(a.pending)} offen · ${number.format(a.total)} gesamt`)],
        ]} />
      </div>
    </Card>
  );
}
