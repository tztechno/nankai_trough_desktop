export type Language = 'ja' | 'en';

export interface ScenarioTranslation {
  name: string;
  description: string;
}

export interface ObservationPointTranslation {
  name: string;
}

export const SCENARIO_TRANSLATIONS: Record<Language, Record<string, ScenarioTranslation>> = {
  ja: {
    nankai_full_m9: {
      name: '南海トラフ全域連動 (M9.1)',
      description: '駿河湾から日向灘に至るトラフ軸全域が一斉に破壊する内閣府想定クラスの最大規模地震'
    },
    tonankai_m82: {
      name: '東南海地震単独 (M8.2)',
      description: '1944年昭和東南海地震型。熊野灘〜潮岬沖を波源とする地震'
    },
    nankai_m84: {
      name: '南海地震単独 (M8.4)',
      description: '1946年昭和南海地震型。高知沖・室戸岬〜足摺岬沖を波源とする地震'
    },
    tokai_m80: {
      name: '東海地震単独 (M8.0)',
      description: '駿河トラフから遠州灘にかけて破壊する想定地震'
    }
  },
  en: {
    nankai_full_m9: {
      name: 'Full Nankai Trough Rupture (M9.1)',
      description: 'Full-trough rupture from Suruga Bay to Hyuga-nada (Maximum Cabinet Office scenario)'
    },
    tonankai_m82: {
      name: 'Tonankai Earthquake Alone (M8.2)',
      description: '1944 Showa-Tonankai type event rupturing the Kumano-nada and Shionomisaki offshore segments'
    },
    nankai_m84: {
      name: 'Nankai Earthquake Alone (M8.4)',
      description: '1946 Showa-Nankai type event rupturing offshore Kochi, Muroto, and Ashizuri segments'
    },
    tokai_m80: {
      name: 'Tokai Earthquake Alone (M8.0)',
      description: 'Anticipated event rupturing from Suruga Trough to Enshu-nada'
    }
  }
};

export const POINT_TRANSLATIONS: Record<Language, Record<string, string>> = {
  ja: {
    muroto: '室戸岬沖 (高知)',
    shionomisaki: '潮岬沖 (和歌山)',
    hamamatsu: '浜松沖 (静岡)',
    suruga: '駿河湾口 (静岡)',
    owase: '尾鷲沖 (三重)',
    ashizuri: '足摺岬沖 (高知)',
    hyuganada: '日向灘沖 (宮崎)'
  },
  en: {
    muroto: 'Offshore Muroto (Kochi)',
    shionomisaki: 'Offshore Shionomisaki (Wakayama)',
    hamamatsu: 'Offshore Hamamatsu (Shizuoka)',
    suruga: 'Suruga Bay Mouth (Shizuoka)',
    owase: 'Offshore Owase (Mie)',
    ashizuri: 'Offshore Ashizuri (Kochi)',
    hyuganada: 'Offshore Hyuga-nada (Miyazaki)'
  }
};

export const FAULT_NAME_TRANSLATIONS: Record<Language, Record<string, string>> = {
  ja: {
    '東海セグメント': '東海セグメント',
    '東南海セグメント': '東南海セグメント',
    '南海セグメント': '南海セグメント',
    '日向灘セグメント': '日向灘セグメント',
    '東南海断層': '東南海断層',
    '南海断層': '南海断層',
    '東海断層': '東海断層',
    'カスタム震源': 'カスタム震源'
  },
  en: {
    '東海セグメント': 'Tokai Segment',
    '東南海セグメント': 'Tonankai Segment',
    '南海セグメント': 'Nankai Segment',
    '日向灘セグメント': 'Hyuga-nada Segment',
    '東南海断層': 'Tonankai Fault',
    '南海断層': 'Nankai Fault',
    '東海断層': 'Tokai Fault',
    'カスタム震源': 'Custom Epicenter'
  }
};

export const COMPASS_DIRECTIONS: Record<Language, string[]> = {
  ja: ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'],
  en: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
};

