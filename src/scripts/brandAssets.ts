// Writes Nexo's Discord pictures to assets/brand/profile/, all from services/cosmetics/profileArt.ts: the profile
// banner, the test bot's banner and avatar, and one banner per calendar event (what the bot sets during the event).
// Run after changing the recipe: `npm run brand:assets`, then commit the pictures.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calendarEvents } from '../services/cosmetics/events.js';
import { renderEventBanner } from '../services/cosmetics/botProfile.js';
import { renderProfileBanner, renderTestAvatar } from '../services/cosmetics/profileArt.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets/brand/profile');

await mkdir(path.join(OUT, 'events'), { recursive: true });
const write = (file: string, png: Buffer) => writeFile(path.join(OUT, file), png);
await write('banner.png', await renderProfileBanner({ format: 'app', seed: 'nexo' }));
await write('banner-test.png', await renderProfileBanner({ format: 'app', seed: 'nexo-test', tint: '#FFC400', tag: 'TEST' }));
await write('avatar-test.png', await renderTestAvatar());
for (const event of calendarEvents(new Date().getFullYear())) await write(`events/${event.id}.png`, await renderEventBanner(event));
console.log(`Bilder geschrieben nach ${path.relative(process.cwd(), OUT)}`);
process.exit(0);
