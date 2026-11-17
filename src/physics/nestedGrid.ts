import { BathymetryMeta, ObservationPoint, RuptureParams } from '../types';
import { ShallowWaterSolver } from './shallowWater';

/**
 * 高解像度の部分領域 (入れ子格子) と、外側の粗い格子との一方向の結合
 *
 * 毎ステップ、粗い格子の水位を入れ子格子の外周1列に空間 (双線形) ・時間 (線形) 補間して与え、
 * 入れ子格子の内側を同じ方程式で計算する。入れ子格子の結果は粗い格子には戻さない (一方向ネスティング)。
 */
export class NestedGrid {
  public readonly solver: ShallowWaterSolver;
  public readonly meta: BathymetryMeta;
  public readonly name: string;
  private coarse: ShallowWaterSolver;
  private substeps: number;

  // 外周セルの番号と、粗い格子の周囲4セルの番号・重み
  private ringIdx: Int32Array;
  private ringCoarseIdx: Int32Array;
  private ringWeight: Float32Array;
  private ringPrev: Float32Array;
  private ringNext: Float32Array;
  /**
   * 隣の入れ子格子から外周の値を受け取る場合の対応 (沿岸タイル用)。外周セル k は、タイル nbTile[k] のセル nbCell[k] と同じ位置
   * (nbTile[k] < 0 は隣のタイルなし)。隣のタイルを計算していないときは全国格子の値を使う
   */
  public nbTile: Int32Array | null = null;
  public nbCell: Int32Array | null = null;

