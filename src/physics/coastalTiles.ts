import { BathymetryMeta, ObservationPoint, RuptureParams } from '../types';
import { NestedGrid } from './nestedGrid';
import { ShallowWaterSolver } from './shallowWater';

/**
 * 沿岸の高解像度タイル (15秒メッシュ, 約400m) の集合
 *
 * 全国格子 (1.5分) を 0.25度 のタイルに分け、水深 200m 未満の海のセルを含むタイルを、それぞれ1方向の入れ子格子として計算する
 * (タイルの選び方・地形は scripts/process_tiles.mjs)。タイルは千枚以上あるので、
 *   * 波源 (初期の海面変位) か観測点を含むタイルは最初から計算し、
 *   * それ以外のタイルは、全国格子の水位がタイルの範囲で ACTIVATION_M を超えた時点で、全国格子の水位を初期値にして計算を始める。
 * 計算していない間はメモリも確保しない。
 * 各タイルは周囲に2セルののりしろを持ち、のりしろの位置は隣のタイルの外側2列のセルと一致する。のりしろの水位は、
 * 隣のタイルを計算していればそのセルの値 (1ステップ前の時刻)、計算していなければ全国格子の補間値を使う。
 * 全タイルを共通の小刻み (全国格子の刻みを substeps 分割、最も深いタイルの CFL 条件で決める) で一緒に進め、小刻みごとにのりしろを
 * 受け渡すので、これは境目のない1枚の格子の計算とほぼ同じになる (4次フィルターも境目で ±2 セルを使える)。
 * (タイルごとに違う小刻みで進め、のりしろを全国格子の1ステップに1回だけ受け渡すと、深いタイルの境目で波が弱まる。
 *  駿河湾では領域端の最大水位が約半分になった)
 */
export interface TileInfo {
  r0: number;
  c0: number;
  offset: number;
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
  maxDepth: number;
}

export interface TilesMeta {
  tileCoarseCells: number;
  tileCells: number;   // タイル本体の格子数 (1辺)
  halo: number;        // のりしろのセル数
  gridCells: number;   // のりしろ込みの格子数 (1辺)
  factor: number;
  dDeg: number;
  depthThreshold: number;
  coarseWidth: number;
  coarseHeight: number;
  tiles: TileInfo[];
}

const ACTIVATION_M = 0.005;   // この水位 (m) を全国格子で超えたらタイルの計算を始める
const CHECK_EVERY_STEPS = 2;  // 計算を始めるタイルを調べる間隔 (全国格子のステップ数)

export class CoastalTiles {
  public readonly meta: TilesMeta;
  public readonly raw: Int16Array;
  /** 計算中のタイルの番号 */
  public readonly active: number[] = [];
  private grids: (NestedGrid | null)[];
  private isActive: Uint8Array;
  private coarse: ShallowWaterSolver;
  private coarseMeta: BathymetryMeta;
  private index: Int32Array;             // (タイル行, タイル列) → タイル番号 (-1 はタイルなし)
  private nTileCols: number;
  private pointsByTile = new Map<number, ObservationPoint[]>();
  /** 全タイル共通の小刻みの数 (全国格子の1ステップあたり) */
  public readonly substeps: number;

  constructor(meta: TilesMeta, raw: Int16Array, coarse: ShallowWaterSolver, coarseMeta: BathymetryMeta) {
    this.meta = meta;
    this.raw = raw;
    this.coarse = coarse;
    this.coarseMeta = coarseMeta;
    this.grids = new Array(meta.tiles.length).fill(null);
    this.isActive = new Uint8Array(meta.tiles.length);
    const T = meta.tileCoarseCells;
    this.nTileCols = Math.ceil(coarseMeta.width / T);
    this.index = new Int32Array(this.nTileCols * Math.ceil(coarseMeta.height / T)).fill(-1);
    meta.tiles.forEach((t, k) => {
      this.index[Math.floor(t.r0 / T) * this.nTileCols + Math.floor(t.c0 / T)] = k;
    });
    this.substeps = meta.tiles.reduce((m, _, k) => Math.max(m, this.requiredSubsteps(k)), 1);
  }

