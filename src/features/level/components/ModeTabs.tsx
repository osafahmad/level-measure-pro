import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, size, space, type } from '../theme/tokens';

export type TabMode = 'edge' | 'flat';
const MODES: TabMode[] = ['edge', 'flat']; // grows to Table / Slope in phase 2

type Props = {
  value: TabMode;
  onChange: (m: TabMode) => void;
  /** Auto pose switching; tapping a tab pins the mode until Auto is tapped. */
  auto: boolean;
  onAuto: () => void;
};

export function ModeTabs({ value, onChange, auto, onAuto }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <View style={styles.segments} accessibilityRole="tablist">
        {MODES.map(m => {
          const active = m === value;
          return (
            <Pressable
              key={m}
              onPress={() => onChange(m)}
              accessibilityRole="tab"
              accessibilityLabel={t(`mode.${m}`)}
              accessibilityState={{ selected: active }}
              style={[styles.segment, active && styles.segmentActive]}>
              <Text style={[styles.label, active && styles.labelActive]}>{t(`mode.${m}`)}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={onAuto}
        accessibilityRole="switch"
        accessibilityLabel={t('mode.auto')}
        accessibilityState={{ checked: auto }}
        style={[styles.auto, auto && styles.autoOn]}>
        <View style={[styles.autoDot, { backgroundColor: auto ? colors.ok : colors.textFaint }]} />
        <Text style={[styles.label, auto && styles.labelActive]}>{t('mode.auto')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  segments: {
    flex: 1,
    flexDirection: 'row',
    height: size.touch,
    padding: 3,
    borderRadius: radius.segment,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: { flex: 1, borderRadius: radius.segmentInner, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.chip },
  label: { ...type.button, fontSize: 13, color: colors.textMuted },
  labelActive: { color: colors.text },
  auto: {
    height: size.touch,
    minWidth: 76,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.segment,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  autoOn: { backgroundColor: colors.chip, borderColor: colors.borderStrong },
  autoDot: { width: 6, height: 6, borderRadius: 3 },
});