  /**
   * @param ringWidth 外から値を与える外周の幅 (セル)。隣の格子とつなぐ沿岸タイルは 2 (4次フィルターが境目でも ±2 セルを使えるように)
   */
  constructor(name: string, meta: BathymetryMeta, rawBathymetry: Int16Array, coarse: ShallowWaterSolver, coarseMeta: BathymetryMeta, ringWidth = 1) {
    this.name = name;
    this.meta = meta;
    this.coarse = coarse;

    // 時間刻み: 粗い格子の刻みを整数分割し、入れ子格子の CFL 条件を満たすようにする
    const probe = new ShallowWaterSolver(meta, rawBathymetry, coarse.dt, { nested: true });
    this.substeps = Math.max(1, Math.ceil(coarse.dt / probe.dt - 1e-9));
    this.solver = this.substeps === 1 ? probe : new ShallowWaterSolver(meta, rawBathymetry, coarse.dt / this.substeps, { nested: true });
    this.solver.filterMode = coarse.filterMode;
    this.solver.filterStrength = coarse.filterStrength;

    // 外周 ringWidth 列のセル
    const W = meta.width;
    const H = meta.height;
    const ring: number[] = [];
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        if (Math.min(r, c, H - 1 - r, W - 1 - c) < ringWidth) ring.push(r * W + c);
      }
    }
    this.ringIdx = Int32Array.from(ring);
    this.ringCoarseIdx = new Int32Array(ring.length * 4);
    this.ringWeight = new Float32Array(ring.length * 4);
    this.ringPrev = new Float32Array(ring.length);
    this.ringNext = new Float32Array(ring.length);

    // 各外周セルの中心を粗い格子の4セルで双線形補間する重み (陸のセルは除いて正規化)
    const fb = meta.bounds;
    const cb = coarseMeta.bounds;
    const CW = coarseMeta.width;
    const CH = coarseMeta.height;
    ring.forEach((idx, k) => {
      const r = Math.floor(idx / W);
      const c = idx - r * W;
      const lon = fb.lonMin + ((c + 0.5) / W) * (fb.lonMax - fb.lonMin);
      const lat = fb.latMax - ((r + 0.5) / H) * (fb.latMax - fb.latMin);
      // 粗い格子のセル中心を基準にした座標
      const cx = ((lon - cb.lonMin) / (cb.lonMax - cb.lonMin)) * CW - 0.5;
      const cy = ((cb.latMax - lat) / (cb.latMax - cb.latMin)) * CH - 0.5;
      const c0 = Math.floor(cx);
      const r0 = Math.floor(cy);
      const fx = cx - c0;
      const fy = cy - r0;
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        const cc = Math.min(CW - 1, Math.max(0, c0 + (j & 1)));
        const rr = Math.min(CH - 1, Math.max(0, r0 + (j >> 1)));
        const ci = rr * CW + cc;
        const w = coarse.depth[ci] > 1 ? ((j & 1) ? fx : 1 - fx) * ((j >> 1) ? fy : 1 - fy) : 0;
        this.ringCoarseIdx[k * 4 + j] = ci;
        this.ringWeight[k * 4 + j] = w;
        sum += w;
      }
      for (let j = 0; j < 4; j++) this.ringWeight[k * 4 + j] = sum > 1e-6 ? this.ringWeight[k * 4 + j] / sum : 0;
    });
  }

  public contains(lon: number, lat: number): boolean {
    const b = this.meta.bounds;
    return lon >= b.lonMin && lon <= b.lonMax && lat >= b.latMin && lat <= b.latMax;
  }

  public set observationPoints(points: ObservationPoint[]) {
    this.solver.observationPoints = points;
  }

  public get observationPoints(): ObservationPoint[] {
    return this.solver.observationPoints;
  }

  /**
   * 粗い格子の現在の水位を外周セルの位置に補間
   */
  private sampleRing(out: Float32Array): void {
    const eta = this.coarse.eta;
    for (let k = 0; k < out.length; k++) {
      const o = k * 4;
      out[k] =
        this.ringWeight[o] * eta[this.ringCoarseIdx[o]] +
        this.ringWeight[o + 1] * eta[this.ringCoarseIdx[o + 1]] +
        this.ringWeight[o + 2] * eta[this.ringCoarseIdx[o + 2]] +
        this.ringWeight[o + 3] * eta[this.ringCoarseIdx[o + 3]];
    }
  }

  private applyRing(a: Float32Array, b: Float32Array, t: number): void {
    const eta = this.solver.eta;
    const depth = this.solver.depth;
    for (let k = 0; k < this.ringIdx.length; k++) {
      const idx = this.ringIdx[k];
      eta[idx] = depth[idx] > 1 ? a[k] + (b[k] - a[k]) * t : 0;
    }
  }

  /**
   * 初期化 (粗い格子を初期化した後に呼ぶ)
   */
  public reset(eta0: Float32Array, rupture?: RuptureParams): void {
    this.solver.filterMode = this.coarse.filterMode;
    this.solver.filterStrength = this.coarse.filterStrength;
    this.solver.resetWithDisplacement(eta0, rupture);
    this.sampleRing(this.ringPrev);
    this.applyRing(this.ringPrev, this.ringPrev, 0);
  }

  /**
   * 計算の途中から始める: 粗い格子の現在の水位を内部全体に (海のセルだけで) 双線形補間して初期値にする。
   * 流量は 0 から始める (波が届き始めた時点で始めるので、その差は小さい)
   */
  public startFromCoarse(coarseMeta: BathymetryMeta): void {
    const W = this.meta.width;
    const H = this.meta.height;
    const fb = this.meta.bounds;
    const cb = coarseMeta.bounds;
    const CW = coarseMeta.width;
    const CH = coarseMeta.height;
    const eta = this.coarse.eta;
    const depth = this.coarse.depth;
    const eta0 = new Float32Array(W * H);
    for (let r = 0; r < H; r++) {
      const lat = fb.latMax - ((r + 0.5) / H) * (fb.latMax - fb.latMin);
      const cy = ((cb.latMax - lat) / (cb.latMax - cb.latMin)) * CH - 0.5;
      const r0 = Math.floor(cy);
      const fy = cy - r0;
      for (let c = 0; c < W; c++) {
        const lon = fb.lonMin + ((c + 0.5) / W) * (fb.lonMax - fb.lonMin);
        const cx = ((lon - cb.lonMin) / (cb.lonMax - cb.lonMin)) * CW - 0.5;
        const c0 = Math.floor(cx);
        const fx = cx - c0;
        let sum = 0;
        let wsum = 0;
        for (let j = 0; j < 4; j++) {
          const cc = Math.min(CW - 1, Math.max(0, c0 + (j & 1)));
          const rr = Math.min(CH - 1, Math.max(0, r0 + (j >> 1)));
          const ci = rr * CW + cc;
          if (depth[ci] <= 1) continue;
          const w = ((j & 1) ? fx : 1 - fx) * ((j >> 1) ? fy : 1 - fy);
          sum += w * eta[ci];
          wsum += w;
        }
        eta0[r * W + c] = wsum > 1e-6 ? sum / wsum : 0;
      }
    }
    this.solver.filterMode = this.coarse.filterMode;
    this.solver.filterStrength = this.coarse.filterStrength;
    this.solver.resetWithDisplacement(eta0);
    this.solver.currentTimeSec = this.coarse.currentTimeSec;
    this.solver.currentStep = this.coarse.currentStep;
    this.sampleRing(this.ringPrev);
    this.applyRing(this.ringPrev, this.ringPrev, 0);
  }

  /**
   * 粗い格子を1ステップ進めた後に呼び、入れ子格子を同じ時刻まで進める
   */
  public step(): void {
    this.prepare(null);
    this.advance();
  }

  /** 外周セルの番号 (のりしろの対応づけ用) */
  public get ringCells(): Int32Array {
    return this.ringIdx;
  }

  /**
   * 1ステップ分の外周の値を用意する (全国格子は進めた後、隣のタイルは進める前の水位を使う)。
   * 隣のタイルの値はこのステップの間一定とする
   */
  public prepare(neighborEta: ((tile: number) => Float32Array | null) | null): void {
    this.sampleRing(this.ringNext);
    if (!neighborEta || !this.nbTile || !this.nbCell) return;
    for (let k = 0; k < this.ringIdx.length; k++) {
      const t = this.nbTile[k];
      if (t < 0) continue;
      const e = neighborEta(t);
      if (!e) continue;
      const v = e[this.nbCell[k]];
      this.ringNext[k] = v;
      this.ringPrev[k] = v;
    }
  }

  /** prepare() で用意した外周の値で、このタイルを全国格子と同じ時刻まで進める */
  public advance(): void {
    for (let k = 0; k < this.substeps; k++) {
      this.applyRing(this.ringPrev, this.ringNext, k / this.substeps);
      this.solver.step();
    }
    this.applyRing(this.ringPrev, this.ringNext, 1);
    this.ringPrev.set(this.ringNext);
    // 小刻みの積算誤差で時刻がずれないよう、粗い格子の時刻にそろえる
    this.solver.currentTimeSec = this.coarse.currentTimeSec;
    // 観測点は粗い格子と同じ時刻に記録する (波形グラフ・CSV の時刻をそろえるため)
    if (this.coarse.currentStep % this.coarse.samplingInterval === 0) {
      this.solver.sampleObservationPoints();
    }
  }
}
