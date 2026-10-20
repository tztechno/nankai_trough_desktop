import { FaultParams, ObservationPoint } from '../types';

export interface PresetScenario {
  id: string;
  name: string;
  description: string;
  magnitude: number;
  faults: FaultParams[];
}

export const FAULT_PRESETS: PresetScenario[] = [
  {
    id: 'nankai_full_m9',
    name: '南海トラフ全域連動 (M9.1)',
    description: '駿河湾から日向灘に至るトラフ軸全域が一斉に破壊する内閣府想定クラスの最大規模地震',
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
    name: '南海地震単独 (M8.4)',
    description: '1946年昭和南海地震型。高知沖・室戸岬〜足摺岬沖を波源とする地震',
    magnitude: 8.4,
    faults: [
      {
        name: '南海断層',
        epicenterLon: 134.2,
        epicenterLat: 32.7,
        depthKm: 10,
        lengthKm: 220,
        widthKm: 90,
        strikeDeg: 250,
        dipDeg: 12,
        rakeDeg: 105,
        slipM: 11.0
      }
    ]
  },
  {
    id: 'tokai_m80',
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
  }
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
  }
];
