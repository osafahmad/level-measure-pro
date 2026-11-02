import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdBannerSlot } from '../AdBannerSlot';
import { useAdsStore } from '../adsStore';
import { adsConfig } from '../config';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

async function renderSlot() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AdBannerSlot placement="Level" />
    </SafeAreaProvider>,
  );
}

const banner = () => screen.queryByTestId('BannerAd');

beforeEach(() => {
  jest.useFakeTimers();
  useAdsStore.setState({ phase: 'ready' });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AdBannerSlot', () => {
  it('requests nothing until consent made ads ready', async () => {
    useAdsStore.setState({ phase: 'consent' });
    await renderSlot();
    expect(banner()).toBeNull();
  });

  it('mounts an anchored adaptive banner with the test unit in development', async () => {
    await renderSlot();
    expect(banner()?.props.size).toBe('LARGE_ANCHORED_ADAPTIVE_BANNER');
    expect(banner()?.props.unitId).toBe('test/banner');
  });

  it('reclaims the space when nothing loads, then retries later', async () => {
    await renderSlot();
    await act(async () => banner()?.props.onAdFailedToLoad(new Error('no-fill')));
    expect(banner()).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(adsConfig.banner.retryDelayMs);
    });
    expect(banner()).not.toBeNull();
  });

  it('keeps a loaded creative when a later refresh fails', async () => {
    await renderSlot();
    await act(async () => banner()?.props.onAdLoaded({ width: 390, height: 62 }));
    await act(async () => banner()?.props.onAdFailedToLoad(new Error('refresh failed')));
    expect(banner()).not.toBeNull();
  });

  it('unmounts the banner when consent is withdrawn', async () => {
    await renderSlot();
    expect(banner()).not.toBeNull();
    await act(async () => useAdsStore.setState({ phase: 'blocked' }));
    expect(banner()).toBeNull();
  });
});
