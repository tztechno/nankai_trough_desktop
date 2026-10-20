import { BathymetryMeta, ObservationPoint } from '../types';

/**
 * 2次元浅水流方程式（Shallow Water Equations）ソルバー
 * スタガード格子（Arakawa C-grid）およびリープフロッグ時間積分
 */
export class ShallowWaterSolver {
  public width: number;
  public height: number;
  public dx: number;
  public dy: number;
  public g: number = 9.80665;
  public dt: number;

  // 水深データ (h > 0: 海, h <= 0: 陸)
  public depth: Float32Array;
  // 静水面からの水位変動 (m)
  public eta: Float32Array;
  // 平滑化・安定化用テンポラリバッファ
  private etaTemp: Float32Array;
  // 前ステップの水位
  private etaPrev: Float32Array;
  // 水平流量フラックス M = u * (h + eta) (m^2/s)
  public M: Float32Array;
  // 鉛直（南北）流量フラックス N = v * (h + eta) (m^2/s)
  public N: Float32Array;

  // 最大波高記録 (m)
  public maxEta: Float32Array;
  // 第1波到達時刻記録 (sec, 水位 > 0.1m)
  public arrivalTime: Float32Array;

  // 観測点リスト
  public observationPoints: ObservationPoint[] = [];

  // 物理定数
  private manningN: number = 0.025; // 海底粗度係数 (Manning's n)
  public currentTimeSec: number = 0;
  public currentStep: number = 0;
  private metaBounds: BathymetryMeta['bounds'];

  constructor(meta: BathymetryMeta, rawBathymetry: Int16Array, dtSec: number = 2.0) {
    this.width = meta.width;
    this.height = meta.height;
    this.dx = meta.dxMeters;
    this.dy = meta.dyMeters;
    this.dt = dtSec;
    this.metaBounds = meta.bounds;

    const size = this.width * this.height;
    this.depth = new Float32Array(size);
    this.eta = new Float32Array(size);
    this.etaTemp = new Float32Array(size);
    this.etaPrev = new Float32Array(size);
    this.M = new Float32Array(size);
    this.N = new Float32Array(size);
    this.maxEta = new Float32Array(size);
    this.arrivalTime = new Float32Array(size).fill(-1);

    // GEBCO rawBathymetry: 標高値 (海は負, 陸は正)
    // 水深 h: 海は正 (h = -z), 陸は 0
    let maxDepth = 10;
    for (let i = 0; i < size; i++) {
      const z = rawBathymetry[i];
      if (z < 0) {
        this.depth[i] = -z;
        if (-z > maxDepth) maxDepth = -z;
      } else {
        this.depth[i] = 0; // 陸地
      }
    }

    // CFL安定条件チェック
    const cMax = Math.sqrt(this.g * maxDepth);
    const dtCfl = Math.min(this.dx, this.dy) / (Math.SQRT2 * cMax);
    if (this.dt > dtCfl * 0.9) {
      this.dt = Number((dtCfl * 0.8).toFixed(2));
      console.log(`Adjusted dt to CFL condition: ${this.dt}s (max depth: ${maxDepth}m, cMax: ${cMax.toFixed(1)}m/s)`);
    }
  }

  /**
   * 初期海面変位を設定してシミュレーションを初期化
   */
  public resetWithDisplacement(eta0: Float32Array): void {
    const size = this.width * this.height;
    this.currentTimeSec = 0;
    this.currentStep = 0;

    for (let i = 0; i < size; i++) {
      // 陸地でないセルにのみ海面変位を与える
      if (this.depth[i] > 5) {
        this.eta[i] = eta0[i];
        this.etaPrev[i] = eta0[i];
        this.maxEta[i] = Math.max(0, eta0[i]);
      } else {
        this.eta[i] = 0;
        this.etaPrev[i] = 0;
        this.maxEta[i] = 0;
      }
      this.M[i] = 0;
      this.N[i] = 0;
      this.etaTemp[i] = 0;
      this.arrivalTime[i] = -1;
    }

    // 観測点履歴をクリア
    for (const pt of this.observationPoints) {
      pt.timeHistory = [];
      pt.maxWaveHeight = 0;
      pt.minWaveHeight = 0;
      pt.firstArrivalSec = undefined;
      pt.maxArrivalSec = undefined;
      pt.dominantDirectionDeg = undefined;
    }

    // t=0 の初期状態をサンプリング
    this.sampleObservationPoints();
  }

