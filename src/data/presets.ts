import { FaultParams, Hypocenter, ObservationPoint } from '../types';
import { buildCabinetOfficeCase } from './cabinetOfficeNankai';

export interface PresetScenario {
  id: string;
  name: string;
  description: string;
  magnitude: number;
  faults: FaultParams[];
  // シナリオ選択時に地図を合わせる表示範囲と、詳細フォーカスする観測点
  view: { lonMin: number; lonMax: number; latMin: number; latMax: number };
  focusPointId: string;
  // 歴史地震の震源 (気象庁)。想定地震では未設定
  hypocenter?: Hypocenter;
  // 破壊伝播 (hypocenter から開始)。未設定は全域同時破壊
  rupture?: { velocityKmS: number; riseTimeSec: number };
}

/**
 * 内閣府 (2012) 南海トラフ巨大地震 津波断層モデルの基本的な検討ケース (概略再現)
 */
function cabinetOfficeScenario(
  caseNo: number,
  region: string,
  center: number | 'east' | 'west',
  focusPointId: string
): PresetScenario {
  const model = buildCabinetOfficeCase(center);
  const circled = '①②③④⑤'[caseNo - 1];
  return {
    id: `cao2012_case${caseNo}`,
    view: { lonMin: 130.5, lonMax: 139.5, latMin: 30.0, latMax: 36.0 },
    focusPointId,
    hypocenter: { ...model.ruptureStart, ruptureStart: true },
    rupture: { velocityKmS: 2.5, riseTimeSec: 60 },
    name: `内閣府 南海トラフ巨大地震 ケース${circled} ${region} (Mw${model.mw.toFixed(1)})`,
    description: `内閣府(2012)の津波断層モデル「${region}」に大すべり域(約20m)・超大すべり域(約40m)を置くケースを、公表された設定ルールから概略再現。破壊開始点から2.5km/sで破壊が伝播。平均すべり量 ${model.meanSlipM.toFixed(1)}m`,
    magnitude: Number(model.mw.toFixed(1)),
    faults: model.faults
  };
}

const NANKAI_VIEW = { lonMin: 130.0, lonMax: 141.0, latMin: 30.0, latMax: 36.5 };

