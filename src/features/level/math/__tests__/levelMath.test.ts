import {
  alphaFor,
  axisFraction,
  bearingOf,
  compass,
  edgeAngle,
  edgeHintBucket,
  edgePitch,
  flatAngles,
  formatPrimary,
  formatRatio,
  formatSigned,
  levelState,
  magnitudeMs2,
  nextMode,
  nextUnits,
  normalize,
  overLength,
  ratio,
  risePerMeter,
  roundHintMm,
  SIGN,
  slopePercent,
  tableLegCorrections,
  targetOffset,
  twoPointOffset,
  unit,
  vialOffset,
  wrap180,
} from '../levelMath';

const RAD = Math.PI / 180;
const len = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);
/** Canonical up vector for a phone in portrait rotated by `deg` (positive = right side raised). */
const edgeVec = (deg: number) => ({ x: Math.sin(deg * RAD), y: Math.cos(deg * RAD), z: 0 });

describe('normalize', () => {
  it('returns unit length and applies SIGN', () => {
    const v = normalize({ x: 3, y: 4, z: 12 });
    expect(len(v)).toBeCloseTo(1, 10);
    expect(v.x).toBeCloseTo((3 / 13) * SIGN.x);
    expect(v.z).toBeCloseTo((12 / 13) * SIGN.z);
  });
  it.each(['ios', 'android'])(
    'maps a Reanimated (downward) gravity vector in upright portrait to u.y ≈ +1 on %s',
    os => {
      let normalizeFor: typeof normalize = normalize;
      jest.isolateModules(() => {
        jest.doMock('react-native', () => ({ Platform: { OS: os } }));
        normalizeFor = require('../levelMath').normalize;
      });
      // Upright portrait: Reanimated reports gravity along −y (pointing down) on both platforms.
      const u = normalizeFor({ x: 0, y: -9.81, z: 0 });
      expect(u.y).toBeCloseTo(1, 6);
      expect(Math.abs(u.x)).toBeCloseTo(0, 6);
      expect(Math.abs(u.z)).toBeCloseTo(0, 6);
    },
  );
  it('does not throw on a zero vector', () => {
    expect(() => normalize({ x: 0, y: 0, z: 0 })).not.toThrow();
    const v = normalize({ x: 0, y: 0, z: 0 });
    expect(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)).toBe(true);
  });
  it('unit() renormalizes without flipping', () => {
    const v = unit({ x: 0, y: 2, z: 0 });
    expect(v).toEqual({ x: 0, y: 1, z: 0 });
  });
});

describe('alphaFor', () => {
  it('is 0 for dt 0 and ≈0.632 for dt = τ', () => {
    expect(alphaFor(0, 80)).toBe(0);
    expect(alphaFor(80, 80)).toBeCloseTo(0.632, 3);
  });
  it('treats negative dt as 0', () => {
    expect(alphaFor(-5, 80)).toBe(0);
  });
});

describe('wrap180', () => {
  it('wraps into −180..180 with +180 for the boundary', () => {
    expect(wrap180(0)).toBe(0);
    expect(wrap180(190)).toBeCloseTo(-170);
    expect(wrap180(-190)).toBeCloseTo(170);
    expect(wrap180(180)).toBe(180);
    expect(wrap180(-180)).toBe(180);
    expect(wrap180(540)).toBe(180);
  });
});

describe('nextMode', () => {
  it('switches with hysteresis', () => {
    expect(nextMode('edge', 0.8)).toBe('edge');
    expect(nextMode('edge', 0.83)).toBe('flat');
    expect(nextMode('flat', 0.75)).toBe('flat');
    expect(nextMode('flat', 0.69)).toBe('edge');
  });
});