  /**
   * 1タイムステップ進行 (Arakawa C-grid Leapfrog scheme)
   */
  public step(): void {
    const W = this.width;
    const H = this.height;
    const dt = this.dt;
    const dx = this.dx;
    const dy = this.dy;
    const g = this.g;

    // 1. 運動方程式の計算 (流量フラックス M, N の更新: 半陰解法摩擦項)
    for (let r = 1; r < H - 1; r++) {
      const rowOffset = r * W;
      for (let c = 1; c < W - 1; c++) {
        const idx = rowOffset + c;

        // --- 東西方向フラックス M (idx と idx+1 の間) ---
        const dCenter = this.depth[idx];
        const dEast = this.depth[idx + 1];

        if (dCenter > 1 && dEast > 1) {
          const dM = 0.5 * (dCenter + dEast);
          const etaM = 0.5 * (this.eta[idx] + this.eta[idx + 1]);
          const totalDepth = Math.max(0.1, dM + etaM);

          if (totalDepth > 0.2) {
            // 圧力勾配項: - g * totalDepth * dEta/dx
            const gradEtaX = (this.eta[idx + 1] - this.eta[idx]) / dx;
            const pressGrad = -g * totalDepth * gradEtaX;

            // 半陰解法による Manning 摩擦項 (分母に配置することで浅瀬でも絶対発散しない)
            const mVal = this.M[idx];
            const nVal = 0.25 * (this.N[idx] + this.N[idx + 1] + this.N[idx - W] + this.N[idx - W + 1]);
            const fluxMag = Math.hypot(mVal, nVal);
            const frictionFactor = (g * this.manningN * this.manningN * fluxMag) / Math.pow(Math.max(1.0, totalDepth), 7 / 3);

            // M^{n+1} = (M^n + press * dt) / (1 + friction * dt)
            const nextM = (mVal + pressGrad * dt) / (1.0 + frictionFactor * dt);
            this.M[idx] = Number.isFinite(nextM) ? nextM : 0;
          } else {
            this.M[idx] = 0;
          }
        } else {
          this.M[idx] = 0; // 陸境界反射
        }

        // --- 南北方向フラックス N (idx と idx+W の間) ---
        const dNorth = this.depth[idx + W];
        if (dCenter > 1 && dNorth > 1) {
          const dN = 0.5 * (dCenter + dNorth);
          const etaN = 0.5 * (this.eta[idx] + this.eta[idx + W]);
          const totalDepth = Math.max(0.1, dN + etaN);

          if (totalDepth > 0.2) {
            // 圧力勾配項: - g * totalDepth * dEta/dy (Y軸は南向きインデックス増加)
            const gradEtaY = (this.eta[idx + W] - this.eta[idx]) / dy;
            const pressGrad = -g * totalDepth * gradEtaY;

            const nVal = this.N[idx];
            const mVal = 0.25 * (this.M[idx] + this.M[idx - 1] + this.M[idx + W] + this.M[idx + W - 1]);
            const fluxMag = Math.hypot(mVal, nVal);
            const frictionFactor = (g * this.manningN * this.manningN * fluxMag) / Math.pow(Math.max(1.0, totalDepth), 7 / 3);

            const nextN = (nVal + pressGrad * dt) / (1.0 + frictionFactor * dt);
            this.N[idx] = Number.isFinite(nextN) ? nextN : 0;
          } else {
            this.N[idx] = 0;
          }
        } else {
          this.N[idx] = 0;
        }
      }
    }

    // 2. 連続の式の計算 (水位 eta の更新)
    for (let r = 1; r < H - 1; r++) {
      const rowOffset = r * W;
      for (let c = 1; c < W - 1; c++) {
        const idx = rowOffset + c;
        if (this.depth[idx] <= 1) continue; // 陸地はスキップ

        // フラックス発散: dM/dx + dN/dy
        const divFlux = (this.M[idx] - this.M[idx - 1]) / dx + (this.N[idx] - this.N[idx - W]) / dy;
        let newEta = this.eta[idx] - divFlux * dt;

        // 物理的安定性のための水深リミッター（引き波で海底以下 -depth に潜らないよう制限）
        if (newEta < -this.depth[idx]) {
          newEta = -this.depth[idx] * 0.95;
        }
        if (!Number.isFinite(newEta)) {
          newEta = 0;
        }

        this.eta[idx] = newEta;

        // 第1波到達時刻記録 (0.15m以上の水位変動)
        if (Math.abs(newEta) >= 0.15 && this.arrivalTime[idx] < 0) {
          this.arrivalTime[idx] = this.currentTimeSec;
        }
      }
    }

    // 3. 数値高周波ノイズ抑制（Shapiro フィルター / Laplacian 粘性平滑化）
    // 潮岬沖などの急深海底崖・斜面において、スタガード格子中央差分で励起される2Δx寄生モード（周期約1分の数値ノイズ）を減衰
    // 物理的な長波津波（波長50km以上、周期10分以上）の波高・伝播速度を完全に維持しつつ、急峻なグリッドスケール振動のみを吸収
    const filterCoeff = 0.03;
    for (let r = 1; r < H - 1; r++) {
      const rowOffset = r * W;
      for (let c = 1; c < W - 1; c++) {
        const idx = rowOffset + c;
        if (this.depth[idx] <= 1) continue;

        let diffSum = 0;
        let validNeighbors = 0;

        const val = this.eta[idx];
        const east = idx + 1;
        if (this.depth[east] > 1) { diffSum += this.eta[east] - val; validNeighbors++; }
        const west = idx - 1;
        if (this.depth[west] > 1) { diffSum += this.eta[west] - val; validNeighbors++; }
        const north = idx - W;
        if (this.depth[north] > 1) { diffSum += this.eta[north] - val; validNeighbors++; }
        const south = idx + W;
        if (this.depth[south] > 1) { diffSum += this.eta[south] - val; validNeighbors++; }

        if (validNeighbors > 0) {
          this.etaTemp[idx] = val + filterCoeff * (diffSum / validNeighbors);
        } else {
          this.etaTemp[idx] = val;
        }
      }
    }

    // 平滑化結果を反映し、最大波高を更新
    for (let r = 1; r < H - 1; r++) {
      const rowOffset = r * W;
      for (let c = 1; c < W - 1; c++) {
        const idx = rowOffset + c;
        if (this.depth[idx] > 1) {
          const smoothedEta = this.etaTemp[idx];
          this.eta[idx] = smoothedEta;
          if (smoothedEta > this.maxEta[idx]) {
            this.maxEta[idx] = smoothedEta;
          }
        }
      }
    }

    // 4. 外洋開境界条件（無反射・放射境界 Sommerfeld condition）
    // 西端 c=0, 東端 c=W-1, 北端 r=0, 南端 r=H-1
    for (let r = 0; r < H; r++) {
      // 西境界
      const idxW0 = r * W;
      const idxW1 = r * W + 1;
      const cW = Math.sqrt(g * Math.max(1, this.depth[idxW0]));
      this.eta[idxW0] = this.eta[idxW1] * Math.exp(-cW * dt / dx);

      // 東境界
      const idxE0 = r * W + (W - 1);
      const idxE1 = r * W + (W - 2);
      const cE = Math.sqrt(g * Math.max(1, this.depth[idxE0]));
      this.eta[idxE0] = this.eta[idxE1] * Math.exp(-cE * dt / dx);
    }

    for (let c = 0; c < W; c++) {
      // 北境界 (r=0)
      const idxN0 = c;
      const idxN1 = W + c;
      const cN = Math.sqrt(g * Math.max(1, this.depth[idxN0]));
      this.eta[idxN0] = this.eta[idxN1] * Math.exp(-cN * dt / dy);

      // 南境界 (r=H-1)
      const idxS0 = (H - 1) * W + c;
      const idxS1 = (H - 2) * W + c;
      const cS = Math.sqrt(g * Math.max(1, this.depth[idxS0]));
      this.eta[idxS0] = this.eta[idxS1] * Math.exp(-cS * dt / dy);
    }

    this.currentTimeSec += dt;
    this.currentStep++;

    // 観測点サンプリング
    if (this.currentStep % 2 === 0) {
      this.sampleObservationPoints();
    }
  }

