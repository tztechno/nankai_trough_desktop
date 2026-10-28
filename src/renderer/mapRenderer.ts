import { BathymetryMeta, FaultParams, Hypocenter, ObservationPoint } from '../types';
import { ShallowWaterSolver } from '../physics/shallowWater';
import { NestedGrid } from '../physics/nestedGrid';
import { Language, FAULT_NAME_TRANSLATIONS, POINT_TRANSLATIONS, REFERENCE_EVENT_NAMES, UI_TEXTS } from '../i18n';

export class MapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private meta: BathymetryMeta;
  public currentLang: Language = 'ja';

  // 背景（地形）のオフスクリーンキャッシュ
  private terrainCanvas: HTMLCanvasElement;
  private terrainCtx: CanvasRenderingContext2D;

  // 波高描画用の ImageData バッファ
  private waveImage: ImageData;
  private waveCanvas: HTMLCanvasElement;
  private waveCtx: CanvasRenderingContext2D;

  // 表示トグル
  public showBathymetry: boolean = true;
  public showWaveHeight: boolean = true;
  public showVelocityVectors: boolean = true;
  public showFaults: boolean = true;
  public showObservationPoints: boolean = true;

  // 高解像度の入れ子格子 (地形・波高の描画用キャッシュ)
  private nest: {
    grid: NestedGrid;
    terrainCanvas: HTMLCanvasElement;
    waveCanvas: HTMLCanvasElement;
    waveCtx: CanvasRenderingContext2D;
    waveImage: ImageData;
  } | null = null;

  // 表示ビュー (経緯度 → Canvas 変換)。縦横比は領域中央緯度の cosφ で固定し、地図が伸縮しないようにする
  private cosRef: number;
  private centerLon: number;
  private centerLat: number;
  private pxPerDegLat: number = 1;

  public setLanguage(lang: Language): void {
    this.currentLang = lang;
  }

  constructor(canvas: HTMLCanvasElement, meta: BathymetryMeta, rawBathymetry: Int16Array) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    this.meta = meta;

    // 地形オフスクリーン
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCanvas.width = meta.width;
    this.terrainCanvas.height = meta.height;
    const tCtx = this.terrainCanvas.getContext('2d');
    if (!tCtx) throw new Error('Failed to get terrain context');
    this.terrainCtx = tCtx;

    // 波高オフスクリーン
    this.waveCanvas = document.createElement('canvas');
    this.waveCanvas.width = meta.width;
    this.waveCanvas.height = meta.height;
    const wCtx = this.waveCanvas.getContext('2d');
    if (!wCtx) throw new Error('Failed to get wave context');
    this.waveCtx = wCtx;
    this.waveImage = this.waveCtx.createImageData(meta.width, meta.height);

    const { lonMin, lonMax, latMin, latMax } = meta.bounds;
    this.cosRef = Math.cos((((latMin + latMax) / 2) * Math.PI) / 180);
    this.centerLon = (lonMin + lonMax) / 2;
    this.centerLat = (latMin + latMax) / 2;

    this.renderTerrainBackground(rawBathymetry, meta.width, meta.height, this.terrainCtx, 1);
  }

  /**
   * 高解像度の入れ子格子を設定 (null で解除)。その範囲は入れ子格子の地形・波高で描画する
   */
  public setNestedGrid(grid: NestedGrid | null, rawBathymetry?: Int16Array): void {
    if (!grid || !rawBathymetry) {
      this.nest = null;
      return;
    }
    const W = grid.meta.width;
    const H = grid.meta.height;
    const terrainCanvas = document.createElement('canvas');
    terrainCanvas.width = W;
    terrainCanvas.height = H;
    const tCtx = terrainCanvas.getContext('2d');
    const waveCanvas = document.createElement('canvas');
    waveCanvas.width = W;
    waveCanvas.height = H;
    const waveCtx = waveCanvas.getContext('2d');
    if (!tCtx || !waveCtx) throw new Error('Failed to get nested grid context');
    // 陰影の勾配は1セルあたりの標高差から求めるので、格子間隔の比で補正する
    const slopeScale = grid.meta.dyDeg > 0 ? this.meta.dyDeg / grid.meta.dyDeg : 1;
    this.renderTerrainBackground(rawBathymetry, W, H, tCtx, slopeScale);
    this.nest = { grid, terrainCanvas, waveCanvas, waveCtx, waveImage: waveCtx.createImageData(W, H) };
  }

  /**
   * 指定した経緯度範囲が Canvas に収まるように表示を合わせる
   */
  public fitBounds(b: { lonMin: number; lonMax: number; latMin: number; latMax: number }): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (W <= 0 || H <= 0) return;
    this.centerLon = (b.lonMin + b.lonMax) / 2;
    this.centerLat = (b.latMin + b.latMax) / 2;
    this.pxPerDegLat = Math.min(W / ((b.lonMax - b.lonMin) * this.cosRef), H / (b.latMax - b.latMin));
    this.clampView();
  }

  /**
   * 解析領域全体 (全国) を表示
   */
  public fitDomain(): void {
    this.fitBounds(this.meta.bounds);
  }

  /**
   * Canvas 上の (px, py) を中心にズーム
   */
  public zoomAt(px: number, py: number, factor: number): void {
    const before = this.canvasToLonLat(px, py);
    this.pxPerDegLat *= factor;
    this.clampView();
    const after = this.canvasToLonLat(px, py);
    this.centerLon += before.lon - after.lon;
    this.centerLat += before.lat - after.lat;
    this.clampView();
  }

  /**
   * ドラッグによる平行移動 (Canvas ピクセル単位)
   */
  public panBy(dxPx: number, dyPx: number): void {
    this.centerLon -= dxPx / (this.pxPerDegLat * this.cosRef);
    this.centerLat += dyPx / this.pxPerDegLat;
    this.clampView();
  }

  /**
   * Canvas サイズ変更時に表示範囲を補正
   */
  public onResize(): void {
    this.clampView();
  }

  /**
   * ズーム倍率と表示中心を解析領域内に制限
   */
  private clampView(): void {
    const { lonMin, lonMax, latMin, latMax } = this.meta.bounds;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const minScale = Math.min(W / ((lonMax - lonMin) * this.cosRef), H / (latMax - latMin));
    this.pxPerDegLat = Math.max(minScale, Math.min(minScale * 40, this.pxPerDegLat));
    this.centerLon = Math.max(lonMin, Math.min(lonMax, this.centerLon));
    this.centerLat = Math.max(latMin, Math.min(latMax, this.centerLat));
  }

  /**
   * 解析領域 (格子画像) の Canvas 上の描画矩形
   */
  private domainRect(): { x: number; y: number; w: number; h: number } {
    const { lonMin, lonMax, latMin, latMax } = this.meta.bounds;
    const tl = this.lonLatToCanvas(lonMin, latMax);
    const br = this.lonLatToCanvas(lonMax, latMin);
    return { x: tl.px, y: tl.py, w: br.px - tl.px, h: br.py - tl.py };
  }

  /**
   * 海底地形の陰影段彩（カラーマップ＋陰影起伏）をオフスクリーンCanvasにプリレンダリング
   * slopeScale: 陰影の勾配の倍率 (格子が細かいほど1セルあたりの標高差が小さいので大きくする)
   */
  private renderTerrainBackground(rawBathymetry: Int16Array, W: number, H: number, target: CanvasRenderingContext2D, slopeScale: number): void {
    const imgData = target.createImageData(W, H);
    const data = imgData.data;

    // 光源方向 (北西からの平行光)
    const lx = -0.6;
    const ly = -0.6;
    const lz = 0.53;

    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const idx = r * W + c;
        const z = rawBathymetry[idx]; // 標高 (負: 海水深, 正: 陸)
        const pIdx = idx * 4;

        // 地形勾配による簡易陰影 (Hillshading)
        let dzdx = 0;
        let dzdy = 0;
        if (c > 0 && c < W - 1 && r > 0 && r < H - 1) {
          dzdx = (rawBathymetry[idx + 1] - rawBathymetry[idx - 1]) * 0.0005 * slopeScale;
          dzdy = (rawBathymetry[idx + W] - rawBathymetry[idx - W]) * 0.0005 * slopeScale;
        }
        // 法線ベクトル
        const nx = -dzdx;
        const ny = -dzdy;
        const nz = 1.0;
        const nLen = Math.hypot(nx, ny, nz);
        const shade = Math.max(0.3, Math.min(1.4, (nx * lx + ny * ly + nz * lz) / nLen + 0.3));

        if (z < 0) {
          // --- 海洋カラーマップ (水深) ---
          const depth = -z;
          let rVal: number, gVal: number, bVal: number;

          if (depth < 100) {
            // ごく浅瀬 (シアン・ターコイズ)
            const t = depth / 100;
            rVal = 14 + t * (8 - 14);
            gVal = 165 + t * (120 - 165);
            bVal = 190 + t * (180 - 190);
          } else if (depth < 1000) {
            // 大陸棚・斜面 (ティール・ブルー)
            const t = (depth - 100) / 900;
            rVal = 8 + t * (12 - 8);
            gVal = 120 + t * (55 - 120);
            bVal = 180 + t * (120 - 180);
          } else if (depth < 4000) {
            // 深海平原 (ディープネイビー)
            const t = (depth - 1000) / 3000;
            rVal = 12 + t * (8 - 12);
            gVal = 55 + t * (25 - 55);
            bVal = 120 + t * (60 - 120);
          } else {
            // 海溝 (南海トラフ最深部 / インディゴ)
            const t = Math.min(1, (depth - 4000) / 4000);
            rVal = 8 - t * 4;
            gVal = 25 - t * 15;
            bVal = 60 - t * 30;
          }

          data[pIdx] = Math.min(255, Math.floor(rVal * shade));
          data[pIdx + 1] = Math.min(255, Math.floor(gVal * shade));
          data[pIdx + 2] = Math.min(255, Math.floor(bVal * shade));
          data[pIdx + 3] = 255;
        } else {
          // --- 陸地カラーマップ ---
          const elev = z;
          let rVal: number, gVal: number, bVal: number;
          if (elev < 200) {
            // 平野部 (ダークグリーン/オリーブ)
            rVal = 30;
            gVal = 50;
            bVal = 35;
          } else if (elev < 1000) {
            // 山地
            rVal = 45;
            gVal = 58;
            bVal = 40;
          } else {
            // 高山部 (富士山・日本アルプス)
            const t = Math.min(1, (elev - 1000) / 2500);
            rVal = 45 + t * 40;
            gVal = 58 + t * 35;
            bVal = 40 + t * 35;
          }

          data[pIdx] = Math.min(255, Math.floor(rVal * shade));
          data[pIdx + 1] = Math.min(255, Math.floor(gVal * shade));
          data[pIdx + 2] = Math.min(255, Math.floor(bVal * shade));
          data[pIdx + 3] = 255;
        }
      }
    }

    target.putImageData(imgData, 0, 0);
  }

  /**
   * 画面全体の再描画
   */
  public render(
    solver: ShallowWaterSolver,
    faults: FaultParams[],
    selectedPointId?: string,
    selectedPointIds?: Set<string>,
    hypocenter?: Hypocenter,
    points?: ObservationPoint[]
  ): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const ctx = this.ctx;

    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, W, H);
    const rect = this.domainRect();

    // 1. 地形背景の描画
    if (this.showBathymetry) {
      ctx.drawImage(this.terrainCanvas, rect.x, rect.y, rect.w, rect.h);
    } else {
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }

    // 2. 津波水位のオーバーレイ描画
    if (this.showWaveHeight) {
      this.renderWaveOverlay(solver.eta, solver.depth, this.meta.width, this.meta.height, this.waveImage);
      this.waveCtx.putImageData(this.waveImage, 0, 0);
      ctx.save();
      // スクリーンまたは通常合成
      ctx.globalAlpha = 0.88;
      ctx.drawImage(this.waveCanvas, rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }

    // 2b. 高解像度の入れ子格子: その範囲を入れ子格子の地形・波高で描き直す
    if (this.nest) {
      this.renderNestedGrid();
    }

    // 3. 流速ベクトルの描画（指定間隔で間引き）
    if (this.showVelocityVectors && solver.currentTimeSec > 0) {
      this.renderVectors(solver);
    }

    // 4. 断層（波源・震源域）の描画
    if (this.showFaults) {
      this.renderFaults(faults);
      if (hypocenter) this.renderHypocenter(hypocenter);
    }

    // 5. 観測地点（各地の沖合評価点）の描画
    if (this.showObservationPoints) {
      this.renderObservationPoints(points ?? solver.observationPoints, selectedPointId, selectedPointIds);
    }

    // 6. スケールバー・凡例・タイムオーバーレイ
    this.renderHUD(solver);
  }

  /**
   * 入れ子格子の範囲の地形・波高と、その範囲の枠を描画
   */
  private renderNestedGrid(): void {
    const nest = this.nest!;
    const ctx = this.ctx;
    const b = nest.grid.meta.bounds;
    const tl = this.lonLatToCanvas(b.lonMin, b.latMax);
    const br = this.lonLatToCanvas(b.lonMax, b.latMin);
    const r = { x: tl.px, y: tl.py, w: br.px - tl.px, h: br.py - tl.py };

    if (this.showBathymetry) {
      ctx.drawImage(nest.terrainCanvas, r.x, r.y, r.w, r.h);
    } else {
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    if (this.showWaveHeight) {
      const solver = nest.grid.solver;
      this.renderWaveOverlay(solver.eta, solver.depth, nest.grid.meta.width, nest.grid.meta.height, nest.waveImage);
      nest.waveCtx.putImageData(nest.waveImage, 0, 0);
      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.drawImage(nest.waveCanvas, r.x, r.y, r.w, r.h);
      ctx.restore();
    }

    // 範囲の枠とラベル
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);
    if (r.w > 90) {
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(250, 204, 21, 0.95)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 4;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(UI_TEXTS[this.currentLang].nestedGridLabel, r.x + 3, r.y - 3);
    }
    ctx.restore();
  }

  /**
   * 水位変動 (eta) のピクセル描画 (結果は image に書き込む)
   */
  private renderWaveOverlay(eta: Float32Array, depth: Float32Array, W: number, H: number, image: ImageData): void {
    const data = image.data;

    // 波高閾値: 0.02m 以上を可視化
    const threshold = 0.02;

    for (let i = 0; i < W * H; i++) {
      const pIdx = i * 4;
      const h = eta[i];

      if (depth[i] <= 1 || Math.abs(h) < threshold) {
        data[pIdx + 3] = 0; // 完全透明
        continue;
      }

      if (h > 0) {
        // --- 押し波 (波高 > 0): 非線形スケールで深海波から浅海巨大波まで鮮明に表現 ---
        // 0.02m 〜 10m+
        const norm = Math.min(1.0, Math.sqrt(h / 8.0)); // 平方根スケーリング

        if (norm < 0.25) {
          // 微小波〜第1波 (0.02m〜0.5m): 発光シアン〜ライトティール
          const t = norm / 0.25;
          data[pIdx] = Math.floor(56 + t * 40);
          data[pIdx + 1] = Math.floor(189 + t * 50);
          data[pIdx + 2] = Math.floor(248 - t * 80);
          data[pIdx + 3] = Math.floor(120 + t * 70);
        } else if (norm < 0.6) {
          // 中波 (0.5m〜2.8m): ライムグリーン〜鮮烈なイエロー〜オレンジ
          const t = (norm - 0.25) / 0.35;
          data[pIdx] = Math.floor(96 + t * 159);
          data[pIdx + 1] = Math.floor(239 - t * 40);
          data[pIdx + 2] = Math.floor(80 - t * 60);
          data[pIdx + 3] = Math.floor(190 + t * 45);
        } else if (norm < 0.85) {
          // 大津波 (2.8m〜6m): 鮮やかなオレンジ〜朱色
          const t = (norm - 0.6) / 0.25;
          data[pIdx] = 255;
          data[pIdx + 1] = Math.floor(150 - t * 100);
          data[pIdx + 2] = 20;
          data[pIdx + 3] = Math.floor(235 + t * 20);
        } else {
          // 巨大津波 (6m〜10m+): 真紅〜白熱のホワイト
          const t = (norm - 0.85) / 0.15;
          data[pIdx] = 255;
          data[pIdx + 1] = Math.floor(50 + t * 205);
          data[pIdx + 2] = Math.floor(20 + t * 235);
          data[pIdx + 3] = 255;
        }
      } else {
        // --- 引き波 (波高 < 0): ディープバイオレット〜インディゴ ---
        const norm = Math.min(1.0, Math.sqrt(-h / 4.0));
        data[pIdx] = Math.floor(70 + norm * 50);
        data[pIdx + 1] = Math.floor(50 - norm * 20);
        data[pIdx + 2] = Math.floor(180 + norm * 75);
        data[pIdx + 3] = Math.floor(110 + norm * 100);
      }
    }
  }

  /**
   * 水平流速ベクトルの矢印描画
   */
  private renderVectors(solver: ShallowWaterSolver): void {
    const ctx = this.ctx;
    const step = 22; // 画面上22ピクセルごとに矢印を描画 (ズームに依らず一定密度)
    const scale = 8.0; // 矢印の長さスケール

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.2;

    const W = this.meta.width;
    const H = this.meta.height;
    const { lonMin, lonMax, latMin, latMax } = this.meta.bounds;

    for (let py = step / 2; py < this.canvas.height; py += step) {
      for (let px = step / 2; px < this.canvas.width; px += step) {
        const { lon, lat } = this.canvasToLonLat(px, py);
        // 入れ子格子の範囲は入れ子格子の流速を使う
        const inNest = this.nest !== null && this.nest.grid.contains(lon, lat);
        const src = inNest ? this.nest!.grid.solver : solver;
        const gm = inNest ? this.nest!.grid.meta : this.meta;
        const gW = inNest ? gm.width : W;
        const gH = inNest ? gm.height : H;
        const gb = inNest ? gm.bounds : { lonMin, lonMax, latMin, latMax };
        const c = Math.floor(((lon - gb.lonMin) / (gb.lonMax - gb.lonMin)) * gW);
        const r = Math.floor(((gb.latMax - lat) / (gb.latMax - gb.latMin)) * gH);
        if (c < 1 || c >= gW - 1 || r < 1 || r >= gH - 1) continue;
        const idx = r * gW + c;
        if (src.depth[idx] <= 5) continue;

        const totalD = src.depth[idx] + src.eta[idx];
        if (totalD <= 0.1) continue;

        const u = src.M[idx] / totalD;
        const v = src.N[idx] / totalD; // Y軸は下向き
        const speed = Math.hypot(u, v);

        // 流速が 0.15 m/s 以上の箇所のみ表示
        if (speed < 0.15) continue;

        const arrowLen = Math.min(22, speed * scale);
        const angle = Math.atan2(v, u);

        const endX = px + arrowLen * Math.cos(angle);
        const endY = py + arrowLen * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 矢じり
        const headLen = 4;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLen * Math.cos(angle - Math.PI / 6),
          endY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          endX - headLen * Math.cos(angle + Math.PI / 6),
          endY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * 震源断層の描画
   */
  private renderFaults(faults: FaultParams[]): void {
    const ctx = this.ctx;
    ctx.save();

    for (const fault of faults) {
      const { px, py } = this.lonLatToCanvas(fault.epicenterLon, fault.epicenterLat);
      const isSubfault = fault.subfault === true;

      // 走向方向の矩形 (断層面の地表投影) を4隅の経緯度から描画
      const strikeRad = (fault.strikeDeg * Math.PI) / 180;
      const halfL = (fault.lengthKm * 1000) / 2;
      const halfW = (fault.widthKm * 1000 * Math.cos((fault.dipDeg * Math.PI) / 180)) / 2;
      const latM = 111132;
      const lonM = latM * Math.cos((fault.epicenterLat * Math.PI) / 180);
      // 走向方向 (東, 北) = (sinθ, cosθ)、走向直交方向 = (cosθ, -sinθ)
      const sx = Math.sin(strikeRad), sy = Math.cos(strikeRad);
      const nx = Math.cos(strikeRad), ny = -Math.sin(strikeRad);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
        const east = a * halfL * sx + b * halfW * nx;
        const north = a * halfL * sy + b * halfW * ny;
        return this.lonLatToCanvas(fault.epicenterLon + east / lonM, fault.epicenterLat + north / latM);
      });

      ctx.save();
      ctx.beginPath();
      corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py)));
      ctx.closePath();
      if (isSubfault) {
        // すべり分布の小断層: すべり量が大きいほど濃い赤で塗る (背景 約9m → 淡色、超大すべり 40m → 濃色)
        ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.6, 0.06 + fault.slipM / 70).toFixed(3)})`;
        ctx.fill();
        ctx.restore();
        continue;
      }
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 震央マーク (★)
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', px, py);
      ctx.strokeText('★', px, py);

      // ラベル
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      const faultLabel = FAULT_NAME_TRANSLATIONS[this.currentLang][fault.name] || fault.name;
      ctx.fillText(faultLabel, px, py - 14);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  /**
   * 実際の震源 (破壊開始点) の描画。断層セグメント中心の ★ と区別するため、赤丸に白い × で表す。
   * 想定地震の参考震央 (歴史地震の推定値) は中抜きの赤い円と × で区別する
   */
  private renderHypocenter(hypo: Hypocenter): void {
    const ctx = this.ctx;
    const { px, py } = this.lonLatToCanvas(hypo.lon, hypo.lat);
    const r = 9;
    const isReference = hypo.referenceEvent !== undefined;
    ctx.save();

    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    if (isReference) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
    } else {
      ctx.fillStyle = '#dc2626';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
    }
    ctx.lineWidth = 2;
    ctx.stroke();

    const k = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(px - k, py - k);
    ctx.lineTo(px + k, py + k);
    ctx.moveTo(px + k, py - k);
    ctx.lineTo(px - k, py + k);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const t = UI_TEXTS[this.currentLang];
    let label: string;
    if (isReference) {
      const eventName = REFERENCE_EVENT_NAMES[this.currentLang][hypo.referenceEvent!] ?? hypo.referenceEvent!;
      label = t.hypocenterReferenceLabel(eventName);
    } else if (hypo.ruptureStart) {
      label = t.ruptureStartLabel(hypo.depthKm ?? 20);
    } else {
      label = hypo.depthKm !== undefined ? t.hypocenterLabel(hypo.depthKm) : t.hypocenterLabelNoDepth;
    }

    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#fecaca';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 5;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, px + r + 5, py);
    ctx.restore();
  }

  /**
   * 観測地点（各地の沖合評価点）の描画
   */
  private renderObservationPoints(
    points: ObservationPoint[],
    focusedPointId?: string,
    selectedPointIds?: Set<string>
  ): void {
    const ctx = this.ctx;
    ctx.save();

    for (const pt of points) {
      const { px, py } = this.lonLatToCanvas(pt.lon, pt.lat);
      const isFocused = pt.id === focusedPointId;
      const isChecked = !selectedPointIds || selectedPointIds.has(pt.id);

      ctx.save();

      // チェックされていない地点は透過度を下げて控えめに表示
      if (!isChecked) {
        ctx.globalAlpha = 0.32;
      }

      // 波が到達している場合の波紋パルスエフェクト
      if (pt.firstArrivalSec !== undefined && pt.maxWaveHeight && pt.maxWaveHeight > 0.2) {
        ctx.beginPath();
        ctx.arc(px, py, 14 + (Math.sin(Date.now() * 0.005) + 1) * 4, 0, Math.PI * 2);
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // フォーカス地点の外周オーラリング
      if (isFocused) {
        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ピン円形
      ctx.beginPath();
      ctx.arc(px, py, isFocused ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = pt.color;
      ctx.fill();
      ctx.strokeStyle = isFocused ? '#ffffff' : '#0f172a';
      ctx.lineWidth = isFocused ? 2.5 : 1.5;
      ctx.stroke();

      // 波の主侵入方向の矢印表示（計算結果がある場合）
      if (pt.dominantDirectionDeg !== undefined && pt.maxWaveHeight && pt.maxWaveHeight > 0.3) {
        const dirRad = ((pt.dominantDirectionDeg - 90) * Math.PI) / 180;
        const arrowDist = 24;
        const ax = px + Math.cos(dirRad) * arrowDist;
        const ay = py + Math.sin(dirRad) * arrowDist;

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(ax, ay);
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // 地点ラベル＆最大波高バッジ
      ctx.font = isFocused
        ? 'bold 12px -apple-system, sans-serif'
        : '11px -apple-system, sans-serif';
      ctx.fillStyle = isFocused ? '#38bdf8' : '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur = 5;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      let label = POINT_TRANSLATIONS[this.currentLang][pt.id] || pt.name;
      if (this.currentLang === 'en' && label.startsWith('観測点')) {
        label = label.replace('観測点', 'Point');
      }
      if (pt.maxWaveHeight !== undefined && pt.maxWaveHeight > 0.1) {
        label += ` (${pt.maxWaveHeight.toFixed(1)}m)`;
      }
      ctx.fillText(label, px + 11, py);

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * HUD (スケールバー、波高カラーバー、方位磁針) の描画
   */
  private renderHUD(solver: ShallowWaterSolver): void {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.save();

    // --- 波高カラーバー凡例 (右下) ---
    const legendW = 180;
    const legendH = 14;
    const legX = W - legendW - 20;
    const legY = H - 36;

    // 背景パネル
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.roundRect(legX - 10, legY - 18, legendW + 20, legendH + 30, 6);
    ctx.fill();
    ctx.stroke();

    // グラデーションバー
    const grad = ctx.createLinearGradient(legX, 0, legX + legendW, 0);
    grad.addColorStop(0, '#38bdf8');   // 0m
    grad.addColorStop(0.2, '#4ade80'); // 2m
    grad.addColorStop(0.5, '#fb923c'); // 5m
    grad.addColorStop(0.8, '#ef4444'); // 8m
    grad.addColorStop(1.0, '#ffffff'); // 10m+

    ctx.fillStyle = grad;
    ctx.fillRect(legX, legY, legendW, legendH);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(UI_TEXTS[this.currentLang].legendWaveHeight, legX + legendW / 2, legY - 6);
    ctx.fillText('0', legX, legY + legendH + 10);
    ctx.fillText('2m', legX + legendW * 0.2, legY + legendH + 10);
    ctx.fillText('5m', legX + legendW * 0.5, legY + legendH + 10);
    ctx.fillText('10m+', legX + legendW, legY + legendH + 10);

    // --- 地震発生からの経過時間 (左下。録画した動画でも時刻がわかるように) ---
    const tSec = solver.currentTimeSec;
    const hh = Math.floor(tSec / 3600);
    const mm = Math.floor((tSec % 3600) / 60);
    const ss = Math.floor(tSec % 60);
    const timeLabel = `${UI_TEXTS[this.currentLang].hudElapsed} ${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    ctx.font = '600 14px "JetBrains Mono", monospace';
    const tw = ctx.measureText(timeLabel).width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(14, H - 44, tw + 20, 30, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeLabel, 24, H - 29);

    ctx.restore();
  }

  /**
   * 経度・緯度をCanvas上のピクセル座標に変換
   */
  public lonLatToCanvas(lon: number, lat: number): { px: number; py: number } {
    return {
      px: this.canvas.width / 2 + (lon - this.centerLon) * this.pxPerDegLat * this.cosRef,
      py: this.canvas.height / 2 - (lat - this.centerLat) * this.pxPerDegLat
    };
  }

  /**
   * Canvas上のピクセル座標を経度・緯度に逆変換
   */
  public canvasToLonLat(px: number, py: number): { lon: number; lat: number } {
    return {
      lon: this.centerLon + (px - this.canvas.width / 2) / (this.pxPerDegLat * this.cosRef),
      lat: this.centerLat - (py - this.canvas.height / 2) / this.pxPerDegLat
    };
  }
}
