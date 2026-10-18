import type { ReactNode } from 'react';
import type { AutomodFeatureId, AutomodFeatures, AutomodSettingsDto } from '../../../src/web/dto/automod';
import {
  AUTOMOD_MAX_ALLOW, AUTOMOD_MAX_EXEMPT_ROLES, AUTOMOD_MAX_TIMEOUT, AUTOMOD_MAX_WORDS,
} from '../../../src/web/dto/automod';
import { useSettings } from '../api';
import {
  Badge, Card, ChannelSelect, Empty, Field, MultiChannelSelect, MultiRoleSelect, Notice, NumberInput, PageHeader,
  SettingsPage, Switch, TagInput,
} from '../components/ui';
import type { IconName } from '../icons';

const FEATURE_INFO: Record<AutomodFeatureId, { title: string; description: string; icon: IconName }> = {
  spam: { title: 'Spam-Filter', description: 'Blockt Nachrichten, die Discord als Spam erkennt.', icon: 'shield' },
  links: { title: 'Link-Filter', description: 'Blockt Links. GIFs und Discord-Links bleiben erlaubt.', icon: 'external' },
  invites: { title: 'Einladungs-Filter', description: 'Blockt Einladungen zu anderen Discord-Servern.', icon: 'send' },
  badwords: { title: 'Schimpfwort-Filter', description: 'Discords Listen (Englisch) plus deine eigene Wortliste.', icon: 'x' },
  mentions: { title: 'Massen-Erwähnungen', description: 'Blockt Nachrichten mit zu vielen Erwähnungen.', icon: 'users' },
};

function FeatureCard<K extends AutomodFeatureId>({ id, value, onChange, children }: {
  id: K; value: AutomodFeatures[K]; onChange: (value: AutomodFeatures[K]) => void; children?: ReactNode;
}) {
  const info = FEATURE_INFO[id];
  return (
    <Card icon={info.icon} title={info.title} description={info.description} disabled={!value.enabled}
      right={(
        <div className="row">
          <Badge on={value.enabled}>{value.enabled ? 'Aktiv' : 'Aus'}</Badge>
          <Switch checked={value.enabled} label={info.title} onChange={(enabled) => onChange({ ...value, enabled })} />
        </div>
      )}>
      {children}
    </Card>
  );
}

function TimeoutField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <Field label="Timeout (Minuten)" hint="Zusätzlich zum Blockieren. 0 = kein Timeout, höchstens 28 Tage.">
      <NumberInput value={value} min={0} max={AUTOMOD_MAX_TIMEOUT} onChange={onChange} />
    </Field>
  );
}

