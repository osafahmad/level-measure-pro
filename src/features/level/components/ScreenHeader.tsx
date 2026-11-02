import React from 'react';
import { I18nManager, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { colors, space, type } from '../theme/tokens';
import { IconButton } from './IconButton';

/** Back button (44) + title, for pushed screens. */
export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = useTranslation();
  const Chevron = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  return (
    <View style={styles.row}>
      <IconButton onPress={onBack} accessibilityLabel={t('a11y.back')}>
        <Chevron color={colors.text} size={20} strokeWidth={1.8} />
      </IconButton>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { ...type.title, color: colors.text },
});
