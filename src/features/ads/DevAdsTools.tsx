import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAdsStore } from './adsStore';
import { adsConfig } from './config';
import { resetConsentForTesting } from './consent';
import { colors, radius, size, space, type } from '../level/theme/tokens';

/** __DEV__ only: consent state and a reset, for GDPR testing. Renders nothing in release. */
export function DevAdsTools() {
  const { t } = useTranslation();
  const phase = useAdsStore(s => s.phase);
  if (!__DEV__) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        {t('ads.devTitle')}
      </Text>
      <View style={styles.card}>
        <Text style={styles.line}>{t('ads.devPhase', { value: phase })}</Text>
        <Text style={styles.line}>{t('ads.devGeography', { value: adsConfig.debug.geography ?? '—' })}</Text>
        <Pressable onPress={resetConsentForTesting} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <Text style={styles.action}>{t('ads.devResetConsent')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl },
  title: { ...type.overline, color: colors.textMuted, marginBottom: space.sm, marginHorizontal: space.xs },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.sm,
  },
  line: { ...type.diag, color: colors.textFaint },
  row: { minHeight: size.touch, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  action: { ...type.body, color: colors.warn },
});
