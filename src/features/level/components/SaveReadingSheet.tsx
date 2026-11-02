import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, size, space, type } from '../theme/tokens';

type Props = {
  visible: boolean;
  defaultName: string;
  summary: string;
  onCancel: () => void;
  onSave: (name: string) => void;
};

/** Bottom sheet asking for a reading name. */
export function SaveReadingSheet({ visible, defaultName, summary, onCancel, onSave }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(defaultName);
  useEffect(() => {
    if (visible) setName(defaultName);
  }, [visible, defaultName]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onCancel} accessibilityLabel={t('readings.cancel')} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <Text style={styles.title} accessibilityRole="header">
            {t('readings.saveTitle')}
          </Text>
          <Text style={styles.summary}>{summary}</Text>
          <Text style={styles.label}>{t('readings.nameLabel')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={() => onSave(name.trim() || defaultName)}
            style={styles.input}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t('readings.nameLabel')}
          />
          <View style={styles.buttons}>
            <Pressable onPress={onCancel} accessibilityRole="button" style={[styles.btn, styles.secondary]}>
              <Text style={styles.btnText}>{t('readings.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(name.trim() || defaultName)}
              accessibilityRole="button"
              style={[styles.btn, styles.primary]}>
              <Text style={[styles.btnText, styles.primaryText]}>{t('readings.save')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card + 4,
    borderTopRightRadius: radius.card + 4,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.xl,
    gap: space.sm,
  },
  title: { ...type.h2, color: colors.text },
  summary: { ...type.diag, color: colors.textMuted, marginBottom: space.sm },
  label: { ...type.label, color: colors.textMuted },
  input: {
    ...type.body,
    color: colors.text,
    height: size.touch + 4,
    borderRadius: radius.cell,
    backgroundColor: colors.surfaceInset,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: space.md,
  },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  btn: { flex: 1, height: size.primaryButton, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  primary: { backgroundColor: colors.text },
  btnText: { ...type.button, fontSize: 14, color: colors.text },
  primaryText: { color: colors.onPrimary },
});
