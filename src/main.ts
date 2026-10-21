import { BathymetryMeta, FaultParams, Hypocenter, ObservationPoint, RuptureParams } from './types';
import { FAULT_PRESETS, DEFAULT_OBSERVATION_POINTS, PresetScenario } from './data/presets';
import { computeInitialDisplacementGrid } from './physics/okada';
import { ShallowWaterSolver } from './physics/shallowWater';
import { MapRenderer } from './renderer/mapRenderer';
import { ChartRenderer } from './renderer/chartRenderer';
import { VideoRecorder } from './renderer/videoRecorder';
import { CustomFaultInput, MAX_INTERPLATE_DEPTH_KM, SlabModel, faultOnSlab, interfaceFaultSize, slipFromMagnitude, toFaultParams } from './data/slab';
import { notify, saveBlob, setDialogLabels, showAlert, showConfirm } from './ui/dialog';
import { Language, UI_TEXTS, SCENARIO_TRANSLATIONS, POINT_TRANSLATIONS, COMPASS_DIRECTIONS, FAULT_NAME_TRANSLATIONS } from './i18n';

class App {
  private meta!: BathymetryMeta;
  private rawBathymetry!: Int16Array;
  private solver!: ShallowWaterSolver;
  private mapRenderer!: MapRenderer;
  private chartRenderer!: ChartRenderer;

  // 状態管理
  private currentLang: Language = (localStorage.getItem('nankai_tsunami_lang') as Language) || 'ja';
  private currentScenario: PresetScenario = FAULT_PRESETS[0];
  private activeFaults: FaultParams[] = [];
  // 表示する震源 (歴史地震プリセットのみ。震源クリック指定時は表示しない)
  private activeHypocenter: Hypocenter | undefined;
  // 破壊伝播 (内閣府モデルのみ。震源クリック指定時は全域同時破壊)
  private activeRupture: RuptureParams | undefined;

  // プレート境界形状 (Slab) とクリック指定したカスタム断層
  private slab: SlabModel | null = null;
  private customFault: CustomFaultInput | null = null;
  private slabInfoMessage: (() => string) | null = null;
  private observationPoints: ObservationPoint[] = [];
  private focusedPointId: string = 'muroto';
  private selectedPointIds: Set<string> = new Set();
  private chartViewMode: 'selected' | 'focus' | 'all' = 'selected';

  private isRunning: boolean = false;
  private speedMultiplier: number = 5;
  private maxDurationSec: number = 7200; // 120分 (推奨デフォルト)

  // モード: 'none' | 'pick-epicenter' | 'add-point'
  private clickMode: 'none' | 'pick-epicenter' | 'add-point' = 'none';

  // 地図のドラッグ移動
  private dragStart: { x: number; y: number; lastX: number; lastY: number } | null = null;
  private suppressNextClick: boolean = false;
  // ユーザーがズーム・移動した後は、リサイズ時に表示範囲を自動で合わせ直さない
  private viewAdjustedByUser: boolean = false;

  // 動画録画
  private recorder: VideoRecorder | null = null;
  private recordExt: 'mp4' | 'webm' = 'mp4';
  private frameCount: number = 0;
  private btnRecord!: HTMLButtonElement;

  // DOM要素
  private btnLangJa!: HTMLButtonElement;
  private btnLangEn!: HTMLButtonElement;
  private mapCanvas!: HTMLCanvasElement;
  private chartCanvas!: HTMLCanvasElement;
  private btnPlayPause!: HTMLButtonElement;
  private btnFastForward!: HTMLButtonElement;
  private btnReset!: HTMLButtonElement;
  private elapsedTimeDisplay!: HTMLElement;
  private globalMaxHeightDisplay!: HTMLElement;
  private simProgressBar!: HTMLElement;
  private simProgressText!: HTMLElement;
  private maxDurationLabel!: HTMLElement;
  private simStatusBadge!: HTMLElement;
  private statusText!: HTMLElement;
  private scenarioSelect!: HTMLSelectElement;
  private scenarioDesc!: HTMLElement;
  private magSlider!: HTMLInputElement;
  private magVal!: HTMLElement;
  private slipSlider!: HTMLInputElement;
  private slipVal!: HTMLElement;
  private pointsListEl!: HTMLElement;
  private chartPointTitle!: HTMLElement;
  private chartPointSummary!: HTMLElement;
  private cursorCoords!: HTMLElement;
  private mapTooltip!: HTMLElement;
  private pointSelect!: HTMLSelectElement;
  private btnResetPoints!: HTMLButtonElement;
  private btnSelectAllPoints!: HTMLButtonElement;
  private btnDeselectAllPoints!: HTMLButtonElement;
  private selectedPointsCount!: HTMLElement;
  private exportCityCount!: HTMLElement;
  private exportFullCount!: HTMLElement;
  private chartSelectedCount!: HTMLElement;
  private btnChartSelected!: HTMLButtonElement;
  private btnChartFocus!: HTMLButtonElement;
  private btnChartAll!: HTMLButtonElement;

  public async init() {
    this.cacheDomElements();
    this.setupEventListeners();

    // 1. 地形データとメタデータの取得
    this.statusText.textContent = this.currentLang === 'ja' ? '海底地形データ読込中...' : 'Loading bathymetry data...';
    try {
      const metaRes = await fetch('/bathymetry_meta.json');
      this.meta = await metaRes.json();

      const binRes = await fetch('/bathymetry.bin');
      const binBuffer = await binRes.arrayBuffer();
      this.rawBathymetry = new Int16Array(binBuffer);
    } catch (e) {
      console.error(e);
      this.statusText.textContent = UI_TEXTS[this.currentLang].statusDataError;
      showAlert(this.currentLang === 'ja' ? '海底地形データの読み込みに失敗しました。' : 'Failed to load bathymetry data.');
      return;
    }

    this.slab = await SlabModel.load();

    // 2. ソルバーとレンダラーの初期化
    // 全国版 (1.5分メッシュ) の時間刻み。CFL条件を満たさない場合はソルバー側で自動調整される
    this.solver = new ShallowWaterSolver(this.meta, this.rawBathymetry, 3.0);
    this.observationPoints = JSON.parse(JSON.stringify(DEFAULT_OBSERVATION_POINTS));
    this.solver.observationPoints = this.observationPoints;
    // デフォルトで全プリセット地点をチェック済みに設定（指定箇所＋プリセット全出力に対応）
    this.selectedPointIds = new Set(this.observationPoints.map((p) => p.id));

    this.resizeCanvases();
    // 地図領域のサイズ変化を監視して Canvas 解像度を追従させる。
    // WebKit (デスクトップ版) では初期化時点でCSSのレイアウトが確定しておらず、
    // window の resize イベントだけでは Canvas が誤ったサイズのまま残り、地図の縦伸び・クリック位置ずれの原因になっていた
    new ResizeObserver(() => {
      if (!this.resizeCanvases()) return;
      if (!this.mapRenderer) return;
      if (this.viewAdjustedByUser) {
        this.mapRenderer.onResize();
      } else {
        this.mapRenderer.fitBounds(this.currentScenario.view);
      }
      this.render();
    }).observe(this.mapCanvas.parentElement!);

    this.mapRenderer = new MapRenderer(this.mapCanvas, this.meta, this.rawBathymetry);
    this.chartRenderer = new ChartRenderer(this.chartCanvas);

    // 3. 言語の適用（保存された言語またはデフォルト日本語）
    this.setLanguage(this.currentLang);

    // 4. 初期波源の生成
    this.applyScenario(this.currentScenario);

    this.statusText.textContent = UI_TEXTS[this.currentLang].statusReady;
    this.render();

    // 5. アニメーションループ開始
    requestAnimationFrame((t) => this.loop(t));
  }

