// Settings card: per-member recording on/off (turning it off deletes the recorded member rows).
import { useState } from 'react';
import { DETAIL_RETENTION_DAYS } from '../../../../src/web/dto/insightsDetail';
import type { InsightsSettings } from '../../../../src/web/dto/insightsDetail';
import { api, useToast } from '../../api';
import { useConfirm } from '../../components/ConfirmDialog';
import { Card, Notice, Spinner, Switch } from '../../components/ui';

export function TrackingCard({ path, settings }: {
  /** /guilds/:id/insights/settings */
  path: string;
  settings: { data: InsightsSettings | null; setData: (value: InsightsSettings) => void; error: string | null };
}) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [saving, setSaving] = useState(false);
  const { data } = settings;

  const save = async (memberTracking: boolean) => {
    if (!data) return;
    setSaving(true);
    try {
      const next = { ...data, memberTracking };
      await api<InsightsSettings>(path, { method: 'PUT', body: next });
      settings.setData(next);
      toast(memberTracking ? 'Aufzeichnung pro Mitglied ist an.' : 'Aufzeichnung pro Mitglied ist aus, die Daten wurden gelöscht.');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setSaving(false);
    }
  };
  const toggle = (on: boolean) => on ? void save(true) : confirm({
    title: 'Aufzeichnung pro Mitglied ausschalten?',
    text: 'Die gespeicherten Mitgliederdaten werden gelöscht.',
    confirmLabel: 'Ausschalten und löschen',
    onConfirm: () => save(false),
  });

  return (
    <>
      <Card title="Aufzeichnung pro Mitglied" description="Zahlen je Mitglied für Ranglisten, Mitgliederprofile und die Bindung neuer Mitglieder."
        right={data && <Switch checked={data.memberTracking} onChange={toggle} disabled={saving} label="Aufzeichnung pro Mitglied" />}>
        {!data ? (settings.error ? <Notice tone="danger">{settings.error}</Notice> : <Spinner />) : (
          <Notice>
            Nexo speichert nur Zahlen (Nachrichten, Sprachminuten), keine Inhalte.
            Detaildaten werden nach {data.retentionDays || DETAIL_RETENTION_DAYS} Tagen gelöscht.
          </Notice>
        )}
      </Card>
      {dialog}
    </>
  );
}
