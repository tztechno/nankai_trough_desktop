import { FaultParams } from '../types';

/**
 * 内閣府「南海トラフの巨大地震モデル検討会」第二次報告 津波断層モデル編 (2012) の概略再現
 *
 * 公式の津波断層モデル (約5kmメッシュの小断層データ) は申請制のため、報告書本文に記載された設定ルールから
 * 矩形小断層の集合として近似的に構成する。
 *  - 想定震源域: 駿河湾〜日向灘、トラフ軸からプレート境界深さ約37kmまで (公式: 面積 1.4×10^11 m², Mw9.1)
 *  - 主部断層 (深さ10km以深) の平均すべり量 10m
 *  - 大すべり域 = 平均の2倍 (約20m)、超大すべり域 = 平均の4倍 (約40m)。超大すべり域を含む大すべり域の面積は全体の約20%で、
 *    深さ約20kmからトラフ軸までの矩形とする
 *  - トラフ沿い (深さ10km以浅) は超大すべり域以外ではすべり0。超大すべり域の主部断層側の段は大すべりとの中間値
 *  - 駿河湾内の超大すべり域は大すべり域と同じすべり量
 *  - 最深部はすべりを低減 (公式: 最深の段 1/4、次の段 1/2)
 *  - 破壊は大すべり域中心付近の深さ約20kmから開始し、破壊伝播速度 2.5km/s、ライズタイム 1分
 * 公式モデルとの主な違い: プレート形状は一様な傾斜の帯で近似、すべり量のプレート沈み込み速度比例配分は省略、
 * 大すべり域境界の平滑化は省略。
 */

// トラフ軸 (東→西)。海底地形 (japan.tif) の陸側斜面の基部 (水深約4000m) から読み取った概略位置
const TROUGH_AXIS: [number, number][] = [
  [138.62, 35.05], // 駿河湾奥
  [138.55, 34.6],
  [138.35, 34.05],
  [138.0, 33.65],
  [137.5, 33.45],
  [137.0, 33.0],
  [136.5, 32.85],
  [136.0, 32.65],
  [135.5, 32.6],
  [135.0, 32.55],
  [134.5, 32.2],
  [134.0, 31.95],
  [133.5, 31.65],
  [133.0, 31.2],
  [132.5, 31.0],
  [132.0, 30.85] // 日向灘南部
];

// トラフ軸から陸側への帯 (水平距離 km, 上端・下端のプレート境界深さ km)
interface Strip {
  key: 'T1' | 'T2' | 'B' | 'C' | 'D';
  h0: number;
  h1: number;
  z0: number;
  z1: number;
}
const STRIPS: Strip[] = [
  { key: 'T1', h0: 0, h1: 22, z0: 2, z1: 5.5 },   // トラフ沿い (超大すべり域になりうる浅い段)
  { key: 'T2', h0: 22, h1: 45, z0: 5.5, z1: 10 }, // トラフ沿い (主部断層側の段)
  { key: 'B', h0: 45, h1: 95, z0: 10, z1: 20 },   // 主部断層の浅い側 (大すべり域になりうる)
  { key: 'C', h0: 95, h1: 140, z0: 20, z1: 30 },  // 主部断層 背景
  { key: 'D', h0: 140, h1: 172, z0: 30, z1: 37 }  // 主部断層 最深部 (すべり低減)。全体面積が公式の約14万km²になる幅
];

const MAIN_MEAN_SLIP = 10;      // 主部断層の平均すべり量 (m)
const LARGE_SLIP = 2 * MAIN_MEAN_SLIP;
const SUPER_SLIP = 4 * MAIN_MEAN_SLIP;
const DEEP_REDUCTION = 0.85;    // 最深の帯 (最深1段 1/4, 次の段 1/2 を帯全体で平均した低減率)
const LARGE_AREA_RATIO = 0.2;   // 超大すべり域を含む大すべり域の面積比
const SEGMENT_KM = 25;          // 走向方向の小断層の長さ (km)

const KM_PER_DEG_LAT = 111.32;

function toXY(lon: number, lat: number, lat0: number): [number, number] {
  return [lon * KM_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180), lat * KM_PER_DEG_LAT];
}

interface AxisSegment {
  lon: number;   // 中点
  lat: number;
  s: number;     // 東端からのトラフ沿い距離 (中点, km)
  length: number;
  strikeDeg: number;
  suruga: boolean;
}

