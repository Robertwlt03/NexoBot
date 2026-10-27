// /profil pet and its "Füttern" button: the equipped pet (or the first one owned) as a picture at its stage, care days,
// mood and food; the member's other pets as short lines. Feeding lives in services/cosmetics/pets.ts.

import { AttachmentBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { ACCENTS, nexoCard, textBar, type NexoBlock } from '../../../utils/nexoMessage.js';
import { cmd } from '../../../utils/commandMention.js';
import { publicDashboardUrl } from '../../../web/dashboard.js';
import { PET_STAGE_CARE, PET_STAGE_NAMES } from '../../../shared/pets.js';
import type { PetData } from '../../../shared/cosmetics.js';
import { getPetOverview } from '../../../services/cosmetics/pets.js';
import { loadCatalog } from '../../../services/cosmetics/catalog.js';
import { readProfileSettings } from '../../../services/cosmetics/profile.js';
import { renderPetPng } from '../../../services/profileCardRenderer.js';

/** customId of the feed button: `pet_feed:<itemId>`. */
export const PET_FEED_BUTTON = 'pet_feed';

export async function petMessage(userId: string, canAttach: boolean) {
  const [overview, catalog, settings] = await Promise.all([getPetOverview(userId), loadCatalog(), readProfileSettings(userId)]);
  const dashboard = publicDashboardUrl();
  const link = (label: string, path: string) => (dashboard ? [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(`${dashboard}/me${path}`)] : []);
  const pets = overview.pets.filter((care) => catalog.get(care.itemId)?.slot === 'pet')
    .sort((a, b) => Number(b.itemId === settings.equipped.pet) - Number(a.itemId === settings.equipped.pet));
  const foodLine = `🍖 Futter **${overview.food} / ${overview.foodMax}** · neue Portion für alle drei Tagesaufgaben (${cmd('profil aufgaben')})`;

  if (pets.length === 0) {
    return {
      container: nexoCard({ kicker: 'Begleiter', title: 'Noch kein Tier', blocks: [{ text: 'Im Shop findest du Begleiter, die mit deiner Pflege von der **Babyform** bis zur **Kronenform** wachsen.' }, { text: foodLine }, { buttons: link('Begleiter im Shop', '/shop') }] }),
      files: [] as AttachmentBuilder[],
    };
  }

  const [main, ...others] = pets;
  const item = catalog.get(main.itemId)!;
  const files = canAttach ? [new AttachmentBuilder(await renderPetPng(item.data as PetData, main.stage, main.hungry), { name: 'pet.png' })] : [];
  const from = PET_STAGE_CARE[main.stage - 1];
  const progress = main.nextAt === null
    ? `${main.care} Pflegetage · Kronenform erreicht`
    : `${textBar(main.care - from, main.nextAt - from)} ${main.care} / ${main.nextAt} Pflegetage bis **${PET_STAGE_NAMES[main.stage as 1 | 2 | 3]}**`;
  const mood = main.hungry ? '😢 Hat Hunger: es wächst erst weiter, wenn du es fütterst.' : main.fedToday ? '😋 Satt, heute schon gefüttert.' : '🙂 Freut sich auf Futter.';
  const feed = new ButtonBuilder().setCustomId(`${PET_FEED_BUTTON}:${main.itemId}`).setStyle(ButtonStyle.Primary)
    .setLabel(main.fedToday ? 'Heute schon satt' : 'Füttern').setDisabled(main.fedToday || overview.food === 0);
  const blocks: NexoBlock[] = [
    ...(files.length ? [{ images: ['attachment://pet.png'] }] : []),
    { text: `**${item.name}** · ${PET_STAGE_NAMES[main.stage - 1]}\n${progress}\n${mood}` },
    { text: foodLine },
    { buttons: [feed, ...link('Im Dashboard', '')] },
  ];
  if (others.length) {
    blocks.push({ separator: true }, { text: others.map((care) => `– **${catalog.get(care.itemId)?.name ?? 'Tier'}** · ${PET_STAGE_NAMES[care.stage - 1]} · ${care.hungry ? 'hungrig 😢' : care.fedToday ? 'satt' : `${care.care} Pflegetage`}`).join('\n') + '\n-# Andere Tiere fütterst du im Dashboard oder, wenn du sie anlegst, hier.' });
  }
  return { container: nexoCard({ kicker: 'Begleiter', title: item.name, accent: main.hungry ? ACCENTS.warn : undefined, blocks }), files };
}
