import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, ltr, radius, size, type } from '../theme/tokens';

type Option<T> = { value: T; label: string; a11y?: string };

type Props<T> = {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  mono?: boolean;
  accessibilityLabel?: string;
};

/** Generic segmented control (same look as ModeTabs). */
export function Segmented<T extends string | number>({ options, value, onChange, mono, accessibilityLabel }: Props<T>) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.a11y ?? o.label}
            accessibilityState={{ checked: active }}
            style={[styles.seg, active && styles.segActive]}>
            <Text style={[styles.label, mono && styles.mono, active && styles.labelActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    height: size.touch,
    padding: 3,
    borderRadius: radius.segment,
    backgroundColor: colors.surfaceInset,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seg: { flex: 1, borderRadius: radius.segmentInner, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: colors.chip },
  label: { ...type.button, fontSize: 13, color: colors.textMuted },
  mono: { ...type.valueSm, ...ltr },
  labelActive: { color: colors.text },
});