/**
 * トラフ軸を約25kmごとの小区間に分割
 */
function buildAxisSegments(): { segments: AxisSegment[]; totalKm: number } {
  const lat0 = 33;
  const pts = TROUGH_AXIS.map(([lon, lat]) => toXY(lon, lat, lat0));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const totalKm = cum[cum.length - 1];
  const n = Math.round(totalKm / SEGMENT_KM);
  const segLen = totalKm / n;

  const pointAt = (s: number): [number, number] => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
    const [lonA, latA] = TROUGH_AXIS[i - 1];
    const [lonB, latB] = TROUGH_AXIS[i];
    return [lonA + t * (lonB - lonA), latA + t * (latB - latA)];
  };

  const segments: AxisSegment[] = [];
  for (let k = 0; k < n; k++) {
    const sMid = (k + 0.5) * segLen;
    const [lonA, latA] = pointAt(k * segLen);
    const [lonB, latB] = pointAt((k + 1) * segLen);
    const [lon, lat] = pointAt(sMid);
    // 走向: 東端側 → 西端側の方位 (北から時計回り)。傾斜方向はその右手 = 陸側
    const dE = (lonB - lonA) * KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
    const dN = (latB - latA) * KM_PER_DEG_LAT;
    let strikeDeg = (Math.atan2(dE, dN) * 180) / Math.PI;
    if (strikeDeg < 0) strikeDeg += 360;
    segments.push({ lon, lat, s: sMid, length: segLen, strikeDeg, suruga: lat > 34.3 && lon > 138.2 });
  }
  return { segments, totalKm };
}

/**
 * トラフ軸上の点から、走向直交 (陸側) に水平距離 hKm 離れた点
 */
function offsetLandward(seg: AxisSegment, hKm: number): [number, number] {
  const a = (seg.strikeDeg * Math.PI) / 180;
  // 傾斜方向 (走向の右手) = (cos θ, -sin θ) [東, 北]
  const dE = Math.cos(a) * hKm;
  const dN = -Math.sin(a) * hKm;
  return [
    seg.lon + dE / (KM_PER_DEG_LAT * Math.cos((seg.lat * Math.PI) / 180)),
    seg.lat + dN / KM_PER_DEG_LAT
  ];
}

// 駿河湾内はプレートが急に深くなるため、陸側への帯の幅を半分にする
function stripScale(seg: AxisSegment): number {
  return seg.suruga ? 0.5 : 1;
}

function stripWidthKm(strip: Strip, seg: AxisSegment): { horizontal: number; along: number; dipDeg: number } {
  const horizontal = (strip.h1 - strip.h0) * stripScale(seg);
  const dz = strip.z1 - strip.z0;
  return {
    horizontal,
    along: Math.hypot(horizontal, dz),
    dipDeg: (Math.atan2(dz, horizontal) * 180) / Math.PI
  };
}

export interface CabinetOfficeCase {
  faults: FaultParams[];
  ruptureStart: { lon: number; lat: number; depthKm: number };
  totalAreaKm2: number;
  mw: number;
  meanSlipM: number;
  maxSlipM: number;
}

/**
 * 大すべり域 (超大すべり域を含む) の中心を経度で指定して、検討ケースの小断層群を生成
 * centerLon: 'east' = 東端 (駿河湾) から、'west' = 西端 (日向灘) から、数値 = その経度付近のトラフ軸を中心
 */