describe('edgeAngle', () => {
  it('upright → 0', () => {
    const r = edgeAngle(edgeVec(0), 0);
    expect(r.angle).toBeCloseTo(0);
    expect(r.q).toBe(0);
  });
  it('+5° and −5°', () => {
    expect(edgeAngle(edgeVec(5), 0).angle).toBeCloseTo(5);
    expect(edgeAngle(edgeVec(-5), 0).angle).toBeCloseTo(-5);
  });
  it('keeps q=0 up to 55°, then switches to q=1', () => {
    expect(edgeAngle(edgeVec(54), 0)).toMatchObject({ q: 0 });
    expect(edgeAngle(edgeVec(54), 0).angle).toBeCloseTo(54);
    const r = edgeAngle(edgeVec(56), 0);
    expect(r.q).toBe(1);
    expect(r.angle).toBeCloseTo(-34);
    const r89 = edgeAngle(edgeVec(89), 0);
    expect(r89.q).toBe(1);
    expect(r89.angle).toBeCloseTo(-1);
  });
  it('landscape both directions', () => {
    const left = edgeAngle(edgeVec(90), 1);
    expect(left).toMatchObject({ q: 1 });
    expect(left.angle).toBeCloseTo(0);
    const right = edgeAngle(edgeVec(-90), 0);
    expect(right.q).toBe(3);
    expect(right.angle).toBeCloseTo(0);
    expect(edgeAngle(edgeVec(-87), 3).angle).toBeCloseTo(3);
  });
  it('wraps at ±180 (upside down)', () => {
    const a = edgeAngle(edgeVec(178), 2);
    expect(a.q).toBe(2);
    expect(a.angle).toBeCloseTo(-2);
    const b = edgeAngle(edgeVec(-178), 2);
    expect(b.q).toBe(2);
    expect(b.angle).toBeCloseTo(2);
    expect(edgeAngle(edgeVec(180), 0).q).toBe(2);
  });
});

describe('edgePitch', () => {
  it('upright → 0, leaning back → positive', () => {
    expect(edgePitch({ x: 0, y: 1, z: 0 })).toBeCloseTo(0);
    expect(edgePitch({ x: 0, y: Math.cos(10 * RAD), z: Math.sin(10 * RAD) })).toBeCloseTo(10);
  });
});

describe('flatAngles', () => {
  it('flat → 0/0/0', () => {
    const r = flatAngles({ x: 0, y: 0, z: 1 });
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
    expect(r.total).toBeCloseTo(0);
  });
  it('right edge up → X > 0, bearing ≈ 90', () => {
    const r = flatAngles({ x: Math.sin(2 * RAD), y: 0, z: Math.cos(2 * RAD) });
    expect(r.x).toBeCloseTo(2);
    expect(r.bearing).toBeCloseTo(90);
    expect(compass(r.bearing)).toBe('E');
  });
  it('top up → Y > 0, bearing ≈ 0', () => {
    const r = flatAngles({ x: 0, y: Math.sin(3 * RAD), z: Math.cos(3 * RAD) });
    expect(r.y).toBeCloseTo(3);
    expect(r.bearing).toBeCloseTo(0);
    expect(compass(r.bearing)).toBe('N');
  });
  it('bearingOf matches compass sectors', () => {
    expect(bearingOf(1, 1)).toBeCloseTo(45);
    expect(compass(bearingOf(1, 1))).toBe('NE');
    expect(compass(bearingOf(-1, 0))).toBe('W');
    expect(compass(359)).toBe('N');
  });
});

describe('units', () => {
  it('0° → 0 %; 45° → 100 %', () => {
    expect(slopePercent(0)).toBe(0);
    expect(slopePercent(45)).toBeCloseTo(100);
  });
  it('1.1° → ≈1.92 %, ≈19.2 mm/m, ratio ≈52.1', () => {
    expect(slopePercent(1.1)).toBeCloseTo(1.92, 2);
    expect(risePerMeter(1.1)).toBeCloseTo(19.2, 1);
    expect(ratio(1.1)!).toBeCloseTo(52.1, 1);
  });
  it('ratio(0) → null and uses |angle|', () => {
    expect(ratio(0)).toBeNull();
    expect(ratio(0.04)).toBeNull();
    expect(ratio(-1.1)!).toBeCloseTo(52.1, 1);
  });
  it('overLength uses |angle|', () => {
    expect(overLength(-1, 600)).toBeCloseTo(10.47, 2);
  });
});

