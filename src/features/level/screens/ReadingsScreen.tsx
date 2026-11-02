import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { formatReadingTime, ReadingRow } from '../components/ReadingRow';
import { ScreenHeader } from '../components/ScreenHeader';
import { formatRatio, formatSigned, risePerMeter, type Units } from '../math/levelMath';
import type { LevelScreenProps } from '../navigation';
import { useReadings, type Reading } from '../state/readingsStore';
import { useSettings } from '../state/settingsStore';
import { colors, ltr, radius, space, type } from '../theme/tokens';

function Details({ r }: { r: Reading }) {
  const { t } = useTranslation();
  const rows: [string, string][] = [
    [t('panel.angle'), `${r.mode === 'edge' ? formatSigned(r.angle, 2) : Math.abs(r.angle).toFixed(2)}°`],
    [t('panel.slope'), `${r.slopePct.toFixed(2)}%`],
    [t('panel.rise'), `${risePerMeter(r.angle).toFixed(1)} mm/m`],
    [t('panel.ratio'), formatRatio(r.angle)],
  ];
  if (r.x != null && r.y != null) {
    rows.push(['X', `${formatSigned(r.x, 2)}°`], ['Y', `${formatSigned(r.y, 2)}°`]);
  }
  rows.push([t('readings.sigma'), `${r.sigma.toFixed(2)}°`], [t('readings.time'), formatReadingTime(r.createdAt)]);
  return (
    <View style={styles.details}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.detailRow}>
          <Text style={styles.detailLabel}>{label}</Text>
          <Text style={styles.detailValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function Row({ r, expanded, onToggle, tolerance, units }: { r: Reading; expanded: boolean; onToggle: () => void; tolerance: number; units: Units }) {
  const { t } = useTranslation();
  const remove = useReadings(st => st.remove);
  return (
    <Swipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={() => remove(r.id)}
          accessibilityRole="button"
          accessibilityLabel={`${t('readings.delete')} ${r.name}`}
          style={styles.delete}>
          <Trash2 color={colors.bad} size={18} strokeWidth={1.8} />
          <Text style={styles.deleteText}>{t('readings.delete')}</Text>
        </Pressable>
      )}>
      <View
        style={styles.item}
        accessibilityActions={[{ name: 'delete', label: t('readings.delete') }]}
        onAccessibilityAction={e => {
          if (e.nativeEvent.actionName === 'delete') remove(r.id);
        }}>
        <ReadingRow reading={r} tolerance={tolerance} units={units} onPress={onToggle} />
        {expanded ? <Details r={r} /> : null}
      </View>
    </Swipeable>
  );
}

export function ReadingsScreen({ navigation }: LevelScreenProps<'Readings'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const readings = useReadings(st => st.readings);
  const { tolerance, units } = useSettings(useShallow(st => ({ tolerance: st.tolerance, units: st.units })));
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <ScreenHeader title={t('readings.title')} onBack={() => navigation.goBack()} />
      <FlatList
        data={readings}
        keyExtractor={r => r.id}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: insets.bottom + 12, gap: space.sm }}
        ListEmptyComponent={<Text style={styles.empty}>{t('readings.empty')}</Text>}
        renderItem={({ item }) => (
          <Row
            r={item}
            expanded={open === item.id}
            onToggle={() => setOpen(o => (o === item.id ? null : item.id))}
            tolerance={tolerance}
            units={units}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl },
  list: { marginTop: space.lg },
  item: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },
  details: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: space.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { ...type.body, fontSize: 13, color: colors.textMuted },
  detailValue: { ...type.valueSm, color: colors.text, ...ltr },
  delete: {
    width: 96,
    marginLeft: space.sm,
    borderRadius: radius.card,
    backgroundColor: colors.badTint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteText: { ...type.button, color: colors.bad },
  empty: { ...type.body, color: colors.textFaint, textAlign: 'center', marginTop: space.xxl * 2 },
});