export const UI_TEXTS = {
  ja: {
    appTitle: '南海トラフ津波 広域伝播シミュレーター',
    appSubtitle: 'GEBCO 15-arcsec Bathymetry & 2D Shallow Water Equations Solver (Phase 1)',
    elapsedTimeLabel: '経過時間 (ELAPSED)',
    maxSurgeLabel: '最大波高 (MAX SURGE)',
    statusReady: '準備完了 (待機中)',
    statusSimulating: 'シミュレーション計算中...',
    statusPaused: '一時停止中',
    statusCompleted: 'シミュレーション完了',
    statusDataError: '海底地形データ読込エラー',
    statusPickingEpicenter: '地図上をクリックして震源を指定してください',
    statusEpicenterUpdated: '震源を更新しました',
    statusAddingPoint: '地図上の沖合をクリックして観測地点を追加してください',
    statusPointAdded: '観測点を追加しました: ',
    
    // セクション1
    section1Title: '1. 震源断層シナリオ (Fault Scenario)',
    scenarioPresetLabel: '地震モデルプリセット:',
    magLabel: 'マグニチュード (Mw):',
    slipLabel: '平均すべり量 (Slip):',
    btnPickEpicenter: '🎯 震源クリック指定',
    btnApplyFault: '波源を再生成',

    // セクション2
    section2Title: '2. 伝播シミュレーション (Simulation)',
    btnPlayStart: 'シミュレーション開始',
    btnPlayResume: 'シミュレーション再開',
    btnPlayPause: '一時停止',
    btnFastForward: '⚡ 一括高速計算',
    btnFastForwardTitle: '指定時間までの津波伝播を一括高速計算します',
    btnReset: '↺ リセット',
    btnResetTitle: '初期状態に戻す',
    durationLabel: '計算上限時間:',
    speedLabel: '再生速度:',
    minSuffix: '分',

    // セクション3
    section3Title: '3. 各地の沖合到達予測',
    btnAddPoint: '＋ 指定点追加',
    btnAddPointTitle: '地図上の沖合をクリックして新しい指定地点を追加します',
    btnResetPoints: '↺ 初期化',
    btnResetPointsTitle: '初期の主要デフォルト地点一覧に戻します',
    btnSelectAll: '☑ 全選択',
    btnSelectAllTitle: 'すべての観測地点をチェック',
    btnDeselectAll: '☐ 全解除',
    btnDeselectAllTitle: '選択をクリアします',
    selectedCountText: (sel: number, tot: number) => `選択中: ${sel}/${tot}地点`,
    focusPointLabel: '詳細フォーカス地点 (波向き・波形統計):',
    groupDefault: '📍 デフォルト主要観測地点',
    groupCustom: '🎯 追加した指定地点',
    exportBoxTitle: '街中シミュレーション(Phase 2)への境界波形出力:',
    exportCityBtn: (count: number) => `🎯 市街地連携用波形 ( ${count}地点 )`,
    exportCityBtnTitle: 'チェックした地点の第1波到達前2分〜主要波通過までを切り出し、t=0に正規化して一括出力します',
    exportFullBtn: (count: number) => `📋 全期間データ ( ${count}地点 )`,
    exportFullBtnTitle: 'チェックした地点の地震発生t=0からの全シミュレーション履歴を一括出力します',
    exportHint: '※チェックボックスで選択したすべての観測地点のCSVが一括出力されます',

    // セクション4
    section4Title: '4. 表示レイヤー切替',
    chkBathymetry: '海底地形',
    chkWave: '津波波高',
    chkVectors: '流速ベクトル',
    chkFaults: '震源断層',

    // メインマップ
    domainTag: '南海トラフ広域解析領域',
    depthLabel: '水深:',
    elevationLabel: '標高:',
    landLabel: '(陸地)',
    waterLevelLabel: '水位:',
    tooltipPickEpicenter: (lon: string, lat: string) => `クリックして震源に設定 (${lon}°E, ${lat}°N)`,
    tooltipAddPoint: (lon: string, lat: string) => `クリックして観測地点を追加 (${lon}°E, ${lat}°N)`,
    legendWaveHeight: '津波高 (m)',

    // チャート
    chartSelectedBtn: (count: number) => `☑ 選択地点 ( ${count} )`,
    chartSelectedBtnTitle: 'チェックボックスで選択した地点を重ねて表示します',
    chartFocusBtn: '🎯 単一フォーカス',
    chartFocusBtnTitle: '現在フォーカスしている1地点のみを表示します',
    chartAllBtn: '🌐 全地点',
    chartAllBtnTitle: '登録されている全観測地点を表示します',
    chartTitleSuffix: '津波水位時刻歴',
    chartStatFirstArrival: '第1波到達:',
    chartStatMaxWave: '最大波高:',
    chartStatDirection: '波侵入方向:',
    chartStatNotArrived: '未到達',
    chartYAxisLabel: '津波水位 η (m)',
    chartXAxisLabel: '地震発生からの経過時間 (分:秒)',

    // アラート & ダイアログ
    confirmResetPoints: '観測地点を初期の主要デフォルト地点（7地点）にリセットしますか？',
    confirmExportAllIfNone: (tot: number) => `チェックされている地点がありません。\n登録されている全観測地点（指定箇所＋プリセット計 ${tot}地点）を一括出力しますか？`,
    alertNoSimulationData: 'シミュレーションデータがありません。\nシミュレーションを再生（または「一括高速計算」）してから出力してください。',
    confirmTrimmedNotArrived: (name: string) => `【${name}】にはまだ明確な津波（水位変動 >= 0.05m）が到達していません。\n全期間データ（方式A）を出力しますか？`
  },
  en: {
    appTitle: 'Nankai Trough Tsunami Simulator',
    appSubtitle: 'GEBCO 15-arcsec Bathymetry & 2D Shallow Water Equations Solver (Phase 1)',
    elapsedTimeLabel: 'ELAPSED TIME',
    maxSurgeLabel: 'MAX SURGE',
    statusReady: 'Ready (Idle)',
    statusSimulating: 'Simulating propagation...',
    statusPaused: 'Paused',
    statusCompleted: 'Simulation Completed',
    statusDataError: 'Bathymetry load error',
    statusPickingEpicenter: 'Click on the map to set the epicenter',
    statusEpicenterUpdated: 'Epicenter updated',
    statusAddingPoint: 'Click offshore on the map to add an observation point',
    statusPointAdded: 'Added observation point: ',

    // Section 1
    section1Title: '1. Earthquake Fault Scenario',
    scenarioPresetLabel: 'Earthquake Model Preset:',
    magLabel: 'Magnitude (Mw):',
    slipLabel: 'Mean Slip (m):',
    btnPickEpicenter: '🎯 Pick Epicenter',
    btnApplyFault: 'Recompute Source',

    // Section 2
    section2Title: '2. Propagation Simulation',
    btnPlayStart: 'Start Simulation',
    btnPlayResume: 'Resume Simulation',
    btnPlayPause: 'Pause',
    btnFastForward: '⚡ Fast-Forward',
    btnFastForwardTitle: 'Batch compute tsunami propagation up to the target duration',
    btnReset: '↺ Reset',
    btnResetTitle: 'Reset to initial state',
    durationLabel: 'Max Duration:',
    speedLabel: 'Playback Speed:',
    minSuffix: 'min',

    // Section 3
    section3Title: '3. Offshore Wave Forecast',
    btnAddPoint: '+ Add Custom Point',
    btnAddPointTitle: 'Click offshore on the map to add a new observation point',
    btnResetPoints: '↺ Reset Points',
    btnResetPointsTitle: 'Restore default major observation points',
    btnSelectAll: '☑ Select All',
    btnSelectAllTitle: 'Check all observation points',
    btnDeselectAll: '☐ Deselect All',
    btnDeselectAllTitle: 'Clear all selections',
    selectedCountText: (sel: number, tot: number) => `Selected: ${sel}/${tot} pts`,
    focusPointLabel: 'Focused Point (Direction & Wave Stats):',
    groupDefault: '📍 Default Primary Points',
    groupCustom: '🎯 Added Custom Points',
    exportBoxTitle: 'Export Wave Boundary Data for Phase 2 City Simulation:',
    exportCityBtn: (count: number) => `🎯 City Simulation Wave ( ${count} pts )`,
    exportCityBtnTitle: 'Extracts 2 min prior to first arrival up to main wave passage, normalized to t=0',
    exportFullBtn: (count: number) => `📋 Full Timeline Data ( ${count} pts )`,
    exportFullBtnTitle: 'Exports full simulation time history from t=0 for selected points',
    exportHint: '* CSVs for all checked observation points will be batch exported',

    // Section 4
    section4Title: '4. Layer Options',
    chkBathymetry: 'Bathymetry',
    chkWave: 'Wave Height',
    chkVectors: 'Velocity Vectors',
    chkFaults: 'Fault Segments',

    // Main map
    domainTag: 'Nankai Trough Simulation Domain',
    depthLabel: 'Depth:',
    elevationLabel: 'Elevation:',
    landLabel: '(Land)',
    waterLevelLabel: 'Wave Level:',
    tooltipPickEpicenter: (lon: string, lat: string) => `Click to set epicenter (${lon}°E, ${lat}°N)`,
    tooltipAddPoint: (lon: string, lat: string) => `Click to add point (${lon}°E, ${lat}°N)`,
    legendWaveHeight: 'Wave Height (m)',

    // Chart
    chartSelectedBtn: (count: number) => `☑ Selected ( ${count} )`,
    chartSelectedBtnTitle: 'Overlay wave elevation for all checked points',
    chartFocusBtn: '🎯 Single Focus',
    chartFocusBtnTitle: 'Display single focused observation point only',
    chartAllBtn: '🌐 All Points',
    chartAllBtnTitle: 'Display all registered observation points',
    chartTitleSuffix: 'Tsunami Elevation Time Series',
    chartStatFirstArrival: '1st Arrival:',
    chartStatMaxWave: 'Max Surge:',
    chartStatDirection: 'Wave Influx Dir:',
    chartStatNotArrived: 'Not Arrived',
    chartYAxisLabel: 'Tsunami Elevation η (m)',
    chartXAxisLabel: 'Elapsed Time from Rupture (mm:ss)',

    // Alert & Dialog
    confirmResetPoints: 'Reset observation points to the 7 default primary locations?',
    confirmExportAllIfNone: (tot: number) => `No points are checked.\nWould you like to batch export all ${tot} points (custom + preset)?`,
    alertNoSimulationData: 'No simulation data available.\nPlease start simulation or run "Fast-Forward" before exporting.',
    confirmTrimmedNotArrived: (name: string) => `[${name}] has not received a significant tsunami wave (elevation >= 0.05m) yet.\nExport full timeline data (Mode A) instead?`
  }
};