  /**
   * タイル k を単独で入れ子にしたときの小刻みの数 (NestedGrid と同じく ShallowWaterSolver の CFL 条件から):
   * dt_CFL = min(dx, dy) / (√2 √(g h_max))、与えた刻みが 0.9 dt_CFL を超えると 0.8 dt_CFL に縮める
   */
  private requiredSubsteps(k: number): number {
    const m = this.tileMeta(k);
    const raw = this.tileRaw(k);
    let maxDepth = 10;
    for (let i = 0; i < raw.length; i++) if (-raw[i] > maxDepth) maxDepth = -raw[i];
    const dLon = (m.bounds.lonMax - m.bounds.lonMin) / m.width;
    const dLat = (m.bounds.latMax - m.bounds.latMin) / m.height;
    let minDx = Infinity;
    for (let r = 0; r < m.height; r++) {
      minDx = Math.min(minDx, dLon * 111320 * Math.cos(((m.bounds.latMax - (r + 0.5) * dLat) * Math.PI) / 180));
    }
    const dtCfl = Math.min(minDx, m.dyMeters) / (Math.SQRT2 * Math.sqrt(this.coarse.g * maxDepth));
    const dt = this.coarse.dt > dtCfl * 0.9 ? Number((dtCfl * 0.8).toFixed(2)) : this.coarse.dt;
    return Math.max(1, Math.ceil(this.coarse.dt / dt - 1e-9));
  }

  public get count(): number {
    return this.meta.tiles.length;
  }

  /** 経緯度を含むタイルの番号 (なければ -1) */
  public tileAt(lon: number, lat: number): number {
    const b = this.coarseMeta.bounds;
    const c = Math.floor(((lon - b.lonMin) / (b.lonMax - b.lonMin)) * this.coarseMeta.width);
    const r = Math.floor(((b.latMax - lat) / (b.latMax - b.latMin)) * this.coarseMeta.height);
    if (c < 0 || r < 0 || c >= this.coarseMeta.width || r >= this.coarseMeta.height) return -1;
    const T = this.meta.tileCoarseCells;
    return this.index[Math.floor(r / T) * this.nTileCols + Math.floor(c / T)];
  }

  /** のりしろ込みの入れ子格子の範囲・格子数 */
  public tileMeta(k: number): BathymetryMeta {
    const t = this.meta.tiles[k];
    const g = this.meta.gridCells;
    const h = this.meta.halo * this.meta.dDeg;
    const midLat = (t.latMin + t.latMax) / 2;
    return {
      width: g,
      height: g,
      factor: 1,
      bounds: { lonMin: t.lonMin - h, lonMax: t.lonMax + h, latMin: t.latMin - h, latMax: t.latMax + h },
      dxDeg: this.meta.dDeg,
      dyDeg: this.meta.dDeg,
      dxMeters: this.meta.dDeg * 111000 * Math.cos((midLat * Math.PI) / 180),
      dyMeters: this.meta.dDeg * 111000
    };
  }

  /** のりしろ込みの標高 */
  public tileRaw(k: number): Int16Array {
    const g = this.meta.gridCells;
    const off = this.meta.tiles[k].offset;
    return this.raw.subarray(off, off + g * g);
  }

  /** 計算中ならそのタイルの入れ子格子 */
  public grid(k: number): NestedGrid | null {
    return k >= 0 && this.isActive[k] ? this.grids[k] : null;
  }

  private create(k: number): NestedGrid {
    const g = new NestedGrid(`tile${k}`, this.tileMeta(k), this.tileRaw(k), this.coarse, this.coarseMeta, this.meta.halo, this.substeps);
    g.observationPoints = this.pointsByTile.get(k) ?? [];
    this.linkNeighbors(k, g);
    this.grids[k] = g;
    this.isActive[k] = 1;
    this.active.push(k);
    return g;
  }

  /** のりしろ (外周) の各セルに対応する隣のタイルとそのセルを求める */
  private linkNeighbors(k: number, g: NestedGrid): void {
    const T = this.meta.tileCoarseCells;
    const n = this.meta.tileCells;
    const G = this.meta.gridCells;
    const h = this.meta.halo;
    const t = this.meta.tiles[k];
    const tr = Math.floor(t.r0 / T);
    const tc = Math.floor(t.c0 / T);
    const nTileRows = this.index.length / this.nTileCols;
    const ring = g.ringCells;
    const nbTile = new Int32Array(ring.length).fill(-1);
    const nbCell = new Int32Array(ring.length);
    ring.forEach((idx, m) => {
      const ci = Math.floor(idx / G) - h;   // タイル本体を基準にした位置 (-h 〜 n+h-1)
      const cj = (idx % G) - h;
      const dr = ci < 0 ? -1 : ci >= n ? 1 : 0;
      const dc = cj < 0 ? -1 : cj >= n ? 1 : 0;
      const r2 = tr + dr;
      const c2 = tc + dc;
      if (r2 < 0 || c2 < 0 || r2 >= nTileRows || c2 >= this.nTileCols) return;
      const k2 = this.index[r2 * this.nTileCols + c2];
      if (k2 < 0) return;
      nbTile[m] = k2;
      nbCell[m] = (ci - dr * n + h) * G + (cj - dc * n + h);
    });
    g.nbTile = nbTile;
    g.nbCell = nbCell;
  }

