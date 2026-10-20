export interface BathymetryMeta {
  width: number;
  height: number;
  factor: number;
  bounds: {
    lonMin: number;
    lonMax: number;
    latMin: number;
    latMax: number;
  };
  dxDeg: number;
  dyDeg: number;
  dxMeters: number;
  dyMeters: number;
}

export interface FaultParams {
  name: string;
  epicenterLon: number;
  epicenterLat: number;
  depthKm: number;          // 震源深さ (km)
  lengthKm: number;         // 断層長 (km)
  widthKm: number;          // 断層幅 (km)
  strikeDeg: number;        // 走向 (度, 北から時計回り)
  dipDeg: number;           // 傾斜角 (度)
  rakeDeg: number;          // すべり角 (度, 90度は逆断層)
  slipM: number;            // すべり量 (m)
  magnitude?: number;       // モーメントマグニチュード Mw
}

export interface ObservationPoint {
  id: string;
  name: string;
  lon: number;
  lat: number;
  color: string;
  depth?: number;
  // 解析結果
  firstArrivalSec?: number;
  maxArrivalSec?: number;
  maxWaveHeight?: number;
  minWaveHeight?: number;
  dominantDirectionDeg?: number;
  timeHistory?: {
    timeSec: number;
    elevation: number;
    u: number;
    v: number;
    speed: number;
    directionDeg: number;
  }[];
}

export interface SimulationState {
  timeSec: number;
  step: number;
  maxTimeSec: number;
  dt: number;
  isRunning: boolean;
  isPaused: boolean;
  speedMultiplier: number;
}
