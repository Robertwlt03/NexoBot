import { useState } from 'react';
import type { WalletSummary } from '../../../src/web/dto/profile';
import { useUser } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { Actions, Card, Field, Notice, NumberInput, PageHeader, TextInput } from '../components/ui';
import { num, useMutation, useWalletUpdate } from '../me/api';
import { Bernis } from '../me/visuals';

const SNOWFLAKE = /^\d{17,20}$/;

export default function GrantPage() {
  const user = useUser();
  const updateWallet = useWalletUpdate();
  const { run, busy } = useMutation();
  const { confirm, dialog } = useConfirm();
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState(100);
  const [note, setNote] = useState('');
  const [last, setLast] = useState<{ userId: string; amount: number; wallet: WalletSummary } | null>(null);
  const valid = SNOWFLAKE.test(userId) && Number.isInteger(amount) && amount !== 0 && note.trim() !== '';

  const grant = () => confirm({
    title: amount > 0 ? 'Bernis gutschreiben' : 'Bernis abziehen',
    text: <>{amount > 0 ? 'Gutschrift' : 'Abzug'} von <Bernis amount={Math.abs(amount)} /> für <code>{userId}</code> („{note.trim()}“). Wird als Owner-Buchung protokolliert.</>,
    confirmLabel: amount > 0 ? 'Gutschreiben' : 'Abziehen', danger: amount < 0,
    onConfirm: async () => {
      const wallet = await run<WalletSummary>('/owner/grant', 'POST', { userId, amount, note: note.trim() }, 'Gebucht.');
      if (!wallet) return;
      setLast({ userId, amount, wallet });
      if (userId === user?.id) updateWallet(wallet);
    },
  });

  return (
    <>
      <PageHeader kicker="Owner" title="Bernis vergeben" description="Für Tests und Support: Bernis gutschreiben oder (mit negativem Betrag) abziehen." />
      <Card title="Buchung">
        <div className="stack">
          <div className="grid-2">
            <Field label="Discord-Nutzer-ID" error={userId && !SNOWFLAKE.test(userId) ? 'Eine Nutzer-ID hat 17–20 Ziffern.' : null}
              hint={user && <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[12.5px] text-accent" onClick={() => setUserId(user.id)}>Meine ID einsetzen</button>}>
              <TextInput value={userId} onChange={(v) => setUserId(v.trim())} placeholder="401234567890123456" maxLength={20} />
            </Field>
            <Field label="Betrag" hint="Negativ zum Abziehen."><NumberInput value={amount} onChange={setAmount} step={50} /></Field>
          </div>
          <Field label="Notiz" hint="Pflicht – steht im Verlauf der Person."><TextInput value={note} onChange={setNote} maxLength={100} placeholder="Ausgleich für Bug im Shop" /></Field>
        </div>
        <Actions><button type="button" className="btn btn-primary" disabled={!valid || busy} onClick={grant}>{amount < 0 ? 'Abziehen' : 'Gutschreiben'}</button></Actions>
      </Card>
      {last && <Notice>Gebucht: {last.amount > 0 ? '+' : '−'}{num(Math.abs(last.amount))} für <code>{last.userId}</code>. Neuer Kontostand: <Bernis amount={last.wallet.balance} />.</Notice>}
      {dialog}
    </>
  );
}
