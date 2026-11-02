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
jest.mock('react-native-permissions', () => require('react-native-permissions/mock'));
jest.mock('react-native-google-mobile-ads', () => {
  const React = require('react');
  const { View } = require('react-native');
  const AdEventType = { LOADED: 'loaded', ERROR: 'error', OPENED: 'opened', CLOSED: 'closed', CLICKED: 'clicked', PAID: 'paid' };
  class AppOpenAd {
    constructor(adUnitId) {
      this.adUnitId = adUnitId;
      this.listeners = {};
      this.loaded = false;
      this.load = jest.fn();
      this.show = jest.fn(() => Promise.resolve());
      this.destroy = jest.fn();
    }
    addAdEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
      return () => {};
    }
    /** Test helper: fire an ad event. */
    emit(type, payload) {
      if (type === AdEventType.LOADED) this.loaded = true;
      (this.listeners[type] || []).forEach(fn => fn(payload));
    }
  }
  AppOpenAd.instances = [];
  AppOpenAd.createForAdRequest = jest.fn(unitId => {
    const ad = new AppOpenAd(unitId);
    AppOpenAd.instances.push(ad);
    return ad;
  });
  class BannerAd extends React.Component {
    load = jest.fn();
    render() {
      return React.createElement(View, { ...this.props, testID: 'BannerAd' });
    }
  }
  const sdk = {
    initialize: jest.fn(() => Promise.resolve([])),
    setRequestConfiguration: jest.fn(() => Promise.resolve()),
  };
  const info = { status: 'OBTAINED', canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED', isConsentFormAvailable: false };
  return {
    __esModule: true,
    default: () => sdk,
    AdEventType,
    AppOpenAd,
    BannerAd,
    BannerAdSize: { LARGE_ANCHORED_ADAPTIVE_BANNER: 'LARGE_ANCHORED_ADAPTIVE_BANNER' },
    TestIds: { ADAPTIVE_BANNER: 'test/banner', APP_OPEN: 'test/app-open' },
    AdsConsentDebugGeography: { DISABLED: 0, EEA: 1, NOT_EEA: 2 },
    AdsConsentPrivacyOptionsRequirementStatus: { UNKNOWN: 'UNKNOWN', REQUIRED: 'REQUIRED', NOT_REQUIRED: 'NOT_REQUIRED' },
    AdsConsent: {
      gatherConsent: jest.fn(() => Promise.resolve(info)),
      getConsentInfo: jest.fn(() => Promise.resolve(info)),
      getGdprApplies: jest.fn(() => Promise.resolve(false)),
      getPurposeConsents: jest.fn(() => Promise.resolve('')),
      showPrivacyOptionsForm: jest.fn(() => Promise.resolve(info)),
      reset: jest.fn(),
    },
    useForeground: jest.fn(),
  };
});
