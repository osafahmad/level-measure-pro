import HapticFeedback from 'react-native-haptic-feedback';

const options = { enableVibrateFallback: false, ignoreAndroidSystemSettings: false };

export const haptics = {
  /** Reached level. */
  success() {
    HapticFeedback.trigger('notificationSuccess', options);
  },
  /** Degree tick while tilting. */
  tick() {
    HapticFeedback.trigger('selection', options);
  },
  /** Button feedback (capture, hold). */
  light() {
    HapticFeedback.trigger('impactLight', options);
  },
};