export const FAULT_PRESETS: PresetScenario[] = [
  {
    id: 'nankai_full_m9',
    view: NANKAI_VIEW,
    // 想定地震のため震源は未定。参考として同型の 1707年宝永地震の推定震央 (理科年表) を表示
    hypocenter: { lon: 135.9, lat: 33.2, referenceEvent: 'hoei_1707' },
    focusPointId: 'muroto',
    name: '南海トラフ全域連動 (M9.1)',
    description: '駿河湾から日向灘までを4セグメントで表した簡易モデル (内閣府の公式モデルとは別。政府想定は「内閣府 南海トラフ巨大地震」の各ケースを参照)',
    magnitude: 9.1,
    faults: [
      // 東海・駿河湾〜遠州灘セグメント
      {
        name: '東海セグメント',
        epicenterLon: 137.8,
        epicenterLat: 34.2,
        depthKm: 12,
        lengthKm: 140,
        widthKm: 70,
        strikeDeg: 235,
        dipDeg: 15,
        rakeDeg: 90,
        slipM: 14.0
      },
      // 東南海セグメント (熊野灘〜潮岬)
      {
        name: '東南海セグメント',
        epicenterLon: 136.2,
        epicenterLat: 33.4,
        depthKm: 10,
        lengthKm: 160,
        widthKm: 85,
        strikeDeg: 245,
        dipDeg: 12,
        rakeDeg: 95,
        slipM: 18.0
      },
      // 南海セグメント (紀伊水道〜室戸沖〜高知沖)
      {
        name: '南海セグメント',
        epicenterLon: 134.5,
        epicenterLat: 32.8,
        depthKm: 8,
        lengthKm: 200,
        widthKm: 90,
        strikeDeg: 250,
        dipDeg: 12,
        rakeDeg: 100,
        slipM: 20.0
      },
      // 日向灘セグメント
      {
        name: '日向灘セグメント',
        epicenterLon: 132.5,
        epicenterLat: 31.8,
        depthKm: 15,
        lengthKm: 120,
        widthKm: 65,
        strikeDeg: 220,
        dipDeg: 18,
        rakeDeg: 90,
        slipM: 10.0
      }
    ]
  },
  {
    id: 'tonankai_m82',
    view: NANKAI_VIEW,
    hypocenter: { lon: 136.18, lat: 33.57, depthKm: 40 },
    focusPointId: 'shionomisaki',
    name: '東南海地震単独 (M8.2)',
    description: '1944年昭和東南海地震型。熊野灘〜潮岬沖を波源とする地震',
    magnitude: 8.2,
    faults: [
      {
        name: '東南海断層',
        epicenterLon: 136.3,
        epicenterLat: 33.5,
        depthKm: 12,
        lengthKm: 180,
        widthKm: 80,
        strikeDeg: 245,
        dipDeg: 15,
        rakeDeg: 95,
        slipM: 9.5
      }
    ]
  },
  {
    id: 'nankai_m84',
    view: NANKAI_VIEW,
    hypocenter: { lon: 135.85, lat: 32.94, depthKm: 24 },
    focusPointId: 'muroto',
    name: '南海地震単独 (M8.4)',
    description: '1946年昭和南海地震型。高知沖・室戸岬〜足摺岬沖を波源とする地震',
    magnitude: 8.4,
    faults: [
      {
        // 震源 (潮岬沖) から西へ破壊が進んだ史実に合わせ、断層の東端が震源を含むように配置
        name: '南海断層',
        epicenterLon: 134.5,
        epicenterLat: 32.75,
        depthKm: 10,
        lengthKm: 270,
        widthKm: 90,
        strikeDeg: 250,
        dipDeg: 12,
        rakeDeg: 105,
        slipM: 9.0
      }
    ]
  },
  {
    id: 'tokai_m80',
    view: NANKAI_VIEW,
    // 想定地震のため震源は未定。参考として 1854年安政東海地震の推定震央 (理科年表) を表示
    hypocenter: { lon: 137.8, lat: 34.0, referenceEvent: 'ansei_tokai_1854' },
    focusPointId: 'hamamatsu',
    name: '東海地震単独 (M8.0)',
    description: '駿河トラフから遠州灘にかけて破壊する想定地震',
    magnitude: 8.0,
    faults: [
      {
        name: '東海断層',
        epicenterLon: 138.0,
        epicenterLat: 34.3,
        depthKm: 14,
        lengthKm: 130,
        widthKm: 65,
        strikeDeg: 230,
        dipDeg: 18,
        rakeDeg: 90,
        slipM: 7.0
      }
    ]
  },
  {
    id: 'tohoku_2011_m90',
    view: { lonMin: 137.5, lonMax: 147.5, latMin: 34.0, latMax: 42.5 },
    focusPointId: 'miyagi_c',
    hypocenter: { lon: 142.86, lat: 38.10, depthKm: 24 },
    name: '2011年 東北地方太平洋沖地震 (M9.0)',
    description: '2011年3月11日 東日本大震災。日本海溝沿いの岩手沖〜茨城沖が連動破壊した簡略化モデル (4枚の断層、宮城沖〜岩手沖で約22〜24mのすべり)。GPS波浪計の最大波高に合わせてすべり量を調整',
    magnitude: 9.0,
    // すべり量は、GPS波浪計 (宮城中部沖・宮城北部沖・岩手南部沖・岩手中部沖・岩手北部沖) の最大波高に合うよう、
    // 既定の数値フィルター (4次Shapiro) と吸収層の条件で調整した値 (Mw 約9.0)
    faults: [
      // 宮城沖・海溝寄り (破壊は海溝軸付近まで達した)
      {
        name: '宮城沖海溝寄り',
        epicenterLon: 143.25,
        epicenterLat: 38.15,
        depthKm: 1,
        lengthKm: 180,
        widthKm: 70,
        strikeDeg: 195,
        dipDeg: 12,
        rakeDeg: 90,
        slipM: 24.0
      },
      // 宮城沖・深部 (海溝寄りセグメントの下端から続くプレート境界深部)
      {
        name: '宮城沖深部',
        epicenterLon: 142.5,
        epicenterLat: 38.3,
        depthKm: 15,
        lengthKm: 200,
        widthKm: 80,
        strikeDeg: 195,
        dipDeg: 15,
        rakeDeg: 90,
        slipM: 22.0
      },
      // 岩手沖 (三陸沖中部)
      {
        name: '岩手沖',
        epicenterLon: 143.25,
        epicenterLat: 39.35,
        depthKm: 3,
        lengthKm: 150,
        widthKm: 80,
        strikeDeg: 190,
        dipDeg: 12,
        rakeDeg: 90,
        slipM: 23.0
      },
      // 福島沖〜茨城沖
      {
        name: '福島・茨城沖',
        epicenterLon: 141.95,
        epicenterLat: 36.85,
        depthKm: 5,
        lengthKm: 180,
        widthKm: 80,
        strikeDeg: 205,
        dipDeg: 14,
        rakeDeg: 90,
        slipM: 10.0
      }
    ]
  },
  cabinetOfficeScenario(1, '駿河湾～紀伊半島沖', 'east', 'hamamatsu'),
  cabinetOfficeScenario(2, '紀伊半島沖', 135.75, 'shionomisaki'),
  cabinetOfficeScenario(3, '紀伊半島沖～四国沖', 135.0, 'muroto'),
  cabinetOfficeScenario(4, '四国沖', 133.9, 'ashizuri'),
  cabinetOfficeScenario(5, '四国沖～九州沖', 'west', 'hyuganada')
];

