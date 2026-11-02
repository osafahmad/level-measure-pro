import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Bookmark, Crosshair, Pause } from 'lucide-react-native';
import type { Units } from '../math/levelMath';
import { colors, fonts, ltr, radius, size, space, type } from '../theme/tokens';

type Props = {
  onCalibrate: () => void;
  onHold: () => void;
  onUnits: () => void;
  onSave: () => void;
  units: Units;
};

const ICON = { size: 18, strokeWidth: 1.8 };

function ToolButton({
  label,
  a11y,
  onPress,
  primary,
  icon,
}: {
  label: string;
  a11y?: string;
  onPress: () => void;
  primary?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      style={({ pressed }) => [styles.btn, primary && styles.primary, pressed && (primary ? styles.primaryPressed : styles.pressed)]}>
      {icon}
      <Text style={[styles.label, primary && styles.labelPrimary]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Four equal buttons: Calibrate, Hold (primary), Units, Save. */
export function Toolbar({ onCalibrate, onHold, onUnits, onSave, units }: Props) {
  const { t } = useTranslation();
  const unitShort = t(`units.short.${units}`);
  return (
    <View style={styles.row}>
      <ToolButton label={t('toolbar.calibrate')} onPress={onCalibrate} icon={<Crosshair color={colors.text} {...ICON} />} />
      <ToolButton label={t('toolbar.hold')} onPress={onHold} primary icon={<Pause color={colors.onPrimary} {...ICON} />} />
      <ToolButton
        label={t('toolbar.units')}
        a11y={t('a11y.unitsCurrent', { unit: t(`units.name.${units}`) })}
        onPress={onUnits}
        icon={<Text style={styles.unitGlyph}>{unitShort}</Text>}
      />
      <ToolButton label={t('toolbar.save')} onPress={onSave} icon={<Bookmark color={colors.text} {...ICON} />} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  btn: {
    flex: 1,
    height: size.toolbarButton,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  pressed: { backgroundColor: colors.chip },
  primary: { backgroundColor: colors.text, borderColor: colors.text },
  primaryPressed: { backgroundColor: colors.textSecondary },
  label: { ...type.button, color: colors.text },
  labelPrimary: { color: colors.onPrimary },
  unitGlyph: { fontFamily: fonts.monoSemi, fontSize: 15, lineHeight: 18, color: colors.text, ...ltr },
});
