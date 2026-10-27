import { useMemo } from 'react';
import { Link } from 'react-router';
import { COSMETIC_SLOTS, MAX_EQUIPPED_BADGES, SLOT_LABELS } from '../../../src/shared/cosmetics';
import type { CosmeticItem } from '../../../src/shared/cosmetics';
import type { OwnedItem } from '../../../src/web/dto/profile';
import { Badge, Card, Empty, PageHeader, Stats } from '../components/ui';
import { equipItem, formatDate, isEquipped, num, unequipItem, useEquip, useMe } from './api';
import { ItemVisual, RARITY_CLASS, RarityLabel } from './visuals';

const SOURCE_LABELS: Record<OwnedItem['source'], string> = {
  purchase: 'Gekauft', gift: 'Geschenkt bekommen', achievement: 'Erfolg', ranking: 'Rangliste', event: 'Event', owner: 'Vom Nexo-Team', season: 'Saisonpfad',
};

export default function InventoryPage() {
  const { me, items } = useMe();
  const equip = useEquip();
  const entries = useMemo(() => me.inventory.flatMap((owned) => {
    const item = items.get(owned.itemId);
    return item ? [{ owned, item }] : [];
  }), [me.inventory, items]);
  const sorted = useMemo(() => [...entries].sort((a, b) => COSMETIC_SLOTS.indexOf(a.item.slot) - COSMETIC_SLOTS.indexOf(b.item.slot)), [entries]);
  const equippedCount = entries.filter((e) => isEquipped(me.profile.equipped, e.item)).length;

  const toggle = (item: CosmeticItem) => {
    const on = isEquipped(me.profile.equipped, item);
    if (on) return equip.apply(unequipItem(me.profile.equipped, item), `„${item.name}“ abgelegt.`);
    return equip.apply(equipItem(me.profile.equipped, item), `„${item.name}“ angelegt.`);
  };

  return (
    <>
      <PageHeader kicker="Mein Profil" title="Inventar" description="Alles, was dir gehört. Anlegen wirkt sofort auf allen Servern." />
      <Stats items={[
        { label: 'Artikel', value: num(me.inventory.length) },
        { label: 'Angelegt', value: num(equippedCount) },
        { label: 'Bereiche belegt', value: `${new Set(entries.map((e) => e.item.slot)).size} / ${COSMETIC_SLOTS.length}` },
      ]} />
      {me.inventory.length === 0 && <Card><Empty title="Noch leer">Im <Link to="/me/shop">Shop</Link> findest du deine ersten Artikel.</Empty></Card>}
      {entries.length > 0 && (
        // One grid for everything, ordered by area: a card per area left mostly single items in wide empty cards.
        <Card title="Deine Artikel" description={`Bis zu ${MAX_EQUIPPED_BADGES} Abzeichen gleichzeitig, sonst ein Artikel je Bereich.`} right={<Badge>{entries.length}</Badge>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sorted.map(({ owned, item }) => {
              const on = isEquipped(me.profile.equipped, item);
              const full = !on && item.slot === 'badge' && me.profile.equipped.badges.length >= MAX_EQUIPPED_BADGES;
              return (
                <div key={item.id} className={`flex flex-col rounded-2xl border bg-tint p-2.5 ${on ? 'border-accent/50' : RARITY_CLASS[item.rarity].border}`}>
                  <ItemVisual item={item} />
                  <div className="px-1 pb-3 pt-2.5">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-mute">{SLOT_LABELS[item.slot]}</div>
                    <h3 className="break-words font-sans text-[14px] font-medium">{item.name}</h3>
                    <div className="mt-0.5 text-[12px] text-faint"><RarityLabel rarity={item.rarity} /> · {SOURCE_LABELS[owned.source]} am {formatDate(owned.acquiredAt)}</div>
                  </div>
                  {full && <p className="faint mb-2 px-1">Du hast schon {MAX_EQUIPPED_BADGES} Abzeichen angelegt.</p>}
                  <button type="button" className={`btn btn-sm mt-auto ${on ? 'btn-secondary' : 'btn-ghost border-line-strong'}`} disabled={equip.busy || full} onClick={() => toggle(item)}>
                    {on ? 'Ablegen' : 'Anlegen'}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}