describe('levelState hysteresis', () => {
  it('0.6° is ok when wasLevel (tol 0.5), warn otherwise', () => {
    expect(levelState(0.6, 0.5, true)).toBe('ok');
    expect(levelState(0.6, 0.5, false)).toBe('warn');
  });
  it('bands', () => {
    expect(levelState(0.2, 0.5, false)).toBe('ok');
    expect(levelState(0.71, 0.5, true)).toBe('warn');
    expect(levelState(3, 0.5, false)).toBe('bad');
  });
});

describe('twoPointOffset', () => {
  it('(0.34, 0.26) → 0.30', () => {
    expect(twoPointOffset(0.34, 0.26)).toBeCloseTo(0.3, 10);
  });
});

describe('tableLegCorrections', () => {
  it('flat table → all 0', () => {
    const c = tableLegCorrections(0, 0, 2540, 1270);
    Object.values(c).forEach(v => expect(v).toBeCloseTo(0));
  });
  it('highest corner is 0 and all values are non-negative', () => {
    for (const [x, y] of [[0.3, -0.2], [-1, 0.5], [0.1, 0.1], [-0.4, -0.7]]) {
      const v = Object.values(tableLegCorrections(x, y, 3569, 1778));
      expect(Math.min(...v)).toBeCloseTo(0);
      v.forEach(n => expect(n).toBeGreaterThanOrEqual(0));
    }
  });
});

describe('display helpers', () => {
  it('magnitudeMs2 converts g to m/s²', () => {
    expect(magnitudeMs2({ x: 0, y: 1, z: 0 })).toBeCloseTo(9.80665);
    expect(magnitudeMs2({ x: 0, y: 9.81, z: 0 })).toBeCloseTo(9.81);
  });
  it('formatSigned', () => {
    expect(formatSigned(0.123, 2)).toBe('+0.12');
    expect(formatSigned(-0.5, 1)).toBe('−0.5');
    expect(formatSigned(-0.001, 2)).toBe('+0.00');
  });
  it('formatPrimary per unit', () => {
    expect(formatPrimary(-2.44, 'deg')).toBe('2.4°');
    expect(formatPrimary(1.1, 'percent')).toBe('1.92%');
    expect(formatPrimary(1.1, 'mmPerM')).toBe('19.2');
    expect(formatPrimary(1.1, 'ratio')).toBe('1:52.1');
    expect(formatPrimary(0, 'ratio')).toBe('—');
    expect(formatPrimary(0.1, 'ratio')).toBe('1:573');
  });
  it('formatRatio', () => {
    expect(formatRatio(0.01)).toBe('—');
  });
  it('nextUnits cycles ° → % → mm/m → 1:X → °', () => {
    expect(nextUnits('deg')).toBe('percent');
    expect(nextUnits('percent')).toBe('mmPerM');
    expect(nextUnits('mmPerM')).toBe('ratio');
    expect(nextUnits('ratio')).toBe('deg');
  });
  it('roundHintMm', () => {
    expect(roundHintMm(25.4)).toBe(25);
    expect(roundHintMm(4.26)).toBe(4.3);
    expect(roundHintMm(0.01)).toBe(0.1);
  });
  it('edgeHintBucket: level → 0, right high → raise left (>0), left high → raise right (<0)', () => {
    expect(edgeHintBucket(0.3, true, 600)).toBe(0);
    expect(edgeHintBucket(2.4, false, 600)).toBe(25);
    expect(edgeHintBucket(-2.4, false, 600)).toBe(-25);
  });
  it('vialOffset: ±118 px for ±10°, clamped', () => {
    expect(vialOffset(0)).toBe(0);
    expect(vialOffset(5)).toBeCloseTo(59);
    expect(vialOffset(-10)).toBeCloseTo(-118);
    expect(vialOffset(45)).toBeCloseTo(118);
  });
  it('targetOffset: 23 px/°, y inverted, clamped to radius 115', () => {
    expect(targetOffset(1, 1)).toEqual({ dx: 23, dy: -23 });
    const far = targetOffset(10, 0);
    expect(far.dx).toBeCloseTo(115);
    const diag = targetOffset(10, 10);
    expect(Math.hypot(diag.dx, diag.dy)).toBeCloseTo(115);
  });
  it('axisFraction spans ±5°', () => {
    expect(axisFraction(2.5)).toBe(0.5);
    expect(axisFraction(-9)).toBe(-1);
  });
});
