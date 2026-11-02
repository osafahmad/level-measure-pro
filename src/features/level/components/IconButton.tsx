import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors, radius, size } from '../theme/tokens';

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
};

/** 44 × 44 square button on `surface` with a strong border. */
export function IconButton({ onPress, accessibilityLabel, children }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: size.touch,
    height: size.touch,
    borderRadius: radius.cell + 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.chip },
});