export default function AutomodPage() {
  const settings = useSettings<AutomodSettingsDto>('automod');
  return (
    <>
      <PageHeader icon="shield" title="AutoMod" description="Spam, Links, Einladungen, Schimpfwörter und Erwähnungen filtern" />
      <SettingsPage settings={settings}>
        {(value) => {
          const setFeature = <K extends AutomodFeatureId>(id: K) => (next: AutomodFeatures[K]) =>
            settings.set({ features: { ...value.features, [id]: next } });
          const { features } = value;
          return (
            <>
              <div className="stack mb-4">
                {!value.canManage && (
                  <Notice tone="danger">Nexo braucht die Berechtigung „Server verwalten“, um AutoMod-Regeln zu lesen und anzulegen.</Notice>
                )}
                <Notice>Nexo legt die Regeln in Discords eigenem AutoMod an. Discord blockiert passende Nachrichten selbst, auch wenn Nexo offline ist.</Notice>
              </div>

              <FeatureCard id="spam" value={features.spam} onChange={setFeature('spam')} />

              <FeatureCard id="links" value={features.links} onChange={setFeature('links')}>
                <div className="grid-2">
                  <Field label="Erlaubte Domains" hint={`z. B. youtube.com oder twitch.tv. Höchstens ${AUTOMOD_MAX_ALLOW}.`}>
                    <TagInput value={features.links.allow} max={AUTOMOD_MAX_ALLOW} placeholder="Domain eingeben und Enter drücken"
                      onChange={(allow) => setFeature('links')({ ...features.links, allow })} />
                  </Field>
                  <TimeoutField value={features.links.timeoutMinutes} onChange={(timeoutMinutes) => setFeature('links')({ ...features.links, timeoutMinutes })} />
                </div>
              </FeatureCard>

              <FeatureCard id="invites" value={features.invites} onChange={setFeature('invites')}>
                <div className="grid-2">
                  <TimeoutField value={features.invites.timeoutMinutes} onChange={(timeoutMinutes) => setFeature('invites')({ ...features.invites, timeoutMinutes })} />
                </div>
              </FeatureCard>

              <FeatureCard id="badwords" value={features.badwords} onChange={setFeature('badwords')}>
                <div className="grid-2">
                  <Field label="Eigene Wortliste" hint="Ganze Wörter, Groß-/Kleinschreibung egal. Mit * am Anfang oder Ende auch Wortteile.">
                    <TagInput value={features.badwords.words} max={AUTOMOD_MAX_WORDS} placeholder="Wort eingeben und Enter drücken"
                      onChange={(words) => setFeature('badwords')({ ...features.badwords, words })} />
                  </Field>
                  <TimeoutField value={features.badwords.timeoutMinutes} onChange={(timeoutMinutes) => setFeature('badwords')({ ...features.badwords, timeoutMinutes })} />
                </div>
              </FeatureCard>

              <FeatureCard id="mentions" value={features.mentions} onChange={setFeature('mentions')}>
                <div className="grid-2">
                  <Field label="Maximale Erwähnungen pro Nachricht" hint="1 bis 50. Standard: 5.">
                    <NumberInput value={features.mentions.limit} min={1} max={50} onChange={(limit) => setFeature('mentions')({ ...features.mentions, limit })} />
                  </Field>
                  <TimeoutField value={features.mentions.timeoutMinutes} onChange={(timeoutMinutes) => setFeature('mentions')({ ...features.mentions, timeoutMinutes })} />
                </div>
              </FeatureCard>

              <Card icon="settings" title="Meldekanal und Ausnahmen" description="Gilt für alle AutoMod-Regeln von Nexo.">
                <div className="grid-2">
                  <Field label="Meldekanal" hint="Hier meldet Discord blockierte Nachrichten.">
                    <ChannelSelect value={value.alertChannelId} placeholder="Keine Meldungen" onChange={(alertChannelId) => settings.set({ alertChannelId })} />
                  </Field>
                  <div />
                  <Field label="Ausgenommene Rollen" hint={`Werden nicht gefiltert. Höchstens ${AUTOMOD_MAX_EXEMPT_ROLES}.`}>
                    <MultiRoleSelect value={value.exemptRoleIds} max={AUTOMOD_MAX_EXEMPT_ROLES} onChange={(exemptRoleIds) => settings.set({ exemptRoleIds })} />
                  </Field>
                  <Field label="Ausgenommene Kanäle" hint="Nachrichten hier werden nicht gefiltert.">
                    <MultiChannelSelect value={value.exemptChannelIds} onChange={(exemptChannelIds) => settings.set({ exemptChannelIds })} />
                  </Field>
                </div>
              </Card>

              <Card icon="check" title="Regeln in Discord" description="So stehen Nexos Regeln gerade in den Servereinstellungen unter „AutoMod“.">
                {value.rules.length === 0 ? (
                  <Empty title="Noch keine Regeln">Schalte oben einen Filter ein und speichere.</Empty>
                ) : (
                  <div className="list">
                    {value.rules.map((rule) => (
                      <div className="list-item" key={rule.id}>
                        <div className="grow"><div className="title">{rule.name}</div></div>
                        {rule.timeoutMinutes > 0 && <span className="faint">Timeout {rule.timeoutMinutes} Min.</span>}
                        <Badge on={rule.enabled}>{rule.enabled ? 'Aktiv' : 'Pausiert'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          );
        }}
      </SettingsPage>
    </>
  );
}