  /**
   * 観測地点 1 点の時系列サンプリング（空間双線形補間＋局所高周波スパイク抑制）
   */
  public sampleSinglePoint(pt: ObservationPoint): void {
    const W = this.width;
    const H = this.height;
    const tSec = this.currentTimeSec;

    // 経度・緯度から浮動小数点グリッドインデックスを算出
    const cExact = ((pt.lon - this.metaBounds.lonMin) / (this.metaBounds.lonMax - this.metaBounds.lonMin)) * W;
    const rExact = ((this.metaBounds.latMax - pt.lat) / (this.metaBounds.latMax - this.metaBounds.latMin)) * H;

    const c0 = Math.floor(cExact);
    const r0 = Math.floor(rExact);
    const fx = Math.max(0, Math.min(1, cExact - c0));
    const fy = Math.max(0, Math.min(1, rExact - r0));

    let elev = 0;
    let u = 0;
    let v = 0;
    let totalWeight = 0;

    // 2x2近傍海洋セルの双線形補間（陸地セルは除外して海側のみで加重正規化）
    for (let dr = 0; dr <= 1; dr++) {
      for (let dc = 0; dc <= 1; dc++) {
        const c = c0 + dc;
        const r = r0 + dr;
        if (c >= 0 && c < W && r >= 0 && r < H) {
          const idx = r * W + c;
          if (this.depth[idx] > 1) {
            const w = (dc === 0 ? (1 - fx) : fx) * (dr === 0 ? (1 - fy) : fy);
            const totalD = Math.max(0.1, this.depth[idx] + this.eta[idx]);
            const cellU = this.M[idx] / totalD;
            const cellV = -this.N[idx] / totalD;

            elev += w * this.eta[idx];
            u += w * cellU;
            v += w * cellV;
            totalWeight += w;
          }
        }
      }
    }

    if (totalWeight > 0.001) {
      elev /= totalWeight;
      u /= totalWeight;
      v /= totalWeight;
    } else {
      // 周囲4点に海がない場合は最寄りの最近傍セル
      const c = Math.max(0, Math.min(W - 1, Math.round(cExact)));
      const r = Math.max(0, Math.min(H - 1, Math.round(rExact)));
      const idx = r * W + c;
      elev = this.eta[idx] || 0;
      const totalD = Math.max(0.1, Math.max(1, this.depth[idx]) + elev);
      u = this.M[idx] / totalD;
      v = -this.N[idx] / totalD;
    }

    if (!Number.isFinite(elev)) elev = 0;
    if (!Number.isFinite(u)) u = 0;
    if (!Number.isFinite(v)) v = 0;

    const speed = Math.hypot(u, v);
    let dirDeg = 0;
    if (speed > 0.01) {
      dirDeg = (Math.atan2(u, v) * 180) / Math.PI;
      if (dirDeg < 0) dirDeg += 360;
    }

    if (!pt.timeHistory) pt.timeHistory = [];

    // 高周波ステップ跳ね（1ステップで急変する数値スパイク）の局所平滑化
    let finalElev = elev;
    const histLen = pt.timeHistory.length;
    if (histLen >= 2) {
      const prev1 = pt.timeHistory[histLen - 1].elevation;
      const prev2 = pt.timeHistory[histLen - 2].elevation;
      const stepDiff = Math.abs(elev - prev1);
      // 1ステップ（4秒間隔）で0.3m以上の急激な数値跳ねがある場合、3点加重平均で平滑化
      if (stepDiff > 0.3) {
        finalElev = 0.45 * elev + 0.35 * prev1 + 0.2 * prev2;
      }
    }

    pt.timeHistory.push({
      timeSec: tSec,
      elevation: Number(finalElev.toFixed(3)),
      u: Number(u.toFixed(3)),
      v: Number(v.toFixed(3)),
      speed: Number(speed.toFixed(3)),
      directionDeg: Number(dirDeg.toFixed(1))
    });

    // 統計更新
    if (pt.maxWaveHeight === undefined || finalElev > pt.maxWaveHeight) {
      pt.maxWaveHeight = Number(finalElev.toFixed(2));
      pt.maxArrivalSec = tSec;
      pt.dominantDirectionDeg = Number(dirDeg.toFixed(1));
    }
    if (pt.minWaveHeight === undefined || finalElev < pt.minWaveHeight) {
      pt.minWaveHeight = Number(finalElev.toFixed(2));
    }
    if (pt.firstArrivalSec === undefined && Math.abs(finalElev) >= 0.15) {
      pt.firstArrivalSec = tSec;
    }
  }

  /**
   * 全観測地点の時系列サンプリング
   */
  public sampleObservationPoints(): void {
    for (const pt of this.observationPoints) {
      this.sampleSinglePoint(pt);
    }
  }
}
