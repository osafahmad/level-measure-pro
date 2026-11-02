import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, type SharedValue } from 'react-native-reanimated';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { clamp } from '../math/levelMath';
import { colors, fonts, size } from '../theme/tokens';
import { Fit } from './Fit';
import { NEEDLE_SPRING, useFollow } from './useFollow';

const W = size.dialW; // 350
const H = size.dialH; // 200
const CX = 175;
const CY = 190;
const DEG_PER_UNIT = 6; // ±15° → ±90° on the dial

function pt(r: number, a: number) {
  const th = (a * DEG_PER_UNIT * Math.PI) / 180;
  return { x: CX + r * Math.sin(th), y: CY - r * Math.cos(th) };
}

function arc(r: number, a1: number, a2: number) {
  const p1 = pt(r, a1);
  const p2 = pt(r, a2);
  const large = (a2 - a1) * DEG_PER_UNIT > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
}

const TICKS = Array.from({ length: 31 }, (_, i) => i - 15);
const LABELS = [-10, -5, 0, 5, 10];

/** Static dial art: drawn once per tolerance, never per frame. */
const DialArt = memo(function DialArtImpl({ tolerance }: { tolerance: number }) {
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Path d={arc(158, -15, 15)} stroke={colors.dialTrack} strokeWidth={10} fill="none" />
      <Path d={arc(158, -3, -tolerance)} stroke={colors.warn} strokeOpacity={0.35} strokeWidth={10} fill="none" />
      <Path d={arc(158, tolerance, 3)} stroke={colors.warn} strokeOpacity={0.35} strokeWidth={10} fill="none" />
      <Path d={arc(158, -tolerance, tolerance)} stroke={colors.ok} strokeWidth={10} fill="none" />
      {TICKS.map(a => {
        const major = a % 5 === 0;
        const p1 = pt(150, a);
        const p2 = pt(major ? 132 : 141, a);
        return (
          <Line
            key={a}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={major ? colors.tickMajor : colors.tickMinor}
            strokeWidth={major ? 2 : 1.2}
          />
        );
      })}
      {LABELS.map(a => {
        const p = pt(118, a);
        return (
          <SvgText
            key={a}
            x={p.x}
            y={p.y + 3.5}
            fontSize={10}
            fontFamily={fonts.mono}
            fill={a === 0 ? colors.text : colors.textFaint}
            textAnchor="middle">
            {Math.abs(a)}
          </SvgText>
        );
      })}
    </Svg>
  );
});

type Props = {
  angle: SharedValue<number>;
  tolerance: number;
  color: SharedValue<string>;
  accessibilityLabel?: string;
  /** Readout + overline, placed inside the arc. */
  children?: React.ReactNode;
};

/** Semicircle dial ±15° with an animated needle (a rotated view, not re-rendered SVG). */
export function AngleDial({ angle, tolerance, color, accessibilityLabel, children }: Props) {
  const reduceMotion = useReducedMotion();
  const rot = useFollow(
    () => {
      'worklet';
      return clamp(angle.value, -15, 15) * DEG_PER_UNIT;
    },
    NEEDLE_SPRING,
    reduceMotion,
  );
  const needleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const tipColor = useAnimatedStyle(() => ({ backgroundColor: color.value }));

  return (
    <Fit width={W} height={H}>
      <View accessible accessibilityLabel={accessibilityLabel} style={styles.box}>
        <DialArt tolerance={tolerance} />
        {/* 3 px arm whose bottom sits on the dial center; visible part r 104 → 158. */}
        <Animated.View pointerEvents="none" style={[styles.needle, needleStyle]}>
          <Animated.View style={[styles.needleLine, tipColor]} />
          <Animated.View style={[styles.needleTip, tipColor]} />
        </Animated.View>
        <View style={styles.readout} pointerEvents="box-none">
          {children}
        </View>
      </View>
    </Fit>
  );
}

const styles = StyleSheet.create({
  box: { width: W, height: H },
  needle: {
    position: 'absolute',
    left: CX - 1.5,
    top: CY - 158,
    width: 3,
    height: 158,
    transformOrigin: 'bottom',
  },
  needleLine: { width: 3, height: 54, borderRadius: 1.5 },
  needleTip: { position: 'absolute', top: -5, left: -3.5, width: 10, height: 10, borderRadius: 5 },
  readout: { position: 'absolute', left: 0, right: 0, top: 94, alignItems: 'center' },
});
