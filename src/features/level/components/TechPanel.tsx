import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { colors, ltr, radius, space, type } from '../theme/tokens';
import { AnimatedText } from './AnimatedText';

export type TechCell = { key: string; label: string; value: SharedValue<string> | string };

type Props = {
  title: string;
  /** Right side of the title row: plain text with a tone, or a UI-thread value. */
  status?: { text: string; tone: 'ok' | 'warn' | 'muted' } | SharedValue<string>;
  cells: TechCell[];
  diagnostics?: SharedValue<string>;
};

const TONE = { ok: colors.ok, warn: colors.warn, muted: colors.textMuted };

function isText(v: unknown): v is string {
  return typeof v === 'string';
}

/** Card: title row + 3-column grid of label/value cells + optional diagnostics row. */
export function TechPanel({ title, status, cells, diagnostics }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {status && 'tone' in status ? (
          <Text style={[styles.status, { color: TONE[status.tone] }]}>{status.text}</Text>
        ) : status ? (
          <AnimatedText text={status as SharedValue<string>} style={[styles.status, styles.statusMono]} />
        ) : null}
      </View>
      <View style={styles.grid}>
        {cells.map(c => (
          <View key={c.key} style={styles.cell} accessible accessibilityLabel={c.label}>
            <Text style={styles.label} numberOfLines={1}>
              {c.label}
            </Text>
            {isText(c.value) ? (
              <Text style={styles.value} numberOfLines={1}>
                {c.value}
              </Text>
            ) : (
              <AnimatedText text={c.value} style={styles.value} />
            )}
          </View>
        ))}
      </View>
      {diagnostics ? <AnimatedText text={diagnostics} style={styles.diag} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: space.md + 2,
    gap: space.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.cardTitle, color: colors.textSecondary },
  status: { ...type.label, fontSize: 12 },
  statusMono: { ...type.diag, color: colors.textMuted, textAlign: 'right', minWidth: 140 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: colors.surfaceInset,
    borderRadius: radius.cell,
    paddingVertical: space.sm + 1,
    paddingHorizontal: space.md - 2,
    gap: 3,
  },
  label: { ...type.label, color: colors.textMuted },
  value: { ...type.value, color: colors.text, ...ltr, textAlign: 'left' },
  diag: { ...type.diag, color: colors.textFaint, letterSpacing: 0.3 },
});
