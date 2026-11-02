import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { LevelStackParamList } from './navigation';
import { CalibrateScreen } from './screens/CalibrateScreen';
import { LevelScreen } from './screens/LevelScreen';
import { ReadingsScreen } from './screens/ReadingsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LevelSensorProvider } from './sensors/LevelSensorContext';
import { colors } from './theme/tokens';

const Stack = createNativeStackNavigator<LevelStackParamList>();

/** Level stays mounted under the Calibrate modal so both share one sensor pipeline. */
export function LevelStack() {
  return (
    <LevelSensorProvider>
      <Stack.Navigator
        initialRouteName="Level"
        screenOptions={{ headerShown: false, statusBarStyle: 'light', contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="Level" component={LevelScreen} />
        <Stack.Screen name="Calibrate" component={CalibrateScreen} options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="Readings" component={ReadingsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </LevelSensorProvider>
  );
}
