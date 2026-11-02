import React from 'react';
import { StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { ltr } from '../theme/tokens';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Props = {
  text: SharedValue<string>;
  style?: StyleProp<TextStyle>;
  color?: SharedValue<string>;
  accessibilityLabel?: string;
  multiline?: boolean;
};

/** Text updated on the UI thread every frame without a React render. Always LTR. */
export function AnimatedText({ text, style, color, accessibilityLabel, multiline }: Props) {
  const animatedProps = useAnimatedProps(() => ({ text: text.value, defaultValue: text.value }) as any);
  const colorStyle = useAnimatedStyle(() => (color ? { color: color.value } : {}));
  return (
    <AnimatedTextInput
      editable={false}
      multiline={multiline}
      scrollEnabled={false}
      pointerEvents="none"
      underlineColorAndroid="transparent"
      animatedProps={animatedProps}
      accessibilityLabel={accessibilityLabel}
      style={[styles.base, style, colorStyle]}
    />
  );
}

const styles = StyleSheet.create({
  base: { padding: 0, margin: 0, ...ltr },
});
