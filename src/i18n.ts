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
    tohoku_2011_m90: {
      name: '2011年 東北地方太平洋沖地震 (M9.0)',
      description: '2011年3月11日 東日本大震災。日本海溝沿いの岩手沖〜茨城沖が連動破壊した簡略化モデル (4枚の断層、宮城沖〜岩手沖で約22〜24mのすべり)。GPS波浪計の最大波高に合わせてすべり量を調整'
    },
    nankai_full_m9: {
      name: '南海トラフ全域連動 (M9.1)',
      description: '駿河湾から日向灘までを4セグメントで表した簡易モデル (内閣府の公式モデルとは別。政府想定は「内閣府 南海トラフ巨大地震」の各ケースを参照)'
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
    cao2012_case1: {
      name: 'Cabinet Office Nankai Trough Megaquake Case 1: Suruga Bay to off Kii Peninsula (Mw9.1)',
      description: 'Approximate reproduction of the Cabinet Office (2012) tsunami fault model with the large-slip (~20 m) and very-large-slip (~40 m) areas placed suruga bay to off kii peninsula, built from the published rules. Rupture propagates at 2.5 km/s from the rupture start point.'
    },
    cao2012_case2: {
      name: 'Cabinet Office Nankai Trough Megaquake Case 2: Off Kii Peninsula (Mw9.1)',
      description: 'Approximate reproduction of the Cabinet Office (2012) tsunami fault model with the large-slip (~20 m) and very-large-slip (~40 m) areas placed off kii peninsula, built from the published rules. Rupture propagates at 2.5 km/s from the rupture start point.'
    },
    cao2012_case3: {
      name: 'Cabinet Office Nankai Trough Megaquake Case 3: Off Kii Peninsula to off Shikoku (Mw9.1)',
      description: 'Approximate reproduction of the Cabinet Office (2012) tsunami fault model with the large-slip (~20 m) and very-large-slip (~40 m) areas placed off kii peninsula to off shikoku, built from the published rules. Rupture propagates at 2.5 km/s from the rupture start point.'
    },
    cao2012_case4: {
      name: 'Cabinet Office Nankai Trough Megaquake Case 4: Off Shikoku (Mw9.1)',
      description: 'Approximate reproduction of the Cabinet Office (2012) tsunami fault model with the large-slip (~20 m) and very-large-slip (~40 m) areas placed off shikoku, built from the published rules. Rupture propagates at 2.5 km/s from the rupture start point.'
    },
    cao2012_case5: {
      name: 'Cabinet Office Nankai Trough Megaquake Case 5: Off Shikoku to off Kyushu (Mw9.1)',
      description: 'Approximate reproduction of the Cabinet Office (2012) tsunami fault model with the large-slip (~20 m) and very-large-slip (~40 m) areas placed off shikoku to off kyushu, built from the published rules. Rupture propagates at 2.5 km/s from the rupture start point.'
    },
    tohoku_2011_m90: {
      name: '2011 Tohoku-oki Earthquake (M9.0)',
      description: 'Great East Japan Earthquake of March 11, 2011. Simplified model of the Japan Trench rupture from offshore Iwate to Ibaraki (4 faults, about 22-24 m of slip off Miyagi and Iwate), with slip tuned to the peak heights recorded by GPS wave gauges'
    },
    nankai_full_m9: {
      name: 'Full Nankai Trough Rupture (M9.1)',
      description: 'Simplified 4-segment model from Suruga Bay to Hyuga-nada (not the official Cabinet Office model; see the "Cabinet Office Nankai Trough Megaquake" cases)'
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
    hyuganada: '日向灘沖 (宮崎)',
    iwate_n: '岩手北部沖 (久慈)',
    miyako: '宮古沖 (岩手)',
    taro: '田老沖 (岩手)',
    miyako_bay: '宮古湾口沖 (岩手)',
    kamaishi: '釜石沖 (岩手)',
    miyagi_n: '宮城北部沖 (気仙沼)',
    miyagi_c: '宮城中部沖 (石巻・女川)',
    fukushima: '福島沖 (小名浜)',
    kitan: '友ヶ島水道 (紀淡海峡)',
    wakayama_port: '和歌山港沖',
    kansai_airport: '関西空港沖',
    osaka_port: '大阪港沖',
    kobe_port: '神戸港沖'
  },
  en: {
    muroto: 'Offshore Muroto (Kochi)',
    shionomisaki: 'Offshore Shionomisaki (Wakayama)',
    hamamatsu: 'Offshore Hamamatsu (Shizuoka)',
    suruga: 'Suruga Bay Mouth (Shizuoka)',
    owase: 'Offshore Owase (Mie)',
    ashizuri: 'Offshore Ashizuri (Kochi)',
    hyuganada: 'Offshore Hyuga-nada (Miyazaki)',
    iwate_n: 'Offshore Northern Iwate (Kuji)',
    miyako: 'Offshore Miyako (Iwate)',
    taro: 'Offshore Taro (Iwate)',
    miyako_bay: 'Miyako Bay Mouth (Iwate)',
    kamaishi: 'Offshore Kamaishi (Iwate)',
    miyagi_n: 'Offshore Northern Miyagi (Kesennuma)',
    miyagi_c: 'Offshore Central Miyagi (Ishinomaki/Onagawa)',
    fukushima: 'Offshore Fukushima (Onahama)',
    kitan: 'Tomogashima Strait (Kitan Strait)',
    wakayama_port: 'Off Wakayama Port',
    kansai_airport: 'Off Kansai Airport',
    osaka_port: 'Off Osaka Port',
    kobe_port: 'Off Kobe Port'
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
    'カスタム震源': 'カスタム震源',
    '宮城沖海溝寄り': '宮城沖海溝寄り',
    '宮城沖深部': '宮城沖深部',
    '岩手沖': '岩手沖',
    '福島・茨城沖': '福島・茨城沖'
  },
  en: {
    '東海セグメント': 'Tokai Segment',
    '東南海セグメント': 'Tonankai Segment',
    '南海セグメント': 'Nankai Segment',
    '日向灘セグメント': 'Hyuga-nada Segment',
    '東南海断層': 'Tonankai Fault',
    '南海断層': 'Nankai Fault',
    '東海断層': 'Tokai Fault',
    'カスタム震源': 'Custom Epicenter',
    '宮城沖海溝寄り': 'Off-Miyagi (Trench-side)',
    '宮城沖深部': 'Off-Miyagi (Deep)',
    '岩手沖': 'Off-Iwate',
    '福島・茨城沖': 'Off-Fukushima/Ibaraki'
  }
};

