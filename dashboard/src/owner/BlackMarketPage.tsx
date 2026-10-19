import { useState } from 'react';
import { SLOT_LABELS } from '../../../src/shared/cosmetics';
import type { CosmeticItem } from '../../../src/shared/cosmetics';
import type { BlackMarketResponse, OwnerOverview } from '../../../src/web/dto/profile';
import { useApi } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { Actions, Card, Empty, Notice, PageHeader, Spinner } from '../components/ui';
import { Icon } from '../icons';
import { countdown, formatDate, useMe, useMutation, useNow } from '../me/api';
import { Glyph, ItemVisual, Kristalle, RARITY_CLASS, RarityLabel } from '../me/visuals';

function Tile({ item, selected, onClick }: { item: CosmeticItem; selected?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} aria-pressed={onClick ? selected : undefined} data-mode="dark"
      className={`relative flex flex-col rounded-2xl border bg-[#0c0c10] p-2.5 text-left font-[inherit] text-body ${onClick ? 'cursor-pointer' : ''} ${selected ? 'border-accent ring-2 ring-accent/30' : RARITY_CLASS[item.rarity].border}`}>
      <ItemVisual item={item} />
      <div className="px-1 pt-2.5">
        <h3 className="truncate text-[14px] font-medium">{item.name}</h3>
        <div className="mt-0.5 text-[12px] text-faint">{SLOT_LABELS[item.slot]} · <RarityLabel rarity={item.rarity} /></div>
        <div className="mt-1.5 text-[13px]"><Kristalle amount={item.price} /></div>
      </div>
      {selected && <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-ink"><Glyph name="check" size={14} /></span>}
    </Tag>
  );
}

export default function OwnerBlackMarketPage() {
  const overview = useApi<OwnerOverview>('/owner/overview');
  const items = useApi<CosmeticItem[]>('/owner/items');
  const { reloadShop } = useMe();
  const { run, busy } = useMutation();
  const { confirm, dialog } = useConfirm();
  const now = useNow();
  const [picking, setPicking] = useState<string[] | null>(null);

  if ((overview.loading && !overview.data) || (items.loading && !items.data)) return <Spinner />;
  if (!overview.data || !items.data) return <Notice tone="danger">{overview.error ?? items.error ?? 'Keine Daten.'}</Notice>;
  const market = overview.data.blackMarket;
  const size = overview.data.config.blackMarketSize;
  const pool = items.data.filter((item) => item.active && item.availability === 'blackmarket');

  const apply = (result: BlackMarketResponse | null) => {
    if (!result) return;
    overview.setData((prev) => (prev ? { ...prev, blackMarket: result } : prev));
    reloadShop();
    setPicking(null);
  };
  const reroll = () => confirm({
    title: 'Rotation neu würfeln', text: 'Die aktuelle Auswahl wird sofort ersetzt – auch für alle, die gerade im Black Market stöbern.', confirmLabel: 'Neu würfeln',
    onConfirm: async () => apply(await run<BlackMarketResponse>('/owner/blackmarket/reroll', 'POST', {}, 'Neue Rotation gewürfelt.')),
  });
  const pin = async () => picking && apply(await run<BlackMarketResponse>('/owner/blackmarket', 'PUT', { itemIds: picking }, 'Rotation festgelegt.'));
  const toggle = (id: string) => setPicking((prev) => prev && (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < size ? [...prev, id] : prev));

  return (
    <>
      <PageHeader kicker="Owner" title="Black Market" description={`Wöchentliche Rotation aus ${pool.length} Black-Market-Artikeln. Neue Ware jeden Montag um 00:00 Uhr.`}
        actions={!picking && (
          <>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={reroll}><Icon name="refresh" size={16} /> Neu würfeln</button>
            <button type="button" className="btn btn-primary" onClick={() => setPicking(market.listings.map((l) => l.item.id))}>Rotation festlegen</button>
          </>
        )} />
      {!picking ? (
        <Card title="Diese Woche" description={`Seit ${formatDate(market.weekStart)} · neue Rotation in ${countdown(market.endsAt, now)}`}>
          {market.listings.length === 0 ? <Empty title="Leer">Würfle eine neue Rotation oder lege sie fest.</Empty> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{market.listings.map((l) => <Tile key={l.item.id} item={l.item} />)}</div>
          )}
        </Card>
      ) : (
        <Card title="Rotation festlegen" description={`Wähle bis zu ${size} Artikel – sie gelten bis Montag.`} right={<span className="badge badge-brand">{picking.length} / {size}</span>}>
          {pool.length === 0 ? <Empty title="Keine Black-Market-Artikel">Lege unter „Artikel“ welche mit „Erhältlich über: Black Market“ an.</Empty> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {pool.map((item) => <Tile key={item.id} item={item} selected={picking.includes(item.id)} onClick={() => toggle(item.id)} />)}
            </div>
          )}
          <Actions>
            <button type="button" className="btn btn-secondary" onClick={() => setPicking(null)}>Abbrechen</button>
            <button type="button" className="btn btn-primary" disabled={busy || picking.length === 0} onClick={pin}>Rotation speichern</button>
          </Actions>
        </Card>
      )}
      {dialog}
    </>
  );
}
