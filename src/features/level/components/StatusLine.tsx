import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { colors, type } from '../theme/tokens';
import { AnimatedText } from './AnimatedText';

type Props = {
  rateHz: SharedValue<number>;
  /** Calibration state: "Calibrated", "Zero set (REL)" or "Not calibrated". Omitted on the held screen. */
  accuracy?: string;
  live: boolean;
  liveLabel: string;
  hzLabel: string;
  /** Held screen: the live value shown next to LIVE. */
  liveValue?: SharedValue<string>;
};

/** Green dot + `LIVE · <measured rate> Hz · Calibrated` (mono 11, textMuted). */
export function StatusLine({ rateHz, accuracy, live, liveLabel, hzLabel, liveValue }: Props) {
  const text = useDerivedValue(() => {
    const hz = rateHz.value > 0 ? Math.round(rateHz.value).toString() : '—';
    const head = liveValue ? `${liveLabel} ${liveValue.value}` : liveLabel;
    return accuracy ? `${head} · ${hz} ${hzLabel} · ${accuracy}` : `${head} · ${hz} ${hzLabel}`;
  });
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: live ? colors.ok : colors.textFaint }]} />
      <AnimatedText text={text} style={styles.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...type.status, color: colors.textMuted, minWidth: 200 },
});