export const REFERENCE_EVENT_NAMES: Record<Language, Record<string, string>> = {
  ja: {
    hoei_1707: '1707年宝永地震',
    ansei_tokai_1854: '1854年安政東海地震'
  },
  en: {
    hoei_1707: '1707 Hoei Earthquake',
    ansei_tokai_1854: '1854 Ansei-Tokai Earthquake'
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
    customFaultTitle: '📐 カスタム断層パラメータ (震源クリック指定)',
    slabAutoLabel: 'プレート境界の形状 (USGS Slab) から自動設定',
    customFaultHint: 'マグニチュードを選んでから「震源クリック指定」で地図をクリックしてください。',
    faultStrike: '走向 (°)',
    faultDip: '傾斜 (°)',
    faultRake: 'すべり角 (°)',
    faultLength: '長さ (km)',
    faultWidth: '幅 (km)',
    faultTopDepth: '上端深さ (km)',
    btnApplyCustomFault: 'この値で波源を再生成',
    alertNoCustomFault: '先に「震源クリック指定」で地図上をクリックしてカスタム震源を作成してください。',
    slabInfo: (depth: string, strike: string, dip: string, src: string) => `プレート境界 (${src}): 深さ ${depth} km / 走向 ${strike}° / 傾斜 ${dip}° に沿って断層を配置しました。断層サイズはスケーリング則 (Strasser et al., 2010) によります。`,
    slabOutOfRange: 'この地点はプレート境界データの範囲外のため、下の手動パラメータで断層を配置しました。',
    slabTooDeep: (depth: string) => `この地点のプレート境界は深さ ${depth} km でプレート間地震としては深すぎるため、下の手動パラメータで断層を配置しました。`,
    slabAutoOff: '自動設定がオフのため、下の手動パラメータで断層を配置しました。',
    slabEdited: '手動で編集したパラメータで波源を再生成しました。',

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
    filterLabel: '数値フィルター:',
    nestedToggle: '大阪湾・紀伊水道北部を高解像度で計算 (15秒メッシュ)',
    nestedGridLabel: '高解像度領域 (15秒メッシュ)',
    statusNestedOn: '大阪湾・紀伊水道北部を高解像度 (15秒メッシュ) で計算し直しました',
    statusNestedOff: '高解像度領域を使わずに計算し直しました',
    filterOptions: {
      shapiro4: '4次Shapiro (推奨)',
      laplacianWeak: 'ラプラシアン 弱 (κ=0.005)',
      laplacianLegacy: 'ラプラシアン 旧設定 (κ=0.03)',
      none: 'なし (比較用)'
    } as Record<string, string>,
    statusFilterChanged: (name: string) => `数値フィルターを「${name}」にして計算をやり直しました`,
    minSuffix: '分',
    btnRecordStart: '🎥 MP4録画',
    exportLengthLabel: '動画の長さ:',
    exportLengthOption: (sec: number) => `${sec}秒`,
    btnExportVideo: '🎬 動画を書き出し',
    btnExportCancel: '⏹ 書き出しを中止',
    btnExportVideoTitle: '地震発生から計算上限時間までを自動で計算し直し、指定した長さの動画として書き出します（結果は計算済みのものと同じです）',
    statusExporting: (pct: number, min: number) => `動画を書き出し中… ${pct}% (地震発生から${min}分)`,
    statusExportCancelled: '動画の書き出しを中止しました',
    statusExportDone: '動画の書き出しが完了しました',
    btnRecordStop: '⏹ 録画停止・保存',
    btnRecordTitle: 'シミュレーションのアニメーションを録画し、停止時（または計算完了時）にMP4で保存します',
    statusRecording: '録画中 (シミュレーション実行中)...',
    statusEncoding: '動画ファイルを書き出し中...',
    recordSaved: (where: string) => `動画を保存しました: ${where}`,
    recordWebmFallback: 'この環境はMP4エンコードに未対応のため、WebM形式で保存しました。',
    recordUnsupported: 'この環境では動画の録画に対応していません。',
    fileSaved: (where: string) => `保存しました: ${where}`,
    dialogOk: 'OK',
    dialogCancel: 'キャンセル',

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
    domainTag: '日本全国 広域解析領域',
    hudElapsed: '地震発生から',
    btnFitDomain: '⤢ 全国表示',
    btnFitScenario: '🔍 震源域へ',
    mapNavHint: 'ホイール: ズーム / ドラッグ: 移動',
    depthLabel: '水深:',
    elevationLabel: '標高:',
    landLabel: '(陸地)',
    waterLevelLabel: '水位:',
    tooltipPickEpicenter: (lon: string, lat: string) => `クリックして震源に設定 (${lon}°E, ${lat}°N)`,
    tooltipAddPoint: (lon: string, lat: string) => `クリックして観測地点を追加 (${lon}°E, ${lat}°N)`,
    legendWaveHeight: '津波高 (m)',
    hypocenterLabel: (depthKm: number) => `震源 (深さ${depthKm}km)`,
    hypocenterReferenceLabel: (eventName: string) => `参考: ${eventName}の推定震央`,
    hypocenterLabelNoDepth: '震源',
    ruptureStartLabel: (depthKm: number) => `破壊開始点 (深さ約${depthKm}km・内閣府想定)`,

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
    confirmResetPoints: '観測地点を初期の主要デフォルト地点（20地点）にリセットしますか？',
    confirmExportAllIfNone: (tot: number) => `チェックされている地点がありません。\n登録されている全観測地点（指定箇所＋プリセット計 ${tot}地点）を一括出力しますか？`,
    alertNoSimulationData: 'シミュレーションデータがありません。\nシミュレーションを再生（または「一括高速計算」）してから出力してください。',
    confirmExportIncomplete: (doneMin: number, totalMin: number) => `計算はまだ ${doneMin}分 までしか進んでいません（設定 ${totalMin}分）。\nこの時点までのデータを出力しますか？`
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
    customFaultTitle: '📐 Custom Fault Parameters (Pick Epicenter)',
    slabAutoLabel: 'Auto-set from plate interface geometry (USGS Slab)',
    customFaultHint: 'Choose the magnitude, then click the map with "Pick Epicenter".',
    faultStrike: 'Strike (°)',
    faultDip: 'Dip (°)',
    faultRake: 'Rake (°)',
    faultLength: 'Length (km)',
    faultWidth: 'Width (km)',
    faultTopDepth: 'Top depth (km)',
    btnApplyCustomFault: 'Recompute with these values',
    alertNoCustomFault: 'First create a custom source by clicking the map with "Pick Epicenter".',
    slabInfo: (depth: string, strike: string, dip: string, src: string) => `Fault placed along the plate interface (${src}): depth ${depth} km / strike ${strike}° / dip ${dip}°. Fault size from the scaling law of Strasser et al. (2010).`,
    slabOutOfRange: 'This location is outside the plate interface data, so the fault uses the manual parameters below.',
    slabTooDeep: (depth: string) => `The plate interface here is ${depth} km deep, too deep for an interplate earthquake, so the fault uses the manual parameters below.`,
    slabAutoOff: 'Auto-set is off, so the fault uses the manual parameters below.',
    slabEdited: 'Source recomputed with the manually edited parameters.',

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
    filterLabel: 'Numerical Filter:',
    nestedToggle: 'High resolution for Osaka Bay & northern Kii Channel (15-arcsec)',
    nestedGridLabel: 'High-resolution area (15-arcsec)',
    statusNestedOn: 'Recomputed with Osaka Bay & the northern Kii Channel at high resolution (15-arcsec)',
    statusNestedOff: 'Recomputed without the high-resolution area',
    filterOptions: {
      shapiro4: '4th-order Shapiro (recommended)',
      laplacianWeak: 'Laplacian, weak (κ=0.005)',
      laplacianLegacy: 'Laplacian, legacy (κ=0.03)',
      none: 'None (for comparison)'
    } as Record<string, string>,
    statusFilterChanged: (name: string) => `Numerical filter set to "${name}"; simulation restarted`,
    minSuffix: 'min',
    btnRecordStart: '🎥 Record MP4',
    exportLengthLabel: 'Video length:',
    exportLengthOption: (sec: number) => `${sec} s`,
    btnExportVideo: '🎬 Export Video',
    btnExportCancel: '⏹ Cancel Export',
    btnExportVideoTitle: 'Recomputes from the earthquake to the max duration automatically and exports a video of the chosen length (the result is identical to the computed run)',
    statusExporting: (pct: number, min: number) => `Exporting video… ${pct}% (${min} min after the earthquake)`,
    statusExportCancelled: 'Video export cancelled',
    statusExportDone: 'Video export finished',
    btnRecordStop: '⏹ Stop & Save',
    btnRecordTitle: 'Record the simulation animation and save it as MP4 when stopped (or when the run completes)',
    statusRecording: 'Recording (simulation running)...',
    statusEncoding: 'Writing video file...',
    recordSaved: (where: string) => `Video saved: ${where}`,
    recordWebmFallback: 'MP4 encoding is not supported in this environment, so the video was saved as WebM.',
    recordUnsupported: 'Video recording is not supported in this environment.',
    fileSaved: (where: string) => `Saved: ${where}`,
    dialogOk: 'OK',
    dialogCancel: 'Cancel',

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
    domainTag: 'Japan-wide Simulation Domain',
    hudElapsed: 'Since EQ',
    btnFitDomain: '⤢ All Japan',
    btnFitScenario: '🔍 Source Area',
    mapNavHint: 'Wheel: zoom / Drag: pan',
    depthLabel: 'Depth:',
    elevationLabel: 'Elevation:',
    landLabel: '(Land)',
    waterLevelLabel: 'Wave Level:',
    tooltipPickEpicenter: (lon: string, lat: string) => `Click to set epicenter (${lon}°E, ${lat}°N)`,
    tooltipAddPoint: (lon: string, lat: string) => `Click to add point (${lon}°E, ${lat}°N)`,
    legendWaveHeight: 'Wave Height (m)',
    hypocenterLabel: (depthKm: number) => `Hypocenter (${depthKm} km deep)`,
    hypocenterReferenceLabel: (eventName: string) => `Ref.: estimated epicenter of the ${eventName}`,
    hypocenterLabelNoDepth: 'Hypocenter',
    ruptureStartLabel: (depthKm: number) => `Rupture start (~${depthKm} km deep, Cabinet Office)`,

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
    confirmResetPoints: 'Reset observation points to the 20 default primary locations?',
    confirmExportAllIfNone: (tot: number) => `No points are checked.\nWould you like to batch export all ${tot} points (custom + preset)?`,
    alertNoSimulationData: 'No simulation data available.\nPlease start simulation or run "Fast-Forward" before exporting.',
    confirmExportIncomplete: (doneMin: number, totalMin: number) => `The simulation has only reached ${doneMin} min (of ${totalMin} min).\nExport the data up to this point?`
  }
};
