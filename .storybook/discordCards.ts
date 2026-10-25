// Sample Nexo answers built with the bot's own code (nexoCard, nexoMessage, ButtonBuilder), for the Discord story.
// Runs in the Storybook dev server (main.ts loads it with Vite's SSR loader), because the builders need discord.js.
// Each sample is one exported function; the story shows its source next to the rendered message.
import { ButtonBuilder, ButtonStyle } from 'discord.js';
import { formatCoins, setCoinEmojis } from '../src/shared/coins.js';
import { ACCENTS, nexoCard, nexoMessage, textBar } from '../src/utils/nexoMessage.js';

// The bot learns its coin emojis at startup (services/cosmetics/coinEmojis.ts); these stand-ins keep the same form,
// and the story draws them as the dashboard's coins.
setCoinEmojis({ platinum: '<:coin_platinum:1>', gold: '<:coin_gold:2>', silver: '<:coin_silver:3>', bronze: '<:coin_bronze:4>' });

const link = (label: string, url = 'https://nexo.example/dashboard') => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url);
const button = (label: string, customId: string, style = ButtonStyle.Secondary) => new ButtonBuilder().setStyle(style).setLabel(label).setCustomId(customId);

export function tagesaufgaben() {
  return nexoMessage(nexoCard({
    kicker: 'Tagesaufgaben', title: '1 von 3 geschafft', banner: 'quests',
    blocks: [
      { text: `✅ ~~Schreib 25 Nachrichten~~\n-# geschafft · ${formatCoins(30)}` },
      { text: `⬜ **Reagiere 10-mal mit einem Emoji**\n${textBar(4, 10)} 4/10 · ${formatCoins(20)}` },
      { text: `⬜ **Spiel 3 Minispiele**\n${textBar(1, 3)} 1/3 · ${formatCoins(30)}` },
      { separator: true },
      { text: `**Saison Oktober 2026** · Stufe 5 von 10\n${textBar(455, 540)} 455 / 540 Punkte` },
      { buttons: [link('Saisonpfad'), link('Zum Shop')] },
    ],
  }), { ephemeral: true });
}

export function kontostand() {
  return nexoMessage(nexoCard({
    kicker: 'Bernis', title: formatCoins(2850), accent: ACCENTS.gold,
    blocks: [
      { text: '-# 2.850 Bernis insgesamt' },
      { separator: true },
      { text: 'Bernis bekommst du für Level-ups, Minispiele, Erfolge, Tagesaufgaben und den Tagesbonus.' },
      { buttons: [link('Zum Shop'), button('Tagesbonus abholen', 'sample:daily', ButtonStyle.Success)] },
    ],
  }), { ephemeral: true });
}

export function gewinnspiel() {
  return nexoMessage(nexoCard({
    title: 'Steam-Gutschein 20 €', banner: 'gift',
    blocks: [
      { text: 'Klick auf den Button unten, um teilzunehmen!' },
      { separator: true },
      { text: '**Veranstaltet von:** <@1>\n**Gewinner:** 1 · **Teilnahmen:** 17\n**Endet** <t:1793000000:R>' },
      { buttons: [button('Teilnehmen', 'sample:join', ButtonStyle.Primary), button('Beenden', 'sample:end', ButtonStyle.Danger)] },
    ],
  }));
}

export function verwarnung() {
  return nexoMessage(nexoCard({
    kicker: 'Moderation', title: 'Verwarnung erteilt', accent: ACCENTS.warn,
    blocks: [{ text: '<@2> wurde verwarnt: Spam in #allgemein.' }],
    footer: 'Fall #128 · von Alex',
  }));
}

export function verifiziert() {
  return nexoMessage(nexoCard({ kicker: 'Verifizierung', title: 'Du bist verifiziert', accent: ACCENTS.success, blocks: [{ text: 'Ab jetzt siehst du alle Kanäle des Servers.' }] }), { ephemeral: true });
}

export function fehler() {
  return nexoMessage(nexoCard({ kicker: 'Fehler', title: 'Das hat nicht geklappt', accent: ACCENTS.danger, blocks: [{ text: 'Dieses Mitglied ist nicht (mehr) auf diesem Server.' }] }), { ephemeral: true });
}

export function hilfe() {
  return nexoMessage(nexoCard({
    kicker: 'Hilfe', title: 'Alle Befehle', accent: ACCENTS.info,
    blocks: [
      { text: 'Mit </profil aufgaben:3> siehst du deine drei Tagesaufgaben, mit </profil karte:3> deine Profilkarte.' },
      { buttons: [button('‹', 'sample:prev').setDisabled(true), button('Seite 1 von 3', 'sample:page').setDisabled(true), button('›', 'sample:next')] },
    ],
  }), { ephemeral: true });
}

export function beendet() {
  return nexoMessage(nexoCard({ kicker: 'Gewinnspiel', title: 'Beendet', accent: ACCENTS.calm, banner: 'giftEnded', blocks: [{ text: 'Gewonnen hat <@3>. Danke fürs Mitmachen!' }] }));
}

/** The samples in the order the story shows them, with a title. */
export const SAMPLES = [
  { id: 'tagesaufgaben', title: 'Tagesaufgaben', build: tagesaufgaben },
  { id: 'kontostand', title: 'Kontostand', build: kontostand },
  { id: 'gewinnspiel', title: 'Gewinnspiel', build: gewinnspiel },
  { id: 'beendet', title: 'Gewinnspiel beendet', build: beendet },
  { id: 'verwarnung', title: 'Verwarnung', build: verwarnung },
  { id: 'verifiziert', title: 'Verifiziert', build: verifiziert },
  { id: 'fehler', title: 'Fehler', build: fehler },
  { id: 'hilfe', title: 'Hilfe mit Blättern', build: hilfe },
];
