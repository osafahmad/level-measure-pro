import React from 'react';
import { Alert, I18nManager, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react-native';
import RNRestart from 'react-native-restart';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DevAdsTools, markJsReload, usePrivacyOptions } from '../../ads';
import { IconButton } from '../components/IconButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Segmented } from '../components/Segmented';
import i18n, { applyDirection, directionMatches, type Language } from '../i18n';
import { UNITS_CYCLE, type Units } from '../math/levelMath';
import type { LevelScreenProps } from '../navigation';
import { openPrivacyPolicy } from '../platform/links';
import { useCalibration } from '../state/calibrationStore';
import {
  FRAME_WIDTH_MAX_MM,
  FRAME_WIDTH_MIN_MM,
  SMOOTHINGS,
  TOLERANCES,
  useSettings,
  type Smoothing,
  type Tolerance,
} from '../state/settingsStore';
import { colors, ltr, radius, size, space, type } from '../theme/tokens';
import { APP_VERSION } from '../../../appVersion';

const FRAME_STEP_MM = 50;
const SMOOTHING_KEY: Record<Smoothing, string> = {
  fast: 'settings.smoothingFast',
  normal: 'settings.smoothingNormal',
  steady: 'settings.smoothingSteady',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Item({ label, hint, children, first }: { label: string; hint?: string; children?: React.ReactNode; first?: boolean }) {
  return (
    <View style={[styles.item, !first && styles.divider]}>
      <View style={styles.itemHead}>
        <View style={styles.itemText}>
          <Text style={styles.itemLabel}>{label}</Text>
          {hint ? <Text style={styles.itemHint}>{hint}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function ToggleItem({
  label,
  hint,
  value,
  onChange,
  first,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  first?: boolean;
}) {
  return (
    <View style={[styles.item, !first && styles.divider, styles.rowItem]}>
      <View style={styles.itemText}>
        <Text style={styles.itemLabel}>{label}</Text>
        {hint ? <Text style={styles.itemHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.chip, true: colors.ok }}
        thumbColor={colors.text}
        ios_backgroundColor={colors.chip}
      />
    </View>
  );
}

function LinkItem({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const Chevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.item, styles.divider, styles.rowItem, pressed && styles.pressed]}>
      <Text style={[styles.itemLabel, danger && { color: colors.bad }]}>{label}</Text>
      {!danger ? <Chevron color={colors.textMuted} size={18} strokeWidth={1.8} /> : null}
    </Pressable>
  );
}

export function SettingsScreen({ navigation }: LevelScreenProps<'Settings'>) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const st = useSettings();
  const resetCalibration = useCalibration(c => c.reset);
  const privacyOptions = usePrivacyOptions();

  const setFrame = (mm: number) =>
    st.update({ frameWidthMm: Math.min(FRAME_WIDTH_MAX_MM, Math.max(FRAME_WIDTH_MIN_MM, mm)) });

  const confirmReset = () =>
    Alert.alert(t('settings.resetConfirmTitle'), t('settings.resetConfirmBody'), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('settings.reset'), style: 'destructive', onPress: resetCalibration },
    ]);

  const setLanguage = (lang: Language) => {
    if (lang === st.language) return;
    st.update({ language: lang });
    i18n.changeLanguage(lang);
    applyDirection(lang);
    if (!directionMatches(lang)) {
      // Layout direction only changes after a reload; ask first (architecture.md § 5).
      Alert.alert(i18n.t('settings.restartTitle'), i18n.t('settings.restartBody'), [
        { text: i18n.t('settings.later'), style: 'cancel' },
        {
          text: i18n.t('settings.restartNow'),
          onPress: () => {
            markJsReload(); // a reload is not a new launch for App Open ads
            RNRestart.restart();
          },
        },
      ]);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <ScreenHeader title={t('settings.title')} onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        <Section title={t('settings.measurement')}>
          <Item label={t('settings.tolerance')} first>
            <Segmented<Tolerance>
              mono
              accessibilityLabel={t('settings.tolerance')}
              value={st.tolerance}
              onChange={v => st.update({ tolerance: v })}
              options={TOLERANCES.map(v => ({ value: v, label: `${v === 1 ? '1.0' : v}°` }))}
            />
          </Item>
          <Item label={t('settings.smoothing')}>
            <Segmented<Smoothing>
              accessibilityLabel={t('settings.smoothing')}
              value={st.smoothing}
              onChange={v => st.update({ smoothing: v })}
              options={SMOOTHINGS.map(v => ({ value: v, label: t(SMOOTHING_KEY[v]) }))}
            />
          </Item>
          <Item label={t('settings.frameWidth')} hint={t('settings.frameWidthHint')}>
            <View style={styles.stepper}>
              <IconButton onPress={() => setFrame(st.frameWidthMm - FRAME_STEP_MM)} accessibilityLabel={t('a11y.decrease')}>
                <Minus color={colors.text} size={18} strokeWidth={1.8} />
              </IconButton>
              <Text style={styles.stepValue} accessibilityLiveRegion="polite">
                {Math.round(st.frameWidthMm / 10)} {t('settings.cm')}
              </Text>
              <IconButton onPress={() => setFrame(st.frameWidthMm + FRAME_STEP_MM)} accessibilityLabel={t('a11y.increase')}>
                <Plus color={colors.text} size={18} strokeWidth={1.8} />
              </IconButton>
            </View>
          </Item>
          <Item label={t('settings.units')}>
            <Segmented<Units>
              mono
              accessibilityLabel={t('settings.units')}
              value={st.units}
              onChange={v => st.update({ units: v })}
              options={UNITS_CYCLE.map(u => ({ value: u, label: t(`units.short.${u}`), a11y: t(`units.name.${u}`) }))}
            />
          </Item>
          <LinkItem label={t('settings.calibration')} onPress={() => navigation.navigate('Calibrate')} />
          <LinkItem label={t('settings.resetCalibration')} onPress={confirmReset} danger />
        </Section>

        <Section title={t('settings.feedback')}>
          <ToggleItem first label={t('settings.haptics')} value={st.haptics} onChange={v => st.update({ haptics: v })} />
          <ToggleItem
            label={t('settings.degreeTicks')}
            hint={t('settings.degreeTicksHint')}
            value={st.degreeTicks}
            onChange={v => st.update({ degreeTicks: v })}
          />
        </Section>

        <Section title={t('settings.display')}>
          <ToggleItem first label={t('settings.keepAwake')} value={st.keepAwake} onChange={v => st.update({ keepAwake: v })} />
        </Section>

        <Section title={t('settings.language')}>
          {(['en', 'ur'] as Language[]).map((lang, i) => (
            <Pressable
              key={lang}
              onPress={() => setLanguage(lang)}
              accessibilityRole="radio"
              accessibilityState={{ checked: st.language === lang }}
              style={({ pressed }) => [styles.item, styles.rowItem, i > 0 && styles.divider, pressed && styles.pressed]}>
              <Text style={styles.itemLabel}>{t(lang === 'en' ? 'settings.english' : 'settings.urdu')}</Text>
              {st.language === lang ? <Check color={colors.ok} size={18} strokeWidth={2} /> : null}
            </Pressable>
          ))}
        </Section>

        <Section title={t('settings.about')}>
          <View style={[styles.item, styles.rowItem]}>
            <Text style={styles.itemLabel}>{t('settings.version')}</Text>
            <Text style={styles.mono}>{APP_VERSION}</Text>
          </View>
          <Item label={t('settings.accuracy')} hint={t('settings.accuracyNote')} />
          <Item label={t('settings.privacy')} hint={t('settings.privacyNote')} />
          <LinkItem label={t('settings.privacyPolicy')} onPress={openPrivacyPolicy} />
          {privacyOptions.required ? <LinkItem label={t('ads.privacyChoices')} onPress={privacyOptions.open} /> : null}
        </Section>
        {__DEV__ ? <DevAdsTools /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.xl },
  scroll: { flex: 1, marginHorizontal: -space.xl, marginTop: space.sm },
  section: { marginTop: space.xl },
  sectionTitle: { ...type.overline, color: colors.textMuted, marginBottom: space.sm, marginHorizontal: space.xs },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },
  item: { paddingVertical: space.md, gap: space.sm, minHeight: size.touch + 8, justifyContent: 'center' },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { opacity: 0.7 },
  itemHead: { flexDirection: 'row', alignItems: 'center' },
  itemText: { flex: 1, gap: 2, paddingRight: space.md },
  itemLabel: { ...type.body, color: colors.text },
  itemHint: { ...type.label, fontSize: 12, lineHeight: 17, color: colors.textMuted },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', direction: 'ltr' },
  stepValue: { ...type.value, color: colors.text, ...ltr },
  mono: { ...type.valueSm, color: colors.textMuted, ...ltr },
});
