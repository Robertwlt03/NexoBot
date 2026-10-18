// Loads the bundled card fonts (assets/fonts, the same files the bot registers) so preview and bot render alike.

import { CARD_FONTS, type CardFont, type CardFontWeight } from '../../../../src/shared/welcomeCard';

// Literal URLs so Vite bundles the files.
const FILES: Record<CardFont, Record<CardFontWeight, string>> = {
  inter: {
    400: new URL('../../../../assets/fonts/inter-400.woff2', import.meta.url).href,
    700: new URL('../../../../assets/fonts/inter-700.woff2', import.meta.url).href,
  },
  unbounded: {
    400: new URL('../../../../assets/fonts/unbounded-400.woff2', import.meta.url).href,
    700: new URL('../../../../assets/fonts/unbounded-700.woff2', import.meta.url).href,
  },
  caveat: {
    400: new URL('../../../../assets/fonts/caveat-400.woff2', import.meta.url).href,
    700: new URL('../../../../assets/fonts/caveat-700.woff2', import.meta.url).href,
  },
};

let loading: Promise<void> | null = null;

/** Resolves once every card font is ready (failed fonts fall back to the browser default). */
export function loadCardFonts(): Promise<void> {
  loading ??= Promise.allSettled(
    (Object.keys(FILES) as CardFont[]).flatMap((font) => ([400, 700] as const).map(async (weight) => {
      const face = new FontFace(CARD_FONTS[font].family, `url(${FILES[font][weight]})`, { weight: String(weight) });
      document.fonts.add(await face.load());
    })),
  ).then(() => undefined);
  return loading;
}
