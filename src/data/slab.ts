import { FaultParams } from '../types';

/**
 * 沈み込むプレート境界面の形状 (USGS Slab1.0 / Slab2 を scripts/process_slab.py で 0.1度格子化したもの)
 */
export interface SlabMeta {
  width: number;
  height: number;
  stepDeg: number;
  lonMin: number;
  latMax: number;
  scale: number;
  missing: number;
  sources: string[];
}

export interface SlabPoint {
  depthKm: number;
  strikeDeg: number;
  dipDeg: number;
}

export class SlabModel {
  constructor(private meta: SlabMeta, private data: Int16Array) {}

  public static async load(): Promise<SlabModel | null> {
    try {
      const meta: SlabMeta = await (await fetch('/slab_meta.json')).json();
      const buf = await (await fetch('/slab.bin')).arrayBuffer();
      return new SlabModel(meta, new Int16Array(buf));
    } catch (e) {
      console.warn('Slab data not available', e);
      return null;
    }
  }

  public get sourceNames(): string[] {
    return this.meta.sources;
  }

  /**
   * 指定地点のプレート境界の深さ・走向・傾斜 (データ範囲外なら null)
   */
  public lookup(lon: number, lat: number): SlabPoint | null {
    const { width, height, stepDeg, lonMin, latMax, scale, missing } = this.meta;
    const c = Math.floor((lon - lonMin) / stepDeg);
    const r = Math.floor((latMax - lat) / stepDeg);
    if (c < 0 || c >= width || r < 0 || r >= height) return null;
    const n = width * height;
    const i = r * width + c;
    const d = this.data[i];
    const s = this.data[n + i];
    const p = this.data[2 * n + i];
    if (d === missing || s === missing || p === missing) return null;
    return { depthKm: d / scale, strikeDeg: s / scale, dipDeg: p / scale };
  }
}

// プレート間地震として扱うプレート境界の最大深さ (km)。これより深い場合は手動パラメータを使う
export const MAX_INTERPLATE_DEPTH_KM = 60;
// 剛性率 (Pa)
const RIGIDITY = 4.0e10;

/**
 * プレート間 (逆断層) 地震の断層サイズのスケーリング則 (Strasser et al., 2010, interface events)
 *   log10 L = -2.477 + 0.585 Mw,  log10 W = -0.882 + 0.351 Mw  (km)
 */
export function interfaceFaultSize(mw: number): { lengthKm: number; widthKm: number } {
  return {
    lengthKm: Math.pow(10, -2.477 + 0.585 * mw),
    widthKm: Math.pow(10, -0.882 + 0.351 * mw)
  };
}

/**
 * Mw と断層面積から平均すべり量 (m) を求める (Mo = μ D S, log10 Mo = 1.5 Mw + 9.1)
 */
export function slipFromMagnitude(mw: number, lengthKm: number, widthKm: number): number {
  const m0 = Math.pow(10, 1.5 * mw + 9.1);
  return m0 / (RIGIDITY * lengthKm * 1000 * widthKm * 1000);
}

export interface CustomFaultInput {
  lon: number;
  lat: number;
  strikeDeg: number;
  dipDeg: number;
  rakeDeg: number;
  lengthKm: number;
  widthKm: number;
  topDepthKm: number;
  slipM: number;
}

/**
 * クリック地点 (断層面の地表投影の中心) に、プレート境界に沿った断層を置く。
 * 断層中心の深さはプレート境界の深さとし、上端が地表に出る場合は上端が深さ1kmになるよう傾斜方向 (陸側) へずらす。
 */
export function faultOnSlab(lon: number, lat: number, slab: SlabPoint, lengthKm: number, widthKm: number): CustomFaultInput {
  const dipRad = (Math.max(1, slab.dipDeg) * Math.PI) / 180;
  let top = slab.depthKm - (widthKm / 2) * Math.sin(dipRad);
  let cLon = lon;
  let cLat = lat;
  if (top < 1) {
    // 傾斜方向 (走向の右手) へ水平にずらす
    const shiftAlongDip = (1 - top) / Math.sin(dipRad);
    const shiftH = shiftAlongDip * Math.cos(dipRad);
    const a = (slab.strikeDeg * Math.PI) / 180;
    cLon += (Math.cos(a) * shiftH) / (111.32 * Math.cos((lat * Math.PI) / 180));
    cLat += (-Math.sin(a) * shiftH) / 111.32;
    top = 1;
  }
  return {
    lon: Number(cLon.toFixed(3)),
    lat: Number(cLat.toFixed(3)),
    strikeDeg: Math.round(slab.strikeDeg),
    dipDeg: Number(slab.dipDeg.toFixed(1)),
    rakeDeg: 90,
    lengthKm: Math.round(lengthKm),
    widthKm: Math.round(widthKm),
    topDepthKm: Number(top.toFixed(1)),
    slipM: 0
  };
}

export function toFaultParams(input: CustomFaultInput, name: string): FaultParams {
  return {
    name,
    epicenterLon: input.lon,
    epicenterLat: input.lat,
    depthKm: input.topDepthKm,
    lengthKm: input.lengthKm,
    widthKm: input.widthKm,
    strikeDeg: input.strikeDeg,
    dipDeg: input.dipDeg,
    rakeDeg: input.rakeDeg,
    slipM: input.slipM
  };
}