  private cacheDomElements() {
    this.btnLangJa = document.getElementById('btn-lang-ja') as HTMLButtonElement;
    this.btnLangEn = document.getElementById('btn-lang-en') as HTMLButtonElement;
    this.mapCanvas = document.getElementById('map-canvas') as HTMLCanvasElement;
    this.chartCanvas = document.getElementById('wave-chart') as HTMLCanvasElement;
    this.btnPlayPause = document.getElementById('btn-play-pause') as HTMLButtonElement;
    this.btnFastForward = document.getElementById('btn-fast-forward') as HTMLButtonElement;
    this.btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
    this.elapsedTimeDisplay = document.getElementById('elapsed-time-display')!;
    this.globalMaxHeightDisplay = document.getElementById('global-max-height')!;
    this.simProgressBar = document.getElementById('sim-progress-bar')!;
    this.simProgressText = document.getElementById('sim-progress-text')!;
    this.maxDurationLabel = document.getElementById('max-duration-label')!;
    this.simStatusBadge = document.getElementById('sim-status-badge')!;
    this.statusText = document.getElementById('status-text')!;
    this.scenarioSelect = document.getElementById('scenario-select') as HTMLSelectElement;
    this.scenarioDesc = document.getElementById('scenario-description')!;
    this.magSlider = document.getElementById('magnitude-slider') as HTMLInputElement;
    this.magVal = document.getElementById('magnitude-val')!;
    this.slipSlider = document.getElementById('slip-slider') as HTMLInputElement;
    this.slipVal = document.getElementById('slip-val')!;
    this.pointsListEl = document.getElementById('observation-points-list')!;
    this.chartPointTitle = document.getElementById('chart-point-title')!;
    this.chartPointSummary = document.getElementById('chart-point-summary')!;
    this.cursorCoords = document.getElementById('cursor-coords')!;
    this.mapTooltip = document.getElementById('map-tooltip')!;
    this.pointSelect = document.getElementById('point-select') as HTMLSelectElement;
    this.btnResetPoints = document.getElementById('btn-reset-points') as HTMLButtonElement;
    this.btnSelectAllPoints = document.getElementById('btn-select-all-points') as HTMLButtonElement;
    this.btnDeselectAllPoints = document.getElementById('btn-deselect-all-points') as HTMLButtonElement;
    this.selectedPointsCount = document.getElementById('selected-points-count')!;
    this.exportCityCount = document.getElementById('export-city-count')!;
    this.exportFullCount = document.getElementById('export-full-count')!;
    this.chartSelectedCount = document.getElementById('chart-selected-count')!;
    this.btnChartSelected = document.getElementById('btn-chart-selected') as HTMLButtonElement;
    this.btnChartFocus = document.getElementById('btn-chart-focus') as HTMLButtonElement;
    this.btnChartAll = document.getElementById('btn-chart-all') as HTMLButtonElement;
    this.btnRecord = document.getElementById('btn-record') as HTMLButtonElement;
  }

