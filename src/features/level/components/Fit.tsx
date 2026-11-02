import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { space } from '../theme/tokens';

/**
 * Renders fixed-geometry instrument art (designed at `width`) scaled down to fit narrow screens.
 * Instrument layout is always LTR so the bubble moves toward the physical high side.
 */
export function Fit({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const { width: windowW } = useWindowDimensions();
  const scale = Math.min(1, (windowW - space.xl * 2) / width);
  return (
    <View style={[styles.outer, { width: width * scale, height: height * scale }]}>
      <View style={[styles.inner, { width, height, transform: [{ scale }] }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { alignSelf: 'center', direction: 'ltr' },
  inner: { transformOrigin: 'top left' },
});
