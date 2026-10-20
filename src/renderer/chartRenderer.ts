import { Chart, registerables } from 'chart.js';
import { ObservationPoint } from '../types';
import { Language, POINT_TRANSLATIONS, UI_TEXTS } from '../i18n';

Chart.register(...registerables);

export class ChartRenderer {
  private canvas: HTMLCanvasElement;
  private chart: Chart | null = null;
  private currentLang: Language = 'ja';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initChart();
  }

  public setLanguage(lang: Language): void {
    this.currentLang = lang;
    if (this.chart) {
      if (this.chart.options.scales?.x?.title) {
        this.chart.options.scales.x.title.text = UI_TEXTS[lang].chartXAxisLabel;
      }
      if (this.chart.options.scales?.y?.title) {
        this.chart.options.scales.y.title.text = UI_TEXTS[lang].chartYAxisLabel;
      }
      this.chart.update('none');
    }
  }

  private initChart(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            title: {
              display: true,
              text: UI_TEXTS[this.currentLang].chartXAxisLabel,
              color: '#94a3b8',
              font: { size: 11 }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.07)'
            },
            ticks: {
              color: '#94a3b8',
              font: { size: 10 },
              maxTicksLimit: 12
            }
          },
          y: {
            title: {
              display: true,
              text: UI_TEXTS[this.currentLang].chartYAxisLabel,
              color: '#94a3b8',
              font: { size: 11 }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.07)'
            },
            ticks: {
              color: '#94a3b8',
              font: { size: 10 }
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#e2e8f0',
              font: { size: 11, family: 'Inter, sans-serif' },
              boxWidth: 12
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1
          }
        }
      }
    });
  }

  /**
   * 観測地点のデータでグラフを更新
   */
  public updateChart(
    points: ObservationPoint[],
    selectedPointIds?: Set<string>,
    focusedPointId?: string,
    mode: 'selected' | 'focus' | 'all' = 'selected'
  ): void {
    if (!this.chart) return;

    let targetPoints: ObservationPoint[] = [];

    if (mode === 'focus') {
      targetPoints = focusedPointId
        ? points.filter((p) => p.id === focusedPointId)
        : (points.length > 0 ? [points[0]] : []);
    } else if (mode === 'all') {
      targetPoints = points;
    } else {
      // mode === 'selected' (チェックボックス選択地点)
      if (selectedPointIds && selectedPointIds.size > 0) {
        targetPoints = points.filter((p) => selectedPointIds.has(p.id));
      } else if (focusedPointId) {
        targetPoints = points.filter((p) => p.id === focusedPointId);
      } else {
        targetPoints = [];
      }
    }

    if (targetPoints.length === 0 || !targetPoints[0].timeHistory?.length) {
      this.chart.data.labels = [];
      this.chart.data.datasets = [];
      this.chart.update('none');
      return;
    }

    // X軸ラベル (時間: 分:秒)
    const refHistory = targetPoints[0].timeHistory || [];
    const labels = refHistory.map((item) => {
      const mins = Math.floor(item.timeSec / 60);
      const secs = Math.floor(item.timeSec % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    });

    const isSingle = targetPoints.length === 1;

    // フォーカス地点を最前面に描画するため、ソートして末尾へ配置
    const sortedPoints = [...targetPoints].sort((a, b) => {
      if (a.id === focusedPointId) return 1;
      if (b.id === focusedPointId) return -1;
      return 0;
    });

    const datasets = sortedPoints.map((pt) => {
      const data = (pt.timeHistory || []).map((h) => h.elevation);
      const isFocused = pt.id === focusedPointId;
      let displayName = POINT_TRANSLATIONS[this.currentLang][pt.id] || pt.name;
      if (this.currentLang === 'en' && displayName.startsWith('観測点')) {
        displayName = displayName.replace('観測点', 'Point');
      }
      return {
        label: `${displayName} (Max: ${(pt.maxWaveHeight ?? 0).toFixed(1)}m)`,
        data,
        borderColor: pt.color,
        backgroundColor: `${pt.color}22`,
        borderWidth: isSingle ? 2.5 : isFocused ? 2.6 : 1.6,
        pointRadius: 0,
        fill: isSingle ? true : false,
        tension: 0.2
      };
    });

    this.chart.data.labels = labels;
    this.chart.data.datasets = datasets;
    this.chart.update('none');
  }

  /**
   * 方式A: 全期間シミュレーションデータを出力 (地震発生 t=0〜)
   */
  public static exportFullCSV(point: ObservationPoint): void {
    if (!point.timeHistory || point.timeHistory.length === 0) {
      alert('シミュレーションデータがありません。\nシミュレーションを再生（または「一括高速計算」）してから出力してください。');
      return;
    }

    const lines: string[] = [];
    lines.push(`# Tsunami Wave Boundary Condition for Phase 2 Simulation (Full Timeline)`);
    lines.push(`# Location: ${point.name} (Lon: ${point.lon}, Lat: ${point.lat})`);
    lines.push(`# Max Wave Height: ${point.maxWaveHeight ?? 0} m, First Arrival: ${point.firstArrivalSec ?? 'N/A'} s`);
    lines.push(`Time_sec,Elevation_m,U_velocity_m_s,V_velocity_m_s,Speed_m_s,Direction_deg`);

    // 先頭行が t=0 でない場合、初期状態 (t=0.0) を確実に先頭へ補完
    const history = [...point.timeHistory];
    if (history.length > 0 && history[0].timeSec > 0.001) {
      history.unshift({
        timeSec: 0,
        elevation: 0,
        u: 0,
        v: 0,
        speed: 0,
        directionDeg: 0
      });
    }

    for (const row of history) {
      lines.push(`${row.timeSec.toFixed(1)},${row.elevation.toFixed(3)},${row.u.toFixed(3)},${row.v.toFixed(3)},${row.speed.toFixed(3)},${row.directionDeg.toFixed(1)}`);
    }

    ChartRenderer.triggerDownload(lines, `tsunami_boundary_full_${point.id}.csv`);
  }

  /**
   * 方式B: 市街地連携用トリミング波形を出力 (第1波到達前2分〜主要波通過までを t=0 に正規化)
   */
  public static exportCityTrimmedCSV(point: ObservationPoint): void {
    if (!point.timeHistory || point.timeHistory.length === 0) {
      alert('シミュレーションデータがありません。\nシミュレーションを再生（または「一括高速計算」）してから出力してください。');
      return;
    }

    // 第1波到達時刻の判定（未検出なら最大波高時刻を補助利用）
    let arrivalSec = point.firstArrivalSec;
    if (arrivalSec === undefined && (point.maxWaveHeight ?? 0) >= 0.05) {
      arrivalSec = point.maxArrivalSec;
    }

    if (arrivalSec === undefined) {
      const confirmFull = confirm(
        `【${point.name}】にはまだ明確な津波（水位変動 >= 0.05m）が到達していません。\n全期間データ（方式A）を出力しますか？`
      );
      if (confirmFull) {
        ChartRenderer.exportFullCSV(point);
      }
      return;
    }

    // 切り出し開始時刻: 第1波到達の120秒（2分）前（引き波などの先行兆候を確実に保持）
    const tStartTarget = Math.max(0, arrivalSec - 120);

    // 切り出し終了時刻: 最大波高時刻から35分後、または第1波到達から45分後
    const maxT = point.maxArrivalSec ?? arrivalSec;
    const tEndTarget = Math.max(maxT + 2100, arrivalSec + 2700);

    const trimmedRows = point.timeHistory.filter(
      (h) => h.timeSec >= tStartTarget && h.timeSec <= tEndTarget
    );

    if (trimmedRows.length === 0) {
      ChartRenderer.exportFullCSV(point);
      return;
    }

    const actualTStart = trimmedRows[0].timeSec;
    const lines: string[] = [];
    lines.push(`# Tsunami Boundary Wave Condition for City Simulation (Phase 2)`);
    lines.push(`# Location: ${point.name} (Lon: ${point.lon}, Lat: ${point.lat})`);
    lines.push(`# Mode: Trimmed Effective Wave (Shifted to t=0 at 2-min before arrival)`);
    lines.push(`# Original Absolute First Arrival: ${point.firstArrivalSec?.toFixed(1) ?? 'N/A'} s`);
    lines.push(`# Original Absolute Max Surge: ${point.maxWaveHeight ?? 0} m (at ${point.maxArrivalSec?.toFixed(1) ?? 'N/A'} s)`);
    lines.push(`# Time Offset: -${actualTStart.toFixed(1)} s (Absolute_Time_sec = Time_sec + ${actualTStart.toFixed(1)})`);
    lines.push(`Time_sec,Elevation_m,U_velocity_m_s,V_velocity_m_s,Speed_m_s,Direction_deg`);

    for (const row of trimmedRows) {
      const relTime = row.timeSec - actualTStart;
      lines.push(`${relTime.toFixed(1)},${row.elevation.toFixed(3)},${row.u.toFixed(3)},${row.v.toFixed(3)},${row.speed.toFixed(3)},${row.directionDeg.toFixed(1)}`);
    }

    ChartRenderer.triggerDownload(lines, `tsunami_boundary_city_${point.id}.csv`);
  }

  /**
   * 複数地点の全期間シミュレーションデータの一括出力
   */
  public static exportMultipleFullCSV(points: ObservationPoint[]): void {
    if (points.length === 0) {
      alert('出力対象の観測地点をチェックボックスで1つ以上選択してください。');
      return;
    }
    points.forEach((pt, idx) => {
      setTimeout(() => {
        ChartRenderer.exportFullCSV(pt);
      }, idx * 150);
    });
  }

  /**
   * 複数地点の市街地連携用トリミング波形データの一括出力
   */
  public static exportMultipleCityTrimmedCSV(points: ObservationPoint[]): void {
    if (points.length === 0) {
      alert('出力対象の観測地点をチェックボックスで1つ以上選択してください。');
      return;
    }
    points.forEach((pt, idx) => {
      setTimeout(() => {
        ChartRenderer.exportCityTrimmedCSV(pt);
      }, idx * 150);
    });
  }

  /**
   * 互換用メソッド
   */
  public static exportCSV(point: ObservationPoint): void {
    ChartRenderer.exportCityTrimmedCSV(point);
  }

  private static triggerDownload(lines: string[], filename: string): void {
    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
