import type * as Tokens from '../tokens';

/** Tokens resolve direction and platform once at load, so each case loads a fresh copy. */
function load(os: 'ios' | 'android', rtl: boolean): typeof Tokens {
  jest.resetModules();
  const RN = require('react-native');
  RN.Platform.OS = os;
  RN.I18nManager.isRTL = rtl;
  return require('../tokens');
}

const WORD_STYLES = ['title', 'h2', 'body', 'label', 'button', 'cardTitle', 'overline', 'status'] as const;

describe('type tokens', () => {
  it.each(['ios', 'android'] as const)('keeps the English (LTR) styles unchanged on %s', os => {
    const { type, fonts, textSize } = load(os, false);
    expect(type.title).toEqual({ fontFamily: fonts.sansSemi, fontSize: 20, letterSpacing: -0.2 });
    expect(type.h2).toEqual({ fontFamily: fonts.sansSemi, fontSize: 18 });
    expect(type.body).toEqual({ fontFamily: fonts.sans, fontSize: 14, lineHeight: 21 });
    expect(type.label).toEqual({ fontFamily: fonts.sans, fontSize: 11 });
    expect(type.button).toEqual({ fontFamily: fonts.sansMedium, fontSize: 12 });
    expect(type.cardTitle).toEqual({ fontFamily: fonts.sansSemi, fontSize: 12, letterSpacing: 0.6 });
    expect(type.overline).toEqual({ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, fontVariant: ['tabular-nums'] });
    expect(type.status).toEqual({ fontFamily: fonts.mono, fontSize: 11, fontVariant: ['tabular-nums'] });
    expect(textSize(12, 17)).toEqual({ fontSize: 12, lineHeight: 17 });
  });

  it('draws Urdu on iOS in Nastaliq with its own line height and room for its overhanging ink', () => {
    const { type, textSize } = load('ios', true);
    for (const name of WORD_STYLES) {
      const style = type[name] as Record<string, unknown>;
      expect(String(style.fontFamily)).toMatch(/^NotoNastaliqUrdu/);
      // A fixed line height (Inter-sized) is what clipped the tops.
      expect(style.lineHeight).toBeUndefined();
      expect(style.paddingTop).toBeGreaterThan(0);
      expect(style.paddingHorizontal).toBeGreaterThan(0);
    }
    expect(type.title.fontFamily).toBe('NotoNastaliqUrdu-Bold');
    expect(type.body.fontFamily).toBe('NotoNastaliqUrdu');
    expect(textSize(12, 17)).toEqual({ fontSize: 12 });
  });

  it('keeps Inter and fixed line heights for Urdu on Android', () => {
    const { type, fonts, textSize } = load('android', true);
    expect(type.body).toEqual({ fontFamily: fonts.sans, fontSize: 14, lineHeight: 21 });
    expect(type.title).toEqual({ fontFamily: fonts.sansSemi, fontSize: 20, letterSpacing: 0 });
    expect(type.status).toEqual({ fontFamily: fonts.sans, fontSize: 11, fontVariant: ['tabular-nums'] });
    expect(textSize(12, 17)).toEqual({ fontSize: 12, lineHeight: 17 });
  });
});
