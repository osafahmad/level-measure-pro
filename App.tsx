/**
 * Level Measure Pro
 *
 * @format
 */

import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { createNavigationContainerRef, DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdsProvider } from './src/features/ads';
import { initI18n, LevelStack } from './src/features/level';
import type { LevelStackParamList } from './src/features/level/navigation';
import { useSettings } from './src/features/level/state/settingsStore';
import { colors } from './src/features/level/theme/tokens';

initI18n(useSettings.getState().language);

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
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        <AdsProvider getRoute={currentRoute}>
          <NavigationContainer ref={navigationRef} theme={theme}>
            <LevelStack />
          </NavigationContainer>
        </AdsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});

export default App;
