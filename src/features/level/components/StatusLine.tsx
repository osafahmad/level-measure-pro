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
    <View>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: live ? colors.ok : colors.textFaint }]} />
        <AnimatedText text={text} style={styles.text} multiline />
      </View>
      <View style={styles.reserve} />
    </View>
  );
}

const TEXT_MIN_WIDTH = 200;
const DOT = 6;
const GAP = 6;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: GAP, marginTop: 2 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  text: { ...type.status, color: colors.textMuted, flexGrow: 1, flexShrink: 1 },
  // Zero-height: asks the header for room for a 200 pt line, so the line is exactly as wide as before
  // wherever that fits. Where it does not (narrow phones, large text), the header gives less and the
  // line shrinks and wraps instead of running under the header buttons.
  reserve: { width: DOT + GAP + TEXT_MIN_WIDTH, height: 0 },
});