export const DEFAULT_OBSERVATION_POINTS: ObservationPoint[] = [
  {
    id: 'muroto',
    name: '室戸岬沖 (高知)',
    lon: 134.20,
    lat: 33.20,
    color: '#38bdf8' // Sky Blue
  },
  {
    id: 'shionomisaki',
    name: '潮岬沖 (和歌山)',
    lon: 135.75,
    lat: 33.38,
    color: '#f43f5e' // Rose
  },
  {
    id: 'hamamatsu',
    name: '浜松沖 (静岡)',
    lon: 137.70,
    lat: 34.50,
    color: '#eab308' // Amber
  },
  {
    id: 'suruga',
    name: '駿河湾口 (静岡)',
    lon: 138.55,
    lat: 34.70,
    color: '#a855f7' // Purple
  },
  {
    id: 'owase',
    name: '尾鷲沖 (三重)',
    lon: 136.35,
    lat: 33.95,
    color: '#10b981' // Emerald
  },
  {
    id: 'ashizuri',
    name: '足摺岬沖 (高知)',
    lon: 133.00,
    lat: 32.65,
    color: '#06b6d4' // Cyan
  },
  {
    id: 'hyuganada',
    name: '日向灘沖 (宮崎)',
    lon: 131.90,
    lat: 32.00,
    color: '#f97316' // Orange
  },
  // --- 東北太平洋沿岸 (GPS波浪計の設置位置付近) ---
  {
    id: 'iwate_n',
    name: '岩手北部沖 (久慈)',
    lon: 142.10,
    lat: 40.12,
    color: '#ec4899' // Pink
  },
  {
    id: 'miyako',
    name: '宮古沖 (岩手)',
    lon: 142.19,
    lat: 39.63,
    color: '#84cc16' // Lime
  },
  // miyako_tsunami の地区ごとの波源: 各計算域の流入境界のすぐ外側 (1.5分格子で4セルとも海)
  {
    id: 'taro',
    name: '田老沖 (岩手)',
    lon: 142.07,
    lat: 39.74,
    color: '#22d3ee' // Cyan
  },
  {
    id: 'miyako_bay',
    name: '宮古湾口沖 (岩手)',
    lon: 142.01,
    lat: 39.69,
    color: '#a3e635' // Light Lime
  },
  {
    id: 'kamaishi',
    name: '釜石沖 (岩手)',
    lon: 142.07,
    lat: 39.26,
    color: '#14b8a6' // Teal
  },
  {
    id: 'miyagi_n',
    name: '宮城北部沖 (気仙沼)',
    lon: 141.89,
    lat: 38.86,
    color: '#fb7185' // Light Rose
  },
  {
    id: 'miyagi_c',
    name: '宮城中部沖 (石巻・女川)',
    lon: 141.68,
    lat: 38.23,
    color: '#facc15' // Yellow
  },
  {
    id: 'fukushima',
    name: '福島沖 (小名浜)',
    lon: 141.18,
    lat: 36.97,
    color: '#818cf8' // Indigo
  },
  // --- 大阪湾・紀伊水道北部 (高解像度の入れ子格子の範囲) ---
  {
    id: 'kitan',
    name: '友ヶ島水道 (紀淡海峡)',
    lon: 135.05,
    lat: 34.28,
    color: '#60a5fa' // Blue
  },
  {
    id: 'wakayama_port',
    name: '和歌山港沖',
    lon: 135.08,
    lat: 34.20,
    color: '#4ade80' // Green
  },
  {
    id: 'kansai_airport',
    name: '関西空港沖',
    lon: 135.20,
    lat: 34.43,
    color: '#e879f9' // Fuchsia
  },
  {
    id: 'osaka_port',
    name: '大阪港沖',
    lon: 135.35,
    lat: 34.60,
    color: '#fbbf24' // Amber
  },
  {
    id: 'kobe_port',
    name: '神戸港沖',
    lon: 135.22,
    lat: 34.64,
    color: '#f87171' // Red
  }
];