  /** 観測点をタイルごとに振り分ける。戻り値: タイルに入らない観測点 (全国格子で記録する) */
  public assignPoints(points: ObservationPoint[]): ObservationPoint[] {
    this.pointsByTile.clear();
    const rest: ObservationPoint[] = [];
    for (const p of points) {
      const k = this.tileAt(p.lon, p.lat);
      if (k < 0) {
        rest.push(p);
        continue;
      }
      const list = this.pointsByTile.get(k) ?? [];
      list.push(p);
      this.pointsByTile.set(k, list);
    }
    for (const k of this.active) this.grids[k]!.observationPoints = this.pointsByTile.get(k) ?? [];
    return rest;
  }

  /**
   * 全国格子を初期化した後に呼ぶ。波源 (最終的な海面変位) か観測点を含むタイルはその場で計算を始める
   * @param eta0 全国格子の初期の海面変位 (破壊伝播ありでも最終変位)
   * @param fineSource タイルの範囲・格子数に対する高解像度の初期変位を返す関数
   */
  public reset(eta0: Float32Array, rupture: RuptureParams | undefined,
    fineSource: (b: BathymetryMeta['bounds'], w: number, h: number) => Float32Array): void {
    for (const k of this.active) {
      this.grids[k] = null;
      this.isActive[k] = 0;
    }
    this.active.length = 0;
    this.meta.tiles.forEach((_, k) => {
      if (this.pointsByTile.has(k) || this.footprintMax(eta0, k) > ACTIVATION_M) {
        const g = this.create(k);
        g.reset(fineSource(g.meta.bounds, g.meta.width, g.meta.height), rupture);
      }
    });
  }

  /** 全国格子を1ステップ進めた後に呼ぶ */
  public step(): void {
    // 小刻みごとに、先に全タイルの外周の値を (隣のタイルはその小刻みの開始時の水位で) 与えてから、全タイルを1小刻み進める
    const etaOf = (t: number): Float32Array | null => (this.isActive[t] ? this.grids[t]!.solver.eta : null);
    const S = this.substeps;
    for (const k of this.active) this.grids[k]!.beginStep();
    for (let s = 0; s < S; s++) {
      for (const k of this.active) this.grids[k]!.applyHalo(etaOf, s / S);
      for (const k of this.active) this.grids[k]!.solver.step();
    }
    for (const k of this.active) this.grids[k]!.endStep(etaOf);
    if (this.coarse.currentStep % CHECK_EVERY_STEPS === 0) this.activateReached();
  }

  /** 全国格子の波が届いたタイルの計算を始める */
  private activateReached(): void {
    const eta = this.coarse.eta;
    for (let k = 0; k < this.meta.tiles.length; k++) {
      if (this.isActive[k]) continue;
      if (this.footprintMax(eta, k) > ACTIVATION_M) this.create(k).startFromCoarse(this.coarseMeta);
    }
  }

  /** 観測点のタイルがまだ計算されていなければ、全国格子の現在の水位から計算を始める */
  public ensureActive(k: number): NestedGrid | null {
    if (k < 0) return null;
    if (this.isActive[k]) return this.grids[k];
    const g = this.create(k);
    g.startFromCoarse(this.coarseMeta);
    return g;
  }

  /** タイルの範囲 (と周囲1セル) の全国格子の |η| の最大 */
  private footprintMax(field: Float32Array, k: number): number {
    const t = this.meta.tiles[k];
    const T = this.meta.tileCoarseCells;
    const W = this.coarseMeta.width;
    const H = this.coarseMeta.height;
    let m = 0;
    const r1 = Math.min(H - 1, t.r0 + T);
    const c1 = Math.min(W - 1, t.c0 + T);
    for (let r = Math.max(0, t.r0 - 1); r <= r1; r++) {
      const off = r * W;
      for (let c = Math.max(0, t.c0 - 1); c <= c1; c++) {
        const v = Math.abs(field[off + c]);
        if (v > m) m = v;
      }
    }
    return m;
  }

  /** 地図上の経緯度の地形・水位 (タイルの範囲外は null) */
  public probe(lon: number, lat: number): { depth: number; eta: number; elevation: number } | null {
    const k = this.tileAt(lon, lat);
    if (k < 0) return null;
    const t = this.meta.tiles[k];
    const n = this.meta.tileCells;
    const h = this.meta.halo;
    const c = Math.min(n - 1, Math.max(0, Math.floor(((lon - t.lonMin) / (t.lonMax - t.lonMin)) * n)));
    const r = Math.min(n - 1, Math.max(0, Math.floor(((t.latMax - lat) / (t.latMax - t.latMin)) * n)));
    const i = (r + h) * this.meta.gridCells + (c + h);
    const elevation = this.raw[t.offset + i];
    const g = this.grid(k);
    if (g) return { depth: g.solver.depth[i], eta: g.solver.eta[i], elevation };
    return { depth: elevation < 0 ? -elevation : 0, eta: NaN, elevation };
  }
}
