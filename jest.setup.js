/* eslint-env jest */
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-localize', () => require('react-native-localize/mock'));
jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: jest.fn() },
  trigger: jest.fn(),
}));
jest.mock('@sayem314/react-native-keep-awake', () => ({
  activateKeepAwake: jest.fn(),
  deactivateKeepAwake: jest.fn(),
}));
jest.mock('react-native-restart', () => ({ __esModule: true, default: { restart: jest.fn() } }));
jest.mock('react-native-mmkv', () => {
  const createMMKV = () => {
    const data = new Map();
    return {
      set: (k, v) => data.set(k, v),
      getString: k => (typeof data.get(k) === 'string' ? data.get(k) : undefined),
      remove: k => data.delete(k),
      clearAll: () => data.clear(),
    };
  };
  return { createMMKV };
});
