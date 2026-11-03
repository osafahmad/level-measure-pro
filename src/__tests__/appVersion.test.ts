// The native version settings cannot be read under Jest; this keeps APP_VERSION in step with them.
// (Node's fs/path via Jest: the app's tsconfig has no Node types.)
import { APP_VERSION } from '../appVersion';

declare const __dirname: string;
const fs = jest.requireActual<{ readFileSync(path: string, encoding: 'utf8'): string }>('fs');
const path = jest.requireActual<{ join(...parts: string[]): string }>('path');
const root = path.join(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('APP_VERSION', () => {
  it('matches MARKETING_VERSION in every iOS build configuration', () => {
    const versions = [...read('ios/LevelMeasurePro.xcodeproj/project.pbxproj').matchAll(/MARKETING_VERSION = ([^;]+);/g)].map(
      m => m[1],
    );
    expect(versions.length).toBeGreaterThan(0);
    expect(new Set(versions)).toEqual(new Set([APP_VERSION]));
  });

  it('matches the Android versionName', () => {
    const match = read('android/app/build.gradle').match(/versionName\s+"([^"]+)"/);
    expect(match?.[1]).toBe(APP_VERSION);
  });
});
