// "Begleiter" on the profile page: the member's pets in their current stage, care progress, mood and the food in stock.
// Food only comes from finishing all three daily quests; each pet eats once a day (rules in src/shared/pets.ts).
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { PET_FORM_NAMES, PET_STAGE_NAMES, drawFoodBowl, drawPet, type PetCare } from '../../../src/shared/pets';
import type { PetData } from '../../../src/shared/cosmetics';
import type { PetOverview } from '../../../src/web/dto/profile';
import { useMe, useMutation } from './api';
import { Glyph } from './visuals';

/** The pet drawn on a small canvas at its stage and mood (crisp on high-density screens). */
export function PetPortrait({ pet, stage, hungry, size }: { pet: PetData; stage: number; hungry: boolean; size: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    el.width = size * ratio;
    el.height = size * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawPet(ctx, pet, size / 2, size / 2 - size * 0.06, size * 0.36, stage, hungry);
  }, [pet, stage, hungry, size]);
  return <canvas ref={canvas} style={{ width: size, height: size }} aria-hidden="true" />;
}

/** The food bowl, the same picture the bot uses as its Discord emoji. */
export function FoodIcon({ size = 18, label }: { size?: number; label?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    el.width = size * ratio;
    el.height = size * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawFoodBowl(ctx, size / 2, size * 0.47, size * 0.95);
  }, [size]);
  return <canvas ref={canvas} style={{ width: size, height: size, flex: 'none' }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

const mood = (care: PetCare) => (care.hungry ? 'Traurig: ein Tag ohne Futter. Die Form bleibt, der Weg zur nächsten beginnt neu.' : care.fedToday ? 'Satt und zufrieden' : 'Freut sich auf Futter');

/** Care days towards the next form as a bar (full at "Kronenform"). */
function CareBar({ care, pet }: { care: PetCare; pet: PetData }) {
  const from = care.stageFrom;
  const share = care.nextAt === null ? 1 : (care.care - from) / (care.nextAt - from);
  return (
    <div className="mt-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[.06]">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.max(4, share * 100)}%` }} />
      </div>
      <div className="mt-1 text-[11.5px] tabular-nums text-faint">
        {care.nextAt === null ? `${care.care} Pflegetage · höchste Form` : `${care.care} / ${care.nextAt} Pflegetage · nächste Form: ${PET_FORM_NAMES[pet.species][care.stage as 1 | 2 | 3]}`}
      </div>
    </div>
  );
}

export function PetCareCard() {
  const { me, setMe, items } = useMe();
  const { run, busy } = useMutation();
  const { food, foodMax, pets } = me.pets;
  const feed = async (itemId: string) => {
    const result = await run<PetOverview>('/me/pets/feed', 'POST', { itemId }, 'Mampf! Das hat geschmeckt.');
    if (result) setMe((prev) => ({ ...prev, pets: result }));
  };

  if (pets.length === 0) {
    return (
      <section className="card !p-5">
        <span className="text-[13px] text-mute">Begleiter</span>
        <p className="mt-2 text-[13.5px] text-body">Noch kein Tier. Im Shop findest du Begleiter, die mit deiner Pflege von der Babyform bis zur Kronenform wachsen.</p>
        <Link to="/me/shop" className="btn btn-secondary btn-sm mt-3 hover:no-underline"><Glyph name="paw" size={15} /> Begleiter ansehen</Link>
      </section>
    );
  }

  const equipped = me.profile.equipped.pet;
  const ordered = [...pets].sort((a, b) => Number(b.itemId === equipped) - Number(a.itemId === equipped));
  const feedButton = (care: PetCare, small = false) => (
    <button type="button" className={`btn ${small ? 'btn-secondary btn-sm' : 'btn-primary w-full'}`} disabled={busy || care.fedToday || food === 0}
      title={care.fedToday ? 'Heute schon gefüttert' : food === 0 ? 'Kein Futter: schaff alle drei Tagesaufgaben' : undefined} onClick={() => feed(care.itemId)}>
      {care.fedToday ? 'Satt' : 'Füttern'}
    </button>
  );

  return (
    <section className="card !p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-mute">Begleiter</span>
        <span className="flex items-center gap-1.5 text-[12.5px] text-mute" title="Futtervorrat: eine Portion für alle drei Tagesaufgaben, höchstens drei auf Vorrat. Jede Fütterung kostet eine Portion.">
          {Array.from({ length: foodMax }, (_, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < food ? 'bg-accent' : 'border border-white/20'}`} />
          ))}
          <FoodIcon size={16} /> Vorrat {food} / {foodMax}
        </span>
      </div>
      {ordered.map((care, index) => {
        const item = items.get(care.itemId);
        if (!item || item.slot !== 'pet') return null;
        const pet = item.data as PetData;
        if (index === 0) {
          return (
            <div key={care.itemId} className="mt-3">
              <div className="flex items-center gap-3">
                <div className="grid shrink-0 place-items-center rounded-xl bg-black/20"><PetPortrait pet={pet} stage={care.stage} hungry={care.hungry} size={104} /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-ink">{item.name}</div>
                  <div className="text-[12.5px] text-accent-text">{PET_FORM_NAMES[pet.species][care.stage - 1]} · {PET_STAGE_NAMES[care.stage - 1]}</div>
                  <div className={`mt-1 text-[12.5px] ${care.hungry ? 'text-warn' : 'text-mute'}`}>{mood(care)}</div>
                </div>
              </div>
              <CareBar care={care} pet={pet} />
              <div className="mt-3">{feedButton(care)}</div>
            </div>
          );
        }
        return (
          <div key={care.itemId} className="mt-3 flex items-center gap-2.5 border-t border-white/[.06] pt-3">
            <PetPortrait pet={pet} stage={care.stage} hungry={care.hungry} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] text-ink">{item.name}</div>
              <div className={`text-[12px] ${care.hungry ? 'text-warn' : 'text-faint'}`}>{PET_FORM_NAMES[pet.species][care.stage - 1]} · {care.hungry ? 'traurig' : care.fedToday ? 'satt' : `${care.care} Pflegetage`}</div>
            </div>
            {feedButton(care, true)}
          </div>
        );
      })}
      <p className="mt-3 text-[11.5px] text-faint">Futter gibt es für alle drei Tagesaufgaben, nicht im Shop. Jedes Tier frisst einmal am Tag. Verpasst du einen Tag, wird es traurig und der Weg zur nächsten Form beginnt neu.</p>
    </section>
  );
}
