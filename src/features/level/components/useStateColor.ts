import { interpolateColor, useDerivedValue } from 'react-native-reanimated';
import type { LevelSensor } from '../sensors/useLevelSensor';
import { colors } from '../theme/tokens';

/**
 * Level-state color (ok / warn / bad) from the smoothed |primary|, honoring the level
 * hysteresis so color and haptic agree.
 */
export function useStateColor(s: LevelSensor) {
  return useDerivedValue(() => {
    const tol = s.wasLevel.value ? s.tolerance.value + 0.2 : s.tolerance.value;
    return interpolateColor(
      s.levelAbs.value,
      [0, tol, tol + 0.01, 3, 3.01],
      [colors.ok, colors.ok, colors.warn, colors.warn, colors.bad],
    );
  });
}
