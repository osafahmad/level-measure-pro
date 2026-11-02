import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { BannerAd, BannerAdSize, useForeground } from 'react-native-google-mobile-ads';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdsStore } from './adsStore';
import { adsConfig, unitId, type AdScreen } from './config';

type Status = 'loading' | 'shown' | 'failed';

/**
 * Anchored adaptive banner (docs: LARGE_ANCHORED_ADAPTIVE_BANNER) that also owns the bottom safe
 * area, so the screen above lays out the same with or without an ad. Only the ad's own height is
 * animated in and out: content above glides instead of jumping, and the space is reclaimed when
 * nothing could be loaded. A creative already on screen survives refresh/reload failures.
 */
function BannerSlot({ placement }: { placement: AdScreen }) {
  const { width } = useWindowDimensions();
  const bannerRef = useRef<BannerAd>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);
  const [adHeight, setAdHeight] = useState(0);
  const height = useSharedValue(0);

  useEffect(() => {
    height.value = withTiming(status === 'shown' ? adHeight : 0, { duration: adsConfig.banner.animationMs });
  }, [status, adHeight, height]);

  useEffect(() => {
    if (status !== 'failed') return;
    const id = setTimeout(() => {
      setStatus('loading');
      setAttempt(a => a + 1);
    }, adsConfig.banner.retryDelayMs);
    return () => clearTimeout(id);
  }, [status]);

  useForeground(() => {
    if (status === 'failed') {
      setStatus('loading');
      setAttempt(a => a + 1);
    } else if (Platform.OS === 'ios' && status === 'shown') {
      // iOS may terminate the banner's WKWebView in the background (docs, "Banner ads").
      try {
        bannerRef.current?.load();
      } catch {}
    }
  });

  // The SDK reports the creative's size; a zero-height clip would squeeze an onLayout measurement.
  const onSize = ({ height: h }: { height: number }) => {
    if (h > 0) setAdHeight(Math.ceil(h));
  };
  const animated = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View style={[styles.clip, animated]} testID={`ad-banner-${placement}`}>
      {status !== 'failed' ? (
        <View style={styles.ad}>
          <BannerAd
            key={`${width}-${attempt}`}
            ref={bannerRef}
            unitId={unitId('banner')}
            size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
            onAdLoaded={d => {
              onSize(d);
              setStatus('shown');
            }}
            onSizeChange={onSize}
            onAdFailedToLoad={() => setStatus(s => (s === 'shown' ? s : 'failed'))}
          />
        </View>
      ) : null}
    </Animated.View>
  );
}

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    if (__DEV__) console.warn('[ads] banner crashed', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Props = { placement: AdScreen; style?: StyleProp<ViewStyle> };

/** Place at the very bottom of a screen, in place of its bottom safe-area padding. */
export function AdBannerSlot({ placement, style }: Props) {
  const insets = useSafeAreaInsets();
  const phase = useAdsStore(s => s.phase);
  const active = adsConfig.enabled && phase === 'ready' && adsConfig.bannerScreens.includes(placement);
  return (
    <View style={[{ paddingBottom: insets.bottom }, style]}>
      {active ? (
        <Boundary>
          <BannerSlot placement={placement} />
        </Boundary>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', alignSelf: 'stretch' },
  // Absolute, so the creative keeps its natural size while the clip animates from 0.
  ad: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
});
