import { BathymetryMeta, FaultParams, ObservationPoint } from '../types';
import { ShallowWaterSolver } from '../physics/shallowWater';
import { Language, FAULT_NAME_TRANSLATIONS, POINT_TRANSLATIONS, UI_TEXTS } from '../i18n';

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

    this.renderTerrainBackground(rawBathymetry);
  }

  /**
   * 海底地形の陰影段彩（カラーマップ＋陰影起伏）をオフスクリーンCanvasにプリレンダリング
   */
  private renderTerrainBackground(rawBathymetry: Int16Array): void {
    const W = this.meta.width;
    const H = this.meta.height;
    const imgData = this.terrainCtx.createImageData(W, H);
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
          dzdx = (rawBathymetry[idx + 1] - rawBathymetry[idx - 1]) * 0.0005;
          dzdy = (rawBathymetry[idx + W] - rawBathymetry[idx - W]) * 0.0005;
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

    this.terrainCtx.putImageData(imgData, 0, 0);
  }

  /**
   * 画面全体の再描画
   */
  public render(
    solver: ShallowWaterSolver,
    faults: FaultParams[],
    selectedPointId?: string,
    selectedPointIds?: Set<string>
  ): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, W, H);

    // 1. 地形背景の描画
    if (this.showBathymetry) {
      ctx.drawImage(this.terrainCanvas, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(0, 0, W, H);
    }

    // 2. 津波水位のオーバーレイ描画
    if (this.showWaveHeight) {
      this.renderWaveOverlay(solver);
      ctx.save();
      // スクリーンまたは通常合成
      ctx.globalAlpha = 0.88;
      ctx.drawImage(this.waveCanvas, 0, 0, W, H);
      ctx.restore();
    }

    // 3. 流速ベクトルの描画（指定間隔で間引き）
    if (this.showVelocityVectors && solver.currentTimeSec > 0) {
      this.renderVectors(solver);
    }

    // 4. 断層（波源・震源域）の描画
    if (this.showFaults) {
      this.renderFaults(faults);
    }

    // 5. 観測地点（各地の沖合評価点）の描画
    if (this.showObservationPoints) {
      this.renderObservationPoints(solver.observationPoints, selectedPointId, selectedPointIds);
    }

    // 6. スケールバー・凡例・タイムオーバーレイ
    this.renderHUD(solver);
  }

  /**
   * 水位変動 (eta) のピクセル描画
   */
  private renderWaveOverlay(solver: ShallowWaterSolver): void {
    const W = this.meta.width;
    const H = this.meta.height;
    const eta = solver.eta;
    const depth = solver.depth;
    const data = this.waveImage.data;

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

    this.waveCtx.putImageData(this.waveImage, 0, 0);
  }

  /**
   * 水平流速ベクトルの矢印描画
   */
  private renderVectors(solver: ShallowWaterSolver): void {
    const ctx = this.ctx;
    const step = 20; // 20ピクセルごとに矢印を描画
    const scale = 8.0; // 矢印の長さスケール

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.2;

    const W = this.meta.width;
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    const scaleX = canvasW / this.meta.width;
    const scaleY = canvasH / this.meta.height;

    for (let r = step; r < this.meta.height - step; r += step) {
      for (let c = step; c < this.meta.width - step; c += step) {
        const idx = r * W + c;
        if (solver.depth[idx] <= 5) continue;

        const totalD = solver.depth[idx] + solver.eta[idx];
        if (totalD <= 0.1) continue;

        const u = solver.M[idx] / totalD;
        const v = solver.N[idx] / totalD; // Y軸は下向き
        const speed = Math.hypot(u, v);

        // 流速が 0.15 m/s 以上の箇所のみ表示
        if (speed < 0.15) continue;

        const px = c * scaleX;
        const py = r * scaleY;
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

      // 走向方向の矩形を描画
      const strikeRad = (fault.strikeDeg * Math.PI) / 180;
      const metersPerPixelX = this.meta.dxMeters * (this.meta.width / this.canvas.width);
      const metersPerPixelY = this.meta.dyMeters * (this.meta.height / this.canvas.height);

      const lenPx = (fault.lengthKm * 1000) / metersPerPixelX;
      const widthPx = (fault.widthKm * 1000 * Math.cos((fault.dipDeg * Math.PI) / 180)) / metersPerPixelY;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(strikeRad - Math.PI / 2); // 走向角の回転

      // 断層矩形
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(-lenPx / 2, -widthPx / 2, lenPx, widthPx);
      ctx.fillRect(-lenPx / 2, -widthPx / 2, lenPx, widthPx);

      // すべり方向矢印
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

    // --- 南海トラフ海溝軸の目安線 (ガイド) ---
    ctx.restore();
  }

  /**
   * 経度・緯度をCanvas上のピクセル座標に変換
   */
  public lonLatToCanvas(lon: number, lat: number): { px: number; py: number } {
    const { lonMin, lonMax, latMin, latMax } = this.meta.bounds;
    const normX = (lon - lonMin) / (lonMax - lonMin);
    const normY = (latMax - lat) / (latMax - latMin);
    return {
      px: normX * this.canvas.width,
      py: normY * this.canvas.height
    };
  }

  /**
   * Canvas上のピクセル座標を経度・緯度に逆変換
   */
  public canvasToLonLat(px: number, py: number): { lon: number; lat: number } {
    const { lonMin, lonMax, latMin, latMax } = this.meta.bounds;
    const normX = px / this.canvas.width;
    const normY = py / this.canvas.height;
    return {
      lon: lonMin + normX * (lonMax - lonMin),
      lat: latMax - normY * (latMax - latMin)
    };
  }
}