  public setLanguage(lang: Language) {
    this.currentLang = lang;
    localStorage.setItem('nankai_tsunami_lang', lang);
    document.documentElement.lang = lang;

    // 言語ボタンのアクティブ表示切替
    if (this.btnLangJa && this.btnLangEn) {
      if (lang === 'ja') {
        this.btnLangJa.classList.add('active');
        this.btnLangEn.classList.remove('active');
      } else {
        this.btnLangEn.classList.add('active');
        this.btnLangJa.classList.remove('active');
      }
    }

    const t = UI_TEXTS[lang];
    setDialogLabels(t.dialogOk, t.dialogCancel);
    // data-i18n の一括置換で上書きされた Slab 情報を言語に合わせて再表示 (下で置換後に設定)
    const slabInfoEl = document.getElementById('slab-info');

    // data-i18n を持つ全DOM要素を一括置換
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n') as keyof typeof t;
      if (key && typeof t[key] === 'string') {
        el.textContent = t[key] as string;
      }
    });

    if (slabInfoEl && this.slabInfoMessage) slabInfoEl.textContent = this.slabInfoMessage();

    // レンダラーへの言語反映
    this.mapRenderer?.setLanguage(lang);
    this.chartRenderer?.setLanguage(lang);

    // セレクタやリストの再生成
    this.populateScenarios();
    this.populatePointSelect();
    this.updateSelectionCounts();
    this.updatePointsList();
    this.updatePlayPauseButton();
    this.updateRecordButton();
    this.updateChart();
    this.updateUI();
    this.render();
  }

  /**
   * 戻り値: サイズが変化した場合 true
   */
  private resizeCanvases(): boolean {
    // Canvas はCSSで親要素いっぱいに絶対配置しているため、表示サイズと描画解像度を常に一致させる
    // (一致しないと地図が引き伸ばされ、クリック位置と経緯度の対応もずれる)
    const mapWrap = this.mapCanvas.parentElement!;
    const w = Math.max(1, Math.floor(mapWrap.clientWidth));
    const h = Math.max(1, Math.floor(mapWrap.clientHeight));
    if (this.mapCanvas.width === w && this.mapCanvas.height === h) return false;
    this.mapCanvas.width = w;
    this.mapCanvas.height = h;
    return true;
  }

  /**
   * マウスイベントの位置を Canvas の描画座標に変換 (表示サイズと解像度の比も考慮)
   */
  private eventToCanvas(e: MouseEvent): { px: number; py: number } {
    const rect = this.mapCanvas.getBoundingClientRect();
    return {
      px: (e.clientX - rect.left) * (this.mapCanvas.width / Math.max(1, rect.width)),
      py: (e.clientY - rect.top) * (this.mapCanvas.height / Math.max(1, rect.height))
    };
  }

  private populateScenarios() {
    this.scenarioSelect.innerHTML = '';
    for (const sc of FAULT_PRESETS) {
      const opt = document.createElement('option');
      opt.value = sc.id;
      const trans = SCENARIO_TRANSLATIONS[this.currentLang][sc.id];
      opt.textContent = trans ? trans.name : sc.name;
      this.scenarioSelect.appendChild(opt);
    }
    const currentTrans = SCENARIO_TRANSLATIONS[this.currentLang][this.currentScenario.id];
    this.scenarioDesc.textContent = currentTrans ? currentTrans.description : this.currentScenario.description;
  }

  private populatePointSelect() {
    if (!this.pointSelect) return;
    this.pointSelect.innerHTML = '';

    const defaultIds = new Set(DEFAULT_OBSERVATION_POINTS.map((p) => p.id));
    const defaultPts = this.observationPoints.filter((p) => defaultIds.has(p.id));
    const customPts = this.observationPoints.filter((p) => !defaultIds.has(p.id));

    if (defaultPts.length > 0) {
      const groupDefault = document.createElement('optgroup');
      groupDefault.label = UI_TEXTS[this.currentLang].groupDefault;
      for (const pt of defaultPts) {
        const opt = document.createElement('option');
        opt.value = pt.id;
        const ptName = POINT_TRANSLATIONS[this.currentLang][pt.id] || pt.name;
        opt.textContent = `${ptName} [${pt.lon}°E, ${pt.lat}°N]`;
        groupDefault.appendChild(opt);
      }
      this.pointSelect.appendChild(groupDefault);
    }

    if (customPts.length > 0) {
      const groupCustom = document.createElement('optgroup');
      groupCustom.label = UI_TEXTS[this.currentLang].groupCustom;
      for (const pt of customPts) {
        const opt = document.createElement('option');
        opt.value = pt.id;
        let ptName = pt.name;
        if (this.currentLang === 'en' && ptName.startsWith('観測点')) {
          ptName = ptName.replace('観測点', 'Point');
        }
        opt.textContent = ptName;
        groupCustom.appendChild(opt);
      }
      this.pointSelect.appendChild(groupCustom);
    }

    this.pointSelect.value = this.focusedPointId;
  }

  private applyScenario(scenario: PresetScenario) {
    this.currentScenario = scenario;
    this.activeFaults = JSON.parse(JSON.stringify(scenario.faults));
    this.activeHypocenter = scenario.hypocenter;
    this.activeRupture = scenario.rupture && scenario.hypocenter
      ? { lon: scenario.hypocenter.lon, lat: scenario.hypocenter.lat, ...scenario.rupture }
      : undefined;
    const trans = SCENARIO_TRANSLATIONS[this.currentLang][scenario.id];
    this.scenarioDesc.textContent = trans ? trans.description : scenario.description;

    // 震源域に地図を合わせ、近傍の代表観測点にフォーカス
    this.mapRenderer?.fitBounds(scenario.view);
    this.viewAdjustedByUser = false;
    if (this.observationPoints.some((p) => p.id === scenario.focusPointId)) {
      this.focusedPointId = scenario.focusPointId;
      this.selectedPointIds.add(scenario.focusPointId);
      this.populatePointSelect();
      this.updateSelectionCounts();
      this.updatePointsList();
      this.updateChart();
    }
    this.magSlider.value = String(scenario.magnitude);
    this.magVal.textContent = String(scenario.magnitude);

    const avgSlip = App.meanSlip(this.activeFaults);
    this.slipSlider.value = String(avgSlip.toFixed(1));
    this.slipVal.textContent = `${avgSlip.toFixed(1)} m`;

    this.rebuildSourceDisplacement();
  }

  private rebuildSourceDisplacement() {
    // 1. Okada断層変位グリッドの生成
    const eta0 = computeInitialDisplacementGrid(
      this.activeFaults,
      this.meta.width,
      this.meta.height,
      this.meta.bounds.lonMin,
      this.meta.bounds.lonMax,
      this.meta.bounds.latMin,
      this.meta.bounds.latMax
    );

    // 2. ソルバーを初期化
    this.solver.resetWithDisplacement(eta0, this.activeRupture);
    this.updateUI();
    this.render();
  }

  private setupEventListeners() {
    // 言語切り替えボタン
    this.btnLangJa?.addEventListener('click', () => this.setLanguage('ja'));
    this.btnLangEn?.addEventListener('click', () => this.setLanguage('en'));

    // プレイ/一時停止
    this.btnPlayPause.addEventListener('click', () => {
      this.isRunning = !this.isRunning;
      this.updatePlayPauseButton();
    });

    // 60分一括高速計算
    this.btnFastForward.addEventListener('click', () => {
      this.runFastForward();
    });

    // リセット
    this.btnReset.addEventListener('click', () => {
      this.isRunning = false;
      this.updatePlayPauseButton();
      this.rebuildSourceDisplacement();
    });

    // シナリオ変更
    this.scenarioSelect.addEventListener('change', (e) => {
      const id = (e.target as HTMLSelectElement).value;
      const found = FAULT_PRESETS.find((s) => s.id === id);
      if (found) {
        this.isRunning = false;
        this.updatePlayPauseButton();
        this.applyScenario(found);
      }
    });

    // マグニチュードスライダー
    this.magSlider.addEventListener('input', () => {
      const mw = parseFloat(this.magSlider.value);
      this.magVal.textContent = mw.toFixed(1);
      // すべり量スケール調整: log10(M0) ~ 1.5 * Mw
      let newSlip: number;
      if (this.isCustomSource() && this.customFault) {
        // カスタム震源: 断層面積を保ったまま Mw に対応するすべり量
        newSlip = Math.min(50, slipFromMagnitude(mw, this.customFault.lengthKm, this.customFault.widthKm));
      } else {
        const scale = Math.pow(10, 1.5 * (mw - this.currentScenario.magnitude) * 0.5);
        const baseSlip = App.meanSlip(this.currentScenario.faults);
        newSlip = Math.min(50, Math.max(2, baseSlip * scale));
      }
      this.slipSlider.value = newSlip.toFixed(1);
      this.slipVal.textContent = `${newSlip.toFixed(1)} m`;
    });

    // すべり量スライダー
    this.slipSlider.addEventListener('input', () => {
      this.slipVal.textContent = `${this.slipSlider.value} m`;
    });

    // 波源再生成ボタン
    document.getElementById('btn-apply-fault')?.addEventListener('click', () => {
      const targetSlip = parseFloat(this.slipSlider.value);
      const base = this.currentScenario.faults;
      if (this.activeFaults.length === base.length && this.activeFaults[0].name === base[0].name) {
        // プリセットのすべり分布 (大すべり域など) を保ったまま、平均すべり量が指定値になるよう比例倍
        const ratio = targetSlip / App.meanSlip(base);
        this.activeFaults.forEach((f, i) => {
          f.slipM = base[i].slipM * ratio;
        });
      } else {
        for (const f of this.activeFaults) {
          f.slipM = targetSlip;
        }
      }
      this.isRunning = false;
      this.updatePlayPauseButton();
      this.rebuildSourceDisplacement();
    });

    // カスタム断層パラメータを手動で編集して再生成
    document.getElementById('btn-apply-custom-fault')?.addEventListener('click', () => {
      if (!this.customFault) {
        showAlert(UI_TEXTS[this.currentLang].alertNoCustomFault);
        return;
      }
      const edited = this.readCustomFaultFields(this.customFault);
      edited.slipM = Math.min(50, slipFromMagnitude(parseFloat(this.magSlider.value), edited.lengthKm, edited.widthKm));
      this.applyCustomFault(edited, () => UI_TEXTS[this.currentLang].slabEdited);
    });

    // 再生速度ボタン
    const speedBtns = document.querySelectorAll('.btn-speed');
    speedBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        speedBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.speedMultiplier = parseInt(btn.getAttribute('data-speed') || '5', 10);
      });
    });

    // 計算上限時間ボタン
    const durationBtns = document.querySelectorAll('.btn-duration');
    durationBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        durationBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.maxDurationSec = parseInt(btn.getAttribute('data-duration') || '7200', 10);
        const maxMins = Math.floor(this.maxDurationSec / 60);
        if (this.maxDurationLabel) {
          this.maxDurationLabel.textContent = `${maxMins}${UI_TEXTS[this.currentLang].minSuffix}`;
        }
        if (this.btnFastForward) {
          this.btnFastForward.title = UI_TEXTS[this.currentLang].btnFastForwardTitle;
        }
        this.updateUI();
      });
    });

    // 震源クリック指定モード
    const btnEpicenter = document.getElementById('btn-custom-epicenter')!;
    btnEpicenter.addEventListener('click', () => {
      if (this.clickMode === 'pick-epicenter') {
        this.clickMode = 'none';
        btnEpicenter.classList.remove('active');
        this.statusText.textContent = UI_TEXTS[this.currentLang].statusReady;
      } else {
        this.clickMode = 'pick-epicenter';
        btnEpicenter.classList.add('active');
        document.getElementById('btn-add-point-mode')?.classList.remove('active');
        this.statusText.textContent = UI_TEXTS[this.currentLang].statusPickingEpicenter;
      }
    });

    // 観測地点追加モード
    const btnAddPt = document.getElementById('btn-add-point-mode')!;
    btnAddPt.addEventListener('click', () => {
      if (this.clickMode === 'add-point') {
        this.clickMode = 'none';
        btnAddPt.classList.remove('active');
        this.statusText.textContent = UI_TEXTS[this.currentLang].statusReady;
      } else {
        this.clickMode = 'add-point';
        btnAddPt.classList.add('active');
        btnEpicenter.classList.remove('active');
        this.statusText.textContent = UI_TEXTS[this.currentLang].statusAddingPoint;
      }
    });

    // 全選択ボタン
    this.btnSelectAllPoints?.addEventListener('click', () => {
      for (const pt of this.observationPoints) {
        this.selectedPointIds.add(pt.id);
      }
      this.updateSelectionCounts();
      this.updatePointsList();
      this.updateChart();
      this.render();
    });

    // 全解除ボタン
    this.btnDeselectAllPoints?.addEventListener('click', () => {
      this.selectedPointIds.clear();
      this.updateSelectionCounts();
      this.updatePointsList();
      this.updateChart();
      this.render();
    });

    // 観測地点セレクタの変更イベント (詳細フォーカス地点の切り替え)
    this.pointSelect?.addEventListener('change', (e) => {
      const selectedId = (e.target as HTMLSelectElement).value;
      this.focusedPointId = selectedId;
      this.selectedPointIds.add(selectedId);
      this.updateSelectionCounts();
      this.updatePointsList();
      this.updateChart();
      this.render();
    });

    // 観測地点の初期化（デフォルト主要地点に復元）
    this.btnResetPoints?.addEventListener('click', async () => {
      if (await showConfirm(UI_TEXTS[this.currentLang].confirmResetPoints)) {
        this.observationPoints = JSON.parse(JSON.stringify(DEFAULT_OBSERVATION_POINTS));
        this.solver.observationPoints = this.observationPoints;
        this.focusedPointId = this.currentScenario.focusPointId;
        this.selectedPointIds = new Set(this.observationPoints.map((p) => p.id));
        // 現時点までの状態を記録し直す (計算途中でも履歴が空にならないように)
        for (const pt of this.observationPoints) {
          pt.timeHistory = [];
          pt.maxWaveHeight = 0;
          pt.minWaveHeight = 0;
          this.solver.sampleSinglePoint(pt);
        }
        this.populatePointSelect();
        this.updateSelectionCounts();
        this.updatePointsList();
        this.updateChart();
        this.render();
      }
    });

    // レイヤートグル
    document.getElementById('chk-bathymetry')?.addEventListener('change', (e) => {
      this.mapRenderer.showBathymetry = (e.target as HTMLInputElement).checked;
      this.render();
    });
    document.getElementById('chk-wave')?.addEventListener('change', (e) => {
      this.mapRenderer.showWaveHeight = (e.target as HTMLInputElement).checked;
      this.render();
    });
    document.getElementById('chk-vectors')?.addEventListener('change', (e) => {
      this.mapRenderer.showVelocityVectors = (e.target as HTMLInputElement).checked;
      this.render();
    });
    document.getElementById('chk-faults')?.addEventListener('change', (e) => {
      this.mapRenderer.showFaults = (e.target as HTMLInputElement).checked;
      this.render();
    });

    // CSV出力ボタン (方式B: 市街地連携用トリミング波形)
    document.getElementById('btn-export-city-csv')?.addEventListener('click', async () => {
      const targetPoints = this.observationPoints.filter((p) => this.selectedPointIds.has(p.id));
      if (targetPoints.length > 0) {
        await ChartRenderer.exportMultipleCityTrimmedCSV(targetPoints, this.currentLang);
      } else {
        const doAll = await showConfirm(UI_TEXTS[this.currentLang].confirmExportAllIfNone(this.observationPoints.length));
        if (doAll) {
          await ChartRenderer.exportMultipleCityTrimmedCSV(this.observationPoints, this.currentLang);
        }
      }
    });

    // CSV出力ボタン (方式A: 全期間データ)
    document.getElementById('btn-export-full-csv')?.addEventListener('click', async () => {
      const targetPoints = this.observationPoints.filter((p) => this.selectedPointIds.has(p.id));
      if (targetPoints.length > 0) {
        await ChartRenderer.exportMultipleFullCSV(targetPoints, this.currentLang);
      } else {
        const doAll = await showConfirm(UI_TEXTS[this.currentLang].confirmExportAllIfNone(this.observationPoints.length));
        if (doAll) {
          await ChartRenderer.exportMultipleFullCSV(this.observationPoints, this.currentLang);
        }
      }
    });

    // グラフ表示モード切替ボタン (選択地点 / 単一フォーカス / 全地点)
    this.btnChartSelected?.addEventListener('click', () => {
      this.chartViewMode = 'selected';
      this.btnChartSelected.classList.add('active');
      this.btnChartFocus.classList.remove('active');
      this.btnChartAll.classList.remove('active');
      this.updateChart();
    });

    this.btnChartFocus?.addEventListener('click', () => {
      this.chartViewMode = 'focus';
      this.btnChartFocus.classList.add('active');
      this.btnChartSelected.classList.remove('active');
      this.btnChartAll.classList.remove('active');
      this.updateChart();
    });

    this.btnChartAll?.addEventListener('click', () => {
      this.chartViewMode = 'all';
      this.btnChartAll.classList.add('active');
      this.btnChartSelected.classList.remove('active');
      this.btnChartFocus.classList.remove('active');
      this.updateChart();
    });

    // セクション折りたたみ（アコーディオン）トグル
    const clickableHeaders = document.querySelectorAll('.section-header.clickable');
    clickableHeaders.forEach((header) => {
      header.addEventListener('click', () => {
        const section = header.closest('.panel-section');
        section?.classList.toggle('collapsed');
      });
    });

    // 動画録画
    this.btnRecord?.addEventListener('click', () => {
      if (this.recorder) {
        this.finishRecording();
      } else {
        this.startRecording();
      }
    });

    // 表示範囲ボタン
    document.getElementById('btn-fit-domain')?.addEventListener('click', () => {
      this.mapRenderer.fitDomain();
      this.viewAdjustedByUser = true;
      this.render();
    });
    document.getElementById('btn-fit-scenario')?.addEventListener('click', () => {
      this.mapRenderer.fitBounds(this.currentScenario.view);
      this.viewAdjustedByUser = false;
      this.render();
    });

    // マップクリック＆マウス移動
    this.mapCanvas.addEventListener('click', (e) => this.handleMapClick(e));
    this.mapCanvas.addEventListener('mousemove', (e) => this.handleMapMouseMove(e));
    this.mapCanvas.addEventListener('mouseleave', () => {
      this.mapTooltip.classList.add('hidden');
    });

    // ホイールでズーム、ドラッグで移動
    this.mapCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const { px, py } = this.eventToCanvas(e);
      this.mapRenderer.zoomAt(px, py, Math.exp(-e.deltaY * 0.0015));
      this.viewAdjustedByUser = true;
      this.render();
    }, { passive: false });
    this.mapCanvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.dragStart = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY };
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragStart) return;
      const moved = Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y);
      if (moved > 4) {
        this.suppressNextClick = true;
        this.mapCanvas.classList.add('panning');
        const rect = this.mapCanvas.getBoundingClientRect();
        const ratio = this.mapCanvas.width / Math.max(1, rect.width);
        this.mapRenderer.panBy((e.clientX - this.dragStart.lastX) * ratio, (e.clientY - this.dragStart.lastY) * ratio);
        this.viewAdjustedByUser = true;
        this.dragStart.lastX = e.clientX;
        this.dragStart.lastY = e.clientY;
        this.render();
      }
    });
    window.addEventListener('mouseup', () => {
      this.dragStart = null;
      this.mapCanvas.classList.remove('panning');
    });
  }

  private handleMapClick(e: MouseEvent) {
    // ドラッグ移動の直後のクリックは無視
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    const { px, py } = this.eventToCanvas(e);

    const { lon, lat } = this.mapRenderer.canvasToLonLat(px, py);
    this.mapTooltip.classList.add('hidden');

    if (this.clickMode === 'pick-epicenter') {
      // 震源の変更: プレート境界 (Slab) に沿った断層を自動設定し、範囲外は手動パラメータを使う
      const mw = parseFloat(this.magSlider.value);
      const size = interfaceFaultSize(mw);
      const auto = (document.getElementById('chk-slab-auto') as HTMLInputElement | null)?.checked ?? true;
      const slabPt = auto && this.slab ? this.slab.lookup(lon, lat) : null;

      let input: CustomFaultInput;
      let info: () => string;
      if (slabPt && slabPt.depthKm <= MAX_INTERPLATE_DEPTH_KM) {
        input = faultOnSlab(lon, lat, slabPt, size.lengthKm, size.widthKm);
        const src = this.slab!.sourceNames.some((n) => n.includes('slab2')) ? 'Slab2' : 'Slab1.0';
        info = () => UI_TEXTS[this.currentLang].slabInfo(slabPt.depthKm.toFixed(1), slabPt.strikeDeg.toFixed(0), slabPt.dipDeg.toFixed(1), src);
      } else {
        const manual = this.readCustomFaultFields({
          lon: Number(lon.toFixed(3)),
          lat: Number(lat.toFixed(3)),
          strikeDeg: 245,
          dipDeg: 14,
          rakeDeg: 90,
          lengthKm: 0,
          widthKm: 0,
          topDepthKm: 12,
          slipM: 0
        });
        input = { ...manual, lon: Number(lon.toFixed(3)), lat: Number(lat.toFixed(3)), lengthKm: Math.round(size.lengthKm), widthKm: Math.round(size.widthKm) };
        if (!auto) {
          info = () => UI_TEXTS[this.currentLang].slabAutoOff;
        } else if (slabPt) {
          const depth = slabPt.depthKm.toFixed(0);
          info = () => UI_TEXTS[this.currentLang].slabTooDeep(depth);
        } else {
          info = () => UI_TEXTS[this.currentLang].slabOutOfRange;
        }
      }
      input.slipM = Math.min(50, slipFromMagnitude(mw, input.lengthKm, input.widthKm));

      this.clickMode = 'none';
      document.getElementById('btn-custom-epicenter')?.classList.remove('active');
      (document.getElementById('custom-fault-panel') as HTMLDetailsElement | null)?.setAttribute('open', '');
      this.applyCustomFault(input, info);
      this.statusText.textContent = `${UI_TEXTS[this.currentLang].statusEpicenterUpdated} (${lon.toFixed(2)}°E, ${lat.toFixed(2)}°N)`;
    } else if (this.clickMode === 'add-point') {
      // 観測地点の追加
      const newId = `point_${Date.now()}`;
      const colors = ['#f43f5e', '#38bdf8', '#eab308', '#a855f7', '#10b981', '#f97316', '#ec4899'];
      const color = colors[this.observationPoints.length % colors.length];

      const prefix = this.currentLang === 'ja' ? '観測点' : 'Point';
      const newPoint: ObservationPoint = {
        id: newId,
        name: `${prefix} (${lon.toFixed(1)}°E, ${lat.toFixed(1)}°N)`,
        lon: Number(lon.toFixed(2)),
        lat: Number(lat.toFixed(2)),
        color,
        timeHistory: []
      };

      this.observationPoints.push(newPoint);
      // 追加直後に初期状態 (t=0 等) を確実にサンプリング
      this.solver.sampleSinglePoint(newPoint);

      this.focusedPointId = newId;
      this.selectedPointIds.add(newId);
      this.clickMode = 'none';
      document.getElementById('btn-add-point-mode')?.classList.remove('active');
      this.statusText.textContent = `${UI_TEXTS[this.currentLang].statusPointAdded}${newPoint.name}`;
      this.populatePointSelect();
      this.updateSelectionCounts();
      this.updatePointsList();
      this.updateChart();
      this.render();
    } else {
      // 最寄りの観測地点を選択
      let minDist = 25; // 25px以内
      let clickedPointId: string | null = null;

      for (const pt of this.observationPoints) {
        const ptCanvas = this.mapRenderer.lonLatToCanvas(pt.lon, pt.lat);
        const dist = Math.hypot(ptCanvas.px - px, ptCanvas.py - py);
        if (dist < minDist) {
          minDist = dist;
          clickedPointId = pt.id;
        }
      }

      if (clickedPointId) {
        this.focusedPointId = clickedPointId;
        this.populatePointSelect();
        this.updatePointsList();
        this.updateChart();
        this.render();
      }
    }
  }

  private handleMapMouseMove(e: MouseEvent) {
    const { px, py } = this.eventToCanvas(e);

    const { lon, lat } = this.mapRenderer.canvasToLonLat(px, py);

    // グリッド座標
    const c = Math.floor(((lon - this.meta.bounds.lonMin) / (this.meta.bounds.lonMax - this.meta.bounds.lonMin)) * this.meta.width);
    const r = Math.floor(((this.meta.bounds.latMax - lat) / (this.meta.bounds.latMax - this.meta.bounds.latMin)) * this.meta.height);

    if (c >= 0 && c < this.meta.width && r >= 0 && r < this.meta.height) {
      const idx = r * this.meta.width + c;
      const depth = this.solver.depth[idx];
      const eta = this.solver.eta[idx];

      const t = UI_TEXTS[this.currentLang];
      let depthStr = depth > 0 ? `${t.depthLabel} ${depth.toFixed(0)} m` : `${t.elevationLabel} ${this.rawBathymetry[idx]} m ${t.landLabel}`;
      this.cursorCoords.textContent = `${lon.toFixed(2)}°E / ${lat.toFixed(2)}°N (${depthStr}) | ${t.waterLevelLabel} ${eta > 0 ? '+' : ''}${eta.toFixed(2)}m`;

      if (this.clickMode !== 'none') {
        this.mapTooltip.classList.remove('hidden');
        const rect = this.mapCanvas.getBoundingClientRect();
        this.mapTooltip.style.left = `${e.clientX - rect.left}px`;
        this.mapTooltip.style.top = `${e.clientY - rect.top}px`;
        this.mapTooltip.textContent = this.clickMode === 'pick-epicenter'
          ? t.tooltipPickEpicenter(lon.toFixed(2), lat.toFixed(2))
          : t.tooltipAddPoint(lon.toFixed(2), lat.toFixed(2));
      } else {
        this.mapTooltip.classList.add('hidden');
      }
    }
  }

  private updatePlayPauseButton() {
    const playIcon = document.getElementById('play-icon')!;
    const playText = document.getElementById('play-text')!;
    const t = UI_TEXTS[this.currentLang];

    if (this.isRunning) {
      this.btnPlayPause.classList.add('playing');
      playIcon.textContent = '⏸';
      playText.textContent = t.btnPlayPause;
      this.simStatusBadge.classList.add('running');
      this.statusText.textContent = t.statusSimulating;
    } else {
      this.btnPlayPause.classList.remove('playing');
      playIcon.textContent = '▶';
      playText.textContent = this.solver.currentTimeSec > 0 ? t.btnPlayResume : t.btnPlayStart;
      this.simStatusBadge.classList.remove('running');
      this.statusText.textContent = this.solver.currentTimeSec > 0 ? t.statusPaused : t.statusReady;
    }
  }

  /**
   * 指定時間までのシミュレーションを一括で高速計算
   */
  private runFastForward() {
    this.isRunning = false;
    this.updatePlayPauseButton();
    const maxMins = Math.floor(this.maxDurationSec / 60);
    this.statusText.textContent = this.currentLang === 'ja'
      ? `${maxMins}分間を一括高速計算中...`
      : `Fast-forwarding ${maxMins} mins...`;

    setTimeout(() => {
      // すでに終了時間に達している場合は自動的にリセットして再計算
      if (this.solver.currentTimeSec >= this.maxDurationSec) {
        this.rebuildSourceDisplacement();
      }

      // 未サンプリング（または t=0 が未記録）の観測点があれば確実に t=0 を記録
      for (const pt of this.observationPoints) {
        if (!pt.timeHistory || pt.timeHistory.length === 0) {
          this.solver.sampleSinglePoint(pt);
        }
      }

      const targetTimeSec = this.maxDurationSec;
      while (this.solver.currentTimeSec < targetTimeSec) {
        this.solver.step();
      }
      this.statusText.textContent = this.currentLang === 'ja'
        ? `${maxMins}分間の計算が完了しました`
        : `Completed ${maxMins} mins simulation`;
      this.updateUI();
      this.updateChart();
      this.render();
    }, 20);
  }

  private loop(_timestamp: number) {
    if (this.isRunning) {
      // 速度倍率 = 1フレームあたりに進めるシミュレーション秒数
      const stepsToRun = Math.max(1, Math.round(this.speedMultiplier / this.solver.dt));
      const recording = this.recorder !== null;
      const frameStart = performance.now();
      for (let i = 0; i < stepsToRun; i++) {
        if (this.solver.currentTimeSec >= this.maxDurationSec) {
          this.isRunning = false;
          this.updatePlayPauseButton();
          const maxMins = Math.floor(this.maxDurationSec / 60);
          this.statusText.textContent = `${UI_TEXTS[this.currentLang].statusCompleted} (${maxMins}${UI_TEXTS[this.currentLang].minSuffix})`;
          break;
        }
        this.solver.step();
        // 録画中以外は1フレームの計算時間を制限して操作の応答性を保つ
        // (録画中は動画の時間軸を一定にするため、毎フレーム同じステップ数を計算する)
        if (!recording && performance.now() - frameStart > 40) break;
      }

      this.updateUI();
      // グラフは数フレームごとに更新
      this.frameCount++;
      if (this.frameCount % 6 === 0 || !this.isRunning) {
        this.updateChart();
      }
      this.render();

      if (this.recorder) {
        this.recorder.captureFrame(this.recordingTitle());
        // 計算上限時間に達したら録画を自動終了して保存
        if (!this.isRunning) this.finishRecording();
      }
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  private recordingTitle(): string {
    const trans = SCENARIO_TRANSLATIONS[this.currentLang][this.currentScenario.id];
    const isCustom = this.activeFaults.length === 1 && this.activeFaults[0].name === 'カスタム震源';
    if (isCustom) {
      return FAULT_NAME_TRANSLATIONS[this.currentLang]['カスタム震源'];
    }
    return trans ? trans.name : this.currentScenario.name;
  }

  private updateRecordButton() {
    if (!this.btnRecord) return;
    const t = UI_TEXTS[this.currentLang];
    this.btnRecord.textContent = this.recorder ? t.btnRecordStop : t.btnRecordStart;
    this.btnRecord.title = t.btnRecordTitle;
    this.btnRecord.classList.toggle('recording', this.recorder !== null);
  }

  /**
   * 録画開始: 地図アニメーションを1フレームずつ動画に記録しながらシミュレーションを再生する
   */
  private async startRecording() {
    const t = UI_TEXTS[this.currentLang];
    const recorder = new VideoRecorder(this.mapCanvas);
    try {
      this.recordExt = await recorder.start();
    } catch (e) {
      console.error(e);
      await showAlert(t.recordUnsupported);
      return;
    }
    this.recorder = recorder;
    this.updateRecordButton();

    // 計算済みの場合は最初から再生し直す
    if (this.solver.currentTimeSec >= this.maxDurationSec) {
      this.rebuildSourceDisplacement();
    }
    this.render();
    recorder.captureFrame(this.recordingTitle());

    this.isRunning = true;
    this.updatePlayPauseButton();
    this.statusText.textContent = t.statusRecording;
  }

  /**
   * 録画終了: 動画ファイルを書き出して保存
   */
  private async finishRecording() {
    const recorder = this.recorder;
    if (!recorder) return;
    this.recorder = null;
    this.updateRecordButton();
    const t = UI_TEXTS[this.currentLang];
    this.statusText.textContent = t.statusEncoding;

    try {
      const { blob, ext } = await recorder.stop();
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
      const filename = `tsunami_${this.currentScenario.id}_${stamp}.${ext}`;
      const saved = await saveBlob(blob, filename);
      notify(t.recordSaved(saved ?? filename));
      if (ext !== 'mp4' || this.recordExt !== 'mp4') {
        await showAlert(t.recordWebmFallback);
      }
    } catch (e) {
      console.error(e);
      await showAlert(`${t.recordUnsupported}\n${e}`);
    }
    this.updatePlayPauseButton();
  }

  private updateUI() {
    const tSec = this.solver.currentTimeSec;
    const mins = Math.floor(tSec / 60);
    const secs = Math.floor(tSec % 60);
    this.elapsedTimeDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // 最大波高
    let globalMax = 0;
    for (const pt of this.observationPoints) {
      if (pt.maxWaveHeight && pt.maxWaveHeight > globalMax) {
        globalMax = pt.maxWaveHeight;
      }
    }
    this.globalMaxHeightDisplay.textContent = `${globalMax.toFixed(1)} m`;

    // プログレスバー
    const progressPct = Math.min(100, (tSec / this.maxDurationSec) * 100);
    this.simProgressBar.style.width = `${progressPct}%`;
    const maxMins = Math.floor(this.maxDurationSec / 60);
    this.simProgressText.textContent = `${(tSec / 60).toFixed(1)} / ${maxMins} ${UI_TEXTS[this.currentLang].minSuffix}`;

    // 観測点リスト更新
    this.updatePointsList();

    // 選択件数カウントの更新
    this.updateSelectionCounts();

    // アクティブ観測点のサマリー
    const activePt = this.observationPoints.find((p) => p.id === this.focusedPointId);
    if (activePt) {
      const ptName = POINT_TRANSLATIONS[this.currentLang][activePt.id] || activePt.name;
      this.chartPointTitle.textContent = `${ptName} - ${UI_TEXTS[this.currentLang].chartTitleSuffix}`;
      
      const arrival = activePt.firstArrivalSec !== undefined
        ? (this.currentLang === 'ja'
          ? `${Math.floor(activePt.firstArrivalSec / 60)}分${Math.floor(activePt.firstArrivalSec % 60)}秒`
          : `${Math.floor(activePt.firstArrivalSec / 60)}m ${Math.floor(activePt.firstArrivalSec % 60)}s`)
        : UI_TEXTS[this.currentLang].chartStatNotArrived;

      const maxH = activePt.maxWaveHeight !== undefined ? `${activePt.maxWaveHeight.toFixed(1)} m` : '--- m';
      const dir = activePt.dominantDirectionDeg !== undefined
        ? `${this.degToCompass(activePt.dominantDirectionDeg)} (${activePt.dominantDirectionDeg.toFixed(0)}°)`
        : '---°';

      const t = UI_TEXTS[this.currentLang];
      this.chartPointSummary.textContent = `${t.chartStatFirstArrival} ${arrival} | ${t.chartStatMaxWave} ${maxH} | ${t.chartStatDirection} ${dir}`;
    }
  }

  /**
   * 選択中地点数およびエクスポート対象件数の表示を更新
   */
  private updateSelectionCounts() {
    const selected = this.selectedPointIds.size;
    const total = this.observationPoints.length;
    const t = UI_TEXTS[this.currentLang];

    if (this.selectedPointsCount) {
      this.selectedPointsCount.textContent = t.selectedCountText(selected, total);
    }
    if (this.exportCityCount) {
      this.exportCityCount.textContent = this.currentLang === 'ja' ? `${selected}地点` : `${selected} pts`;
    }
    if (this.exportFullCount) {
      this.exportFullCount.textContent = this.currentLang === 'ja' ? `${selected}地点` : `${selected} pts`;
    }
    if (this.chartSelectedCount) {
      this.chartSelectedCount.textContent = String(selected);
    }
  }

  /**
   * 観測地点リストのDOM描画（チェックボックス付き複数選択対応）
   */
  private updatePointsList() {
    this.pointsListEl.innerHTML = '';
    const defaultIds = new Set(DEFAULT_OBSERVATION_POINTS.map((p) => p.id));

    for (const pt of this.observationPoints) {
      const isFocused = pt.id === this.focusedPointId;
      const isChecked = this.selectedPointIds.has(pt.id);
      const isCustom = !defaultIds.has(pt.id);

      const card = document.createElement('div');
      card.className = `point-card ${isFocused ? 'active' : ''} ${isChecked ? 'checked' : 'unchecked'}`;
      card.addEventListener('click', () => {
        this.focusedPointId = pt.id;
        if (this.pointSelect) {
          this.pointSelect.value = pt.id;
        }
        this.updatePointsList();
        this.updateChart();
        this.render();
      });

      const left = document.createElement('div');
      left.className = 'point-info-left';

      // 複数選択チェックボックス
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'point-checkbox';
      chk.checked = isChecked;
      chk.title = this.currentLang === 'ja' ? '一括出力・グラフ重ね合わせの対象に含める' : 'Include in batch export and overlay chart';
      chk.addEventListener('click', (e) => e.stopPropagation());
      chk.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        if (checked) {
          this.selectedPointIds.add(pt.id);
        } else {
          this.selectedPointIds.delete(pt.id);
        }
        this.updateSelectionCounts();
        this.updatePointsList();
        this.updateChart();
        this.render();
      });

      const dot = document.createElement('span');
      dot.className = 'point-dot';
      dot.style.backgroundColor = pt.color;

      let displayName = POINT_TRANSLATIONS[this.currentLang][pt.id] || pt.name;
      if (this.currentLang === 'en' && displayName.startsWith('観測点')) {
        displayName = displayName.replace('観測点', 'Point');
      }

      const name = document.createElement('span');
      name.className = 'point-name';
      name.textContent = displayName;

      left.appendChild(chk);
      left.appendChild(dot);
      left.appendChild(name);

      // カスタム追加地点の場合は削除ボタン
      if (isCustom) {
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete-pt';
        delBtn.textContent = '✕';
        delBtn.title = this.currentLang === 'ja' ? 'この観測地点を削除' : 'Delete this point';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.observationPoints = this.observationPoints.filter((p) => p.id !== pt.id);
          this.solver.observationPoints = this.observationPoints;
          this.selectedPointIds.delete(pt.id);
          if (this.focusedPointId === pt.id) {
            this.focusedPointId = this.observationPoints[0]?.id || this.currentScenario.focusPointId;
          }
          this.populatePointSelect();
          this.updateSelectionCounts();
          this.updatePointsList();
          this.updateChart();
          this.render();
        });
        left.appendChild(delBtn);
      }

      const metrics = document.createElement('div');
      metrics.className = 'point-metrics mono';

      const hVal = document.createElement('span');
      hVal.className = 'metric-val';
      hVal.textContent = pt.maxWaveHeight !== undefined && pt.maxWaveHeight > 0.05
        ? `${pt.maxWaveHeight.toFixed(1)}m`
        : '--';

      const timeVal = document.createElement('span');
      timeVal.className = 'metric-time';
      timeVal.textContent = pt.firstArrivalSec !== undefined
        ? `${Math.floor(pt.firstArrivalSec / 60)}m`
        : '--';

      metrics.appendChild(hVal);
      metrics.appendChild(timeVal);

      card.appendChild(left);
      card.appendChild(metrics);
      this.pointsListEl.appendChild(card);
    }
  }

  private updateChart() {
    this.chartRenderer.updateChart(
      this.observationPoints,
      this.selectedPointIds,
      this.focusedPointId,
      this.chartViewMode
    );
  }

  private render() {
    if (!this.mapRenderer || !this.solver) return;
    this.mapRenderer.render(
      this.solver,
      this.activeFaults,
      this.focusedPointId,
      this.selectedPointIds,
      this.activeHypocenter
    );
  }

  private isCustomSource(): boolean {
    return this.activeFaults.length === 1 && this.activeFaults[0].name === 'カスタム震源';
  }

  /**
   * カスタム断層パラメータ欄の値を読み取る (空欄・不正値は base の値を使う)
   */
  private readCustomFaultFields(base: CustomFaultInput): CustomFaultInput {
    const num = (id: string, fallback: number) => {
      const v = parseFloat((document.getElementById(id) as HTMLInputElement | null)?.value ?? '');
      return Number.isFinite(v) ? v : fallback;
    };
    return {
      ...base,
      strikeDeg: ((num('fault-strike', base.strikeDeg) % 360) + 360) % 360,
      dipDeg: Math.min(90, Math.max(1, num('fault-dip', base.dipDeg))),
      rakeDeg: Math.min(180, Math.max(-180, num('fault-rake', base.rakeDeg))),
      lengthKm: Math.max(1, num('fault-length', base.lengthKm)),
      widthKm: Math.max(1, num('fault-width', base.widthKm)),
      topDepthKm: Math.max(0.5, num('fault-top', base.topDepthKm))
    };
  }

  private writeCustomFaultFields(f: CustomFaultInput) {
    const set = (id: string, v: number) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = String(v);
    };
    set('fault-strike', f.strikeDeg);
    set('fault-dip', f.dipDeg);
    set('fault-rake', f.rakeDeg);
    set('fault-length', f.lengthKm);
    set('fault-width', f.widthKm);
    set('fault-top', f.topDepthKm);
  }

  /**
   * カスタム断層で波源を作り直す (全域同時破壊)
   */
  private applyCustomFault(input: CustomFaultInput, info: () => string) {
    this.customFault = input;
    this.writeCustomFaultFields(input);
    this.slipSlider.value = input.slipM.toFixed(1);
    this.slipVal.textContent = `${input.slipM.toFixed(1)} m`;
    this.slabInfoMessage = info;
    const infoEl = document.getElementById('slab-info');
    if (infoEl) infoEl.textContent = info();

    this.activeFaults = [toFaultParams(input, 'カスタム震源')];
    this.activeHypocenter = undefined;
    this.activeRupture = undefined;
    this.isRunning = false;
    this.updatePlayPauseButton();
    this.rebuildSourceDisplacement();
  }

  /**
   * 断層面積で重み付けした平均すべり量
   */
  private static meanSlip(faults: FaultParams[]): number {
    let sum = 0;
    let area = 0;
    for (const f of faults) {
      const a = f.lengthKm * f.widthKm;
      sum += f.slipM * a;
      area += a;
    }
    return area > 0 ? sum / area : 0;
  }

  private degToCompass(deg: number): string {
    const val = Math.floor((deg / 22.5) + 0.5);
    const arr = COMPASS_DIRECTIONS[this.currentLang];
    return arr[val % 16];
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init().catch(console.error);
});
