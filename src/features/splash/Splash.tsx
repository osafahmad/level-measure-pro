import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Image, Platform, StyleSheet } from 'react-native';
import { colors } from '../level/theme/tokens';
import {
  bootAt,
  endSplash,
  isSplashBlocking,
  SPLASH_FADE_MS,
  SPLASH_HOLD_MS,
  SPLASH_ICON_TIMEOUT_MS,
  splashIconReady,
  useSplash,
} from './splashStore';

// Must match the native splash exactly: LaunchScreen.storyboard (iOS) and
// res/drawable/splash_window.xml + drawable-*dpi/splash_icon_canvas.png (Android).
export const SPLASH_ICON_SIZE = 200;
/** The icon artwork's own background, so its square edge is invisible. */
const SPLASH_BG = '#0E1116';
/** Title top edge, below the exact screen center (the icon stays centered). */
const TITLE_OFFSET = 64;
/** Android has no native text stage, so the title fades in instead of popping. */
const TITLE_FADE_MS = 150;
const TITLE = 'Level Measure Pro'; // brand name, not translated

const ICON = require('../../../assets/splash/splash-icon.png');

/**
 * Cold-launch splash over the app. It starts see-through on top of the identical native splash
 * until its icon has loaded, then turns opaque and holds until SPLASH_HOLD_MS after bundle load
 * *and* the app is active. A trip to the background marks it interrupted (no App Open this launch).
 */
export function Splash() {
  const phase = useSplash(s => s.phase);
  const blocking = isSplashBlocking(phase);
  const [shown, setShown] = useState(blocking);
  const opacity = useRef(new Animated.Value(1)).current;
  const titleOpacity = useRef(new Animated.Value(Platform.OS === 'android' ? 0 : 1)).current;

  useEffect(() => {
    if (!blocking) return;
    let elapsed = false;
    const tryEnd = () => {
      if (elapsed && AppState.currentState === 'active' && useSplash.getState().phase === 'holding') endSplash();
    };
    const hold = setTimeout(() => {
      elapsed = true;
      tryEnd();
    }, Math.max(0, SPLASH_HOLD_MS - (Date.now() - bootAt)));
    const appStateSub = AppState.addEventListener('change', next => {
      if (next === 'background') useSplash.setState({ interrupted: true });
      else if (next === 'active') tryEnd();
    });
    const storeUnsub = useSplash.subscribe((s, prev) => {
      if (s.phase === 'holding' && prev.phase === 'loading') tryEnd();
    });
    return () => {
      clearTimeout(hold);
      appStateSub.remove();
      storeUnsub();
      // Torn down mid-splash (Android destroyed the Activity): do not offer it, or App Open, again.
      if (useSplash.getState().phase !== 'off') useSplash.setState({ phase: 'off', interrupted: true });
    };
  }, [blocking]);

  useEffect(() => {
    if (phase !== 'loading') return;
    const id = setTimeout(splashIconReady, SPLASH_ICON_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'holding' || Platform.OS !== 'android') return;
    Animated.timing(titleOpacity, { toValue: 1, duration: TITLE_FADE_MS, useNativeDriver: true }).start();
  }, [phase, titleOpacity]);

  useEffect(() => {
    if (blocking || !shown) return;
    const fade = Animated.timing(opacity, { toValue: 0, duration: SPLASH_FADE_MS, useNativeDriver: true });
    fade.start(() => setShown(false));
    return () => fade.stop();
  }, [blocking, shown, opacity]);

  if (!shown) return null;
  const loading = phase === 'loading';
  return (
    <Animated.View
      testID="splash"
      pointerEvents={blocking ? 'auto' : 'none'}
      accessible
      accessibilityLabel={TITLE}
      style={[styles.root, !loading && styles.opaque, { opacity }]}>
      <Image testID="splash-icon" source={ICON} style={styles.icon} fadeDuration={0} onLoad={splashIconReady} onError={splashIconReady} />
      {loading ? null : (
        <Animated.Text allowFontScaling={false} style={[styles.title, { opacity: titleOpacity }]}>
          {TITLE}
        </Animated.Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  opaque: { backgroundColor: SPLASH_BG },
  icon: { width: SPLASH_ICON_SIZE, height: SPLASH_ICON_SIZE },
  // System font: the launch storyboard cannot rely on custom fonts, and both iOS stages must match.
  title: {
    position: 'absolute',
    top: '50%',
    marginTop: TITLE_OFFSET,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
});
