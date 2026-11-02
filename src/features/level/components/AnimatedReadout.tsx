import React from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { formatPrimary, type Units } from '../math/levelMath';
import { AnimatedText } from './AnimatedText';

type Props = {
  value: SharedValue<number>;
  units: SharedValue<Units>;
  decimals?: number;
  color?: SharedValue<string>;
  style?: StyleProp<TextStyle>;
};

/** Big UI-thread number in the selected unit, colored by level state. */
export function AnimatedReadout({ value, units, decimals = 1, color, style }: Props) {
  const text = useDerivedValue(() => formatPrimary(value.value, units.value, decimals));
  return <AnimatedText text={text} color={color} style={[styles.center, style]} />;
}

const styles = StyleSheet.create({ center: { textAlign: 'center' } });