export function buildCabinetOfficeCase(center: number | 'east' | 'west'): CabinetOfficeCase {
  const { segments, totalKm } = buildAxisSegments();

  // 面積 (km²)
  let totalArea = 0;
  for (const seg of segments) {
    for (const strip of STRIPS) totalArea += seg.length * stripWidthKm(strip, seg).along;
  }
  // 大すべり域はトラフ軸〜深さ20km (T1, T2, B) の帯。全体面積の20%となる走向方向の長さ
  const largeWidth = STRIPS.filter((s) => s.key !== 'C' && s.key !== 'D').reduce((sum, s) => sum + Math.hypot(s.h1 - s.h0, s.z1 - s.z0), 0);
  const largeLen = (LARGE_AREA_RATIO * totalArea) / largeWidth;

  // 大すべり域の範囲 (トラフ沿い距離)
  let sCenter: number;
  if (center === 'east') {
    sCenter = largeLen / 2;
  } else if (center === 'west') {
    sCenter = totalKm - largeLen / 2;
  } else {
    let best = segments[0];
    for (const seg of segments) {
      if (Math.abs(seg.lon - center) < Math.abs(best.lon - center)) best = seg;
    }
    sCenter = Math.max(largeLen / 2, Math.min(totalKm - largeLen / 2, best.s));
  }
  const s0 = sCenter - largeLen / 2;
  const s1 = sCenter + largeLen / 2;
  // 小区間が大すべり域に含まれる割合 (境界をまたぐ区間は按分)
  const inLarge = (seg: AxisSegment) =>
    Math.max(0, Math.min(seg.s + seg.length / 2, s1) - Math.max(seg.s - seg.length / 2, s0)) / seg.length;

  // 主部断層 (B, C, D) の地震モーメントが 平均10m × 主部断層面積 となるよう、背景すべり量 b を決める
  let mainArea = 0;
  let largeMainArea = 0;
  let bgWeightedArea = 0;
  for (const seg of segments) {
    const f = inLarge(seg);
    for (const strip of STRIPS) {
      if (strip.key === 'T1' || strip.key === 'T2') continue;
      const area = seg.length * stripWidthKm(strip, seg).along;
      mainArea += area;
      if (strip.key === 'B') {
        largeMainArea += area * f;
        bgWeightedArea += area * (1 - f);
      } else {
        bgWeightedArea += area * (strip.key === 'D' ? DEEP_REDUCTION : 1);
      }
    }
  }
  const background = (MAIN_MEAN_SLIP * mainArea - LARGE_SLIP * largeMainArea) / bgWeightedArea;

  const faults: FaultParams[] = [];
  let sumSlipArea = 0;
  let maxSlip = 0;
  for (const seg of segments) {
    const f = inLarge(seg);
    const superSlip = seg.suruga ? LARGE_SLIP : SUPER_SLIP;
    const superInner = seg.suruga ? LARGE_SLIP : (SUPER_SLIP + LARGE_SLIP) / 2;
    for (const strip of STRIPS) {
      let slip: number;
      switch (strip.key) {
        case 'T1': slip = f * superSlip; break;
        case 'T2': slip = f * superInner; break;
        case 'B': slip = f * LARGE_SLIP + (1 - f) * background; break;
        case 'C': slip = background; break;
        default: slip = background * DEEP_REDUCTION;
      }
      const w = stripWidthKm(strip, seg);
      sumSlipArea += slip * seg.length * w.along;
      if (slip > maxSlip) maxSlip = slip;
      // すべり0の小断層 (超大すべり域以外のトラフ沿い) も想定震源域の一部として残す (平均すべり量の母数・地図表示)
      const hMid = ((strip.h0 + strip.h1) / 2) * stripScale(seg);
      const [lon, lat] = offsetLandward(seg, hMid);
      faults.push({
        name: '内閣府モデル小断層',
        epicenterLon: Number(lon.toFixed(4)),
        epicenterLat: Number(lat.toFixed(4)),
        depthKm: strip.z0,
        lengthKm: Number(seg.length.toFixed(2)),
        widthKm: Number(w.along.toFixed(2)),
        strikeDeg: Number(seg.strikeDeg.toFixed(1)),
        dipDeg: Number(w.dipDeg.toFixed(2)),
        rakeDeg: 90,
        slipM: Number(slip.toFixed(2)),
        subfault: true
      });
    }
  }

  // 破壊開始点: 大すべり域中心付近、プレート境界深さ約20km (B と C の境界)
  const startSeg = segments.reduce((best, seg) => (Math.abs(seg.s - sCenter) < Math.abs(best.s - sCenter) ? seg : best));
  const [rlon, rlat] = offsetLandward(startSeg, STRIPS[2].h1 * stripScale(startSeg));

  // 剛性率 μ = ρ Vs² (ρ = 2.8 g/cm³, Vs = 3.82 km/s)
  const mu = 2800 * 3820 * 3820;
  const m0 = mu * sumSlipArea * 1e6;
  return {
    faults,
    ruptureStart: { lon: Number(rlon.toFixed(2)), lat: Number(rlat.toFixed(2)), depthKm: 20 },
    totalAreaKm2: totalArea,
    mw: (Math.log10(m0) - 9.1) / 1.5,
    meanSlipM: sumSlipArea / totalArea,
    maxSlipM: maxSlip
  };
}
