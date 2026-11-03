// The native splash files cannot run under Jest; these checks keep them in step with the JS splash.
// (Node's fs/path via Jest: the app's tsconfig has no Node types.)
declare const __dirname: string;
type Bytes = { [i: number]: number; readUInt32BE(offset: number): number; toString(encoding: 'latin1', start: number, end: number): string };
const fs = jest.requireActual<{
  readFileSync(path: string, encoding: 'utf8'): string;
  readFileSync(path: string): Bytes;
  existsSync(path: string): boolean;
}>('fs');
const path = jest.requireActual<{ join(...parts: string[]): string }>('path');
const root = path.join(__dirname, '../../../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

/** Width, height and color type from a PNG's IHDR chunk. */
function pngInfo(file: string) {
  const b = fs.readFileSync(path.join(root, file));
  expect(b.toString('latin1', 12, 16)).toBe('IHDR');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25] };
}

export {};

const RES = 'android/app/src/main/res';
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 } as const;
/** Android 12+ system splash icon canvas (no icon background); the middle 192dp stays visible. */
const SYSTEM_SPLASH_CANVAS_DP = 288;

const sceneDelegate = read('ios/LevelMeasurePro/SceneDelegate.swift');
const storyboard = read('ios/LevelMeasurePro/LaunchScreen.storyboard');
const splashWindow = read(`${RES}/drawable/splash_window.xml`);
const stylesV31 = read(`${RES}/values-v31/styles.xml`);
const colorsXml = read(`${RES}/values/colors.xml`);
const splashTsx = read('src/features/splash/Splash.tsx');

describe('iOS launch view under the React surface', () => {
  it('is hidden from VoiceOver', () => {
    expect(sceneDelegate).toMatch(/launch\.accessibilityElementsHidden = true/);
  });

  it('is removed after the first JS mount, well after the JS splash must be opaque', () => {
    const { SPLASH_ICON_TIMEOUT_MS } = require('../splashStore');
    const lifetime = Number(/launchViewLifetimeAfterFirstMount: TimeInterval = ([\d.]+)/.exec(sceneDelegate)?.[1]);
    expect(sceneDelegate).toMatch(/forName: \.RCTContentDidAppear\b/);
    expect(sceneDelegate).toMatch(/launch\?\.removeFromSuperview\(\)/);
    expect(lifetime * 1000).toBeGreaterThanOrEqual(2 * SPLASH_ICON_TIMEOUT_MS);
  });
});

describe('native and JS splash match', () => {
  it('uses the same icon size everywhere', () => {
    const { SPLASH_ICON_SIZE } = require('../Splash');
    expect(storyboard).toContain(`<constraint firstAttribute="width" constant="${SPLASH_ICON_SIZE}"`);
    expect(storyboard).toContain(`<constraint firstAttribute="height" constant="${SPLASH_ICON_SIZE}"`);
    expect(splashWindow).toContain(`android:width="${SPLASH_ICON_SIZE}dp"`);
    expect(splashWindow).toContain(`android:height="${SPLASH_ICON_SIZE}dp"`);
    expect(splashWindow).toContain('android:gravity="center"');
  });

  it('gives the Android 12+ system splash a bitmap canvas that scales with its bounds', () => {
    const { SPLASH_ICON_SIZE } = require('../Splash');
    expect(stylesV31).toContain('<item name="android:windowSplashScreenAnimatedIcon">@drawable/splash_icon_canvas</item>');
    // The system draws the icon into bounds of its own size; a layer-list with dp sizes shows cropped.
    expect(fs.existsSync(path.join(root, `${RES}/drawable/splash_icon_canvas.xml`))).toBe(false);
    for (const [density, scale] of Object.entries(DENSITIES)) {
      const icon = pngInfo(`${RES}/drawable-${density}/splash_icon.png`);
      const canvas = pngInfo(`${RES}/drawable-${density}/splash_icon_canvas.png`);
      expect([density, icon.width, icon.height]).toEqual([density, SPLASH_ICON_SIZE * scale, SPLASH_ICON_SIZE * scale]);
      const side = SYSTEM_SPLASH_CANVAS_DP * scale;
      expect([density, canvas.width, canvas.height]).toEqual([density, side, side]);
      expect([density, canvas.colorType]).toEqual([density, 6]); // RGBA: transparent padding
    }
  });

  it('uses the same background color everywhere', () => {
    expect(splashTsx).toContain("const SPLASH_BG = '#0E1116';");
    expect(colorsXml).toContain('<color name="splash_background">#0E1116</color>');
    // 0x0E/255, 0x11/255, 0x16/255 in the storyboard's sRGB background.
    expect(storyboard).toMatch(
      /<color key="backgroundColor" red="0\.0549\d*" green="0\.0666\d*" blue="0\.0862\d*" alpha="1" colorSpace="custom" customColorSpace="sRGB"\/>/,
    );
  });

  it('places the title the same distance below the center', () => {
    const offset = /const TITLE_OFFSET = (\d+);/.exec(splashTsx)?.[1];
    expect(storyboard).toContain(`secondItem="Spl-Ic-0n1" secondAttribute="centerY" constant="${offset}"`);
  });
});
