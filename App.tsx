/**
 * Level Measure Pro
 *
 * @format
 */

import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { createNavigationContainerRef, DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdsProvider } from './src/features/ads';
import { initI18n, LevelStack } from './src/features/level';
import type { LevelStackParamList } from './src/features/level/navigation';
import { useSettings } from './src/features/level/state/settingsStore';
import { colors } from './src/features/level/theme/tokens';
import { beginSplash, isSplashBlocking, Splash, useSplash } from './src/features/splash';

initI18n(useSettings.getState().language);
beginSplash();

const navigationRef = createNavigationContainerRef<LevelStackParamList>();
const currentRoute = () => (navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined);

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.ok,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.info,
  },
};

function App() {
  const phase = useSplash(s => s.phase);
  const interrupted = useSplash(s => s.interrupted);
  const splashBlocking = isSplashBlocking(phase);
  // Until the splash icon has loaded, everything stays see-through so the identical native splash
  // shows; then the app mounts under the opaque splash, so Level is live when the fade starts.
  const loading = phase === 'loading';
  return (
    <GestureHandlerRootView style={[styles.root, !loading && styles.opaque]}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        {loading ? null : (
          <View
            style={styles.root}
            importantForAccessibility={splashBlocking ? 'no-hide-descendants' : 'auto'}
            accessibilityElementsHidden={splashBlocking}>
            <AdsProvider getRoute={currentRoute} deferStart={splashBlocking} skipColdStart={interrupted}>
              <NavigationContainer ref={navigationRef} theme={theme}>
                <LevelStack />
              </NavigationContainer>
            </AdsProvider>
          </View>
        )}
        <Splash />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  opaque: { backgroundColor: colors.bg },
});

export default App;
