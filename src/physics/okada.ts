import { FaultParams } from '../types';

/**
 * Okada (1985) の弾性食い違い理論に基づく半無限均質媒質表面の鉛直変位計算
 * Okada, Y. (1985), Surface deformation due to shear and tensile faults in a half-space,
 * Bull. Seismol. Soc. Am., 75, 1135-1154.
 */

// ポアソン比 ν = 0.25 (ポアソン固体)
const POISSON = 0.25;
const ALPHA = (1 - 2 * POISSON) / (2 * (1 - POISSON)); // ≈ 0.3333

function chinnery(f: (xi: number, eta: number) => number, x: number, p: number, L: number, W: number): number {
  return f(x, p) - f(x, p - W) - f(x - L, p) + f(x - L, p - W);
}

/**
 * ストライクスリップ（走向すべり）成分による鉛直変位
 */
function strikeSlipVertical(xi: number, eta: number, q: number, dipRad: number): number {
  const sinD = Math.sin(dipRad);
  const cosD = Math.cos(dipRad);
  const R = Math.hypot(xi, eta, q);
  if (R === 0) return 0;

  const d = eta * sinD - q * cosD;
  const y = eta * cosD + q * sinD;

  const term1 = (d * q) / (R * (R + eta));
  const term2 = (sinD * xi * q) / (R * (R + eta));
  let term3 = 0;
  if (Math.abs(cosD) > 1e-6) {
    const I5 = ALPHA * 2 * Math.atan((eta * (xi + q * cosD) + R * q * sinD) / (xi * (R + eta) * cosD));
    term3 = -sinD * I5;
  }

  return -(term1 + term2 + term3) / (2 * Math.PI);
}

/**
 * ディップスリップ（傾斜すべり）成分による鉛直変位（津波を引き起こす主成分）
 */
function dipSlipVertical(xi: number, eta: number, q: number, dipRad: number): number {
  const sinD = Math.sin(dipRad);
  const cosD = Math.cos(dipRad);
  const R = Math.hypot(xi, eta, q);
  if (R === 0) return 0;

  const d = eta * sinD - q * cosD;
  const y = eta * cosD + q * sinD;

  // 主項
  const term1 = (d * q) / (R * (R + xi));
  const term2 = sinD * eta * q / (R * (R + xi));
  
  // 自由表面境界条件補正項 (Okada 1985 Eq. 27-29)
  let term3 = 0;
  if (Math.abs(cosD) > 1e-6) {
    const I5 = ALPHA * 2 * Math.atan((eta * (xi + q * cosD) + R * q * sinD) / (xi * (R + eta) * cosD + 1e-12));
    term3 = cosD * (ALPHA * (xi * cosD / (R + d) - Math.log(R + eta + 1e-12)) - I5);
  } else {
    term3 = -ALPHA * (xi * q) / ((R + d) * (R + d) + 1e-12);
  }

  const uz = -(term1 + term2 + term3 * sinD) / (2 * Math.PI);
  return isNaN(uz) ? 0 : uz;
}

/**
 * 単一矩形断層による任意観測点 (x, y) での鉛直変位 (m)
 * x: 走向方向の距離 (m)
 * y: 走向直交方向の距離 (m)
 */
export function calculateOkadaVerticalDisplacement(
  xMeters: number,
  yMeters: number,
  depthMeters: number,
  lengthMeters: number,
  widthMeters: number,
  dipDeg: number,
  rakeDeg: number,
  slipMeters: number
): number {
  const dipRad = (dipDeg * Math.PI) / 180;
  const rakeRad = (rakeDeg * Math.PI) / 180;

  const U1 = slipMeters * Math.cos(rakeRad); // ストライクスリップ量
  const U2 = slipMeters * Math.sin(rakeRad); // ディップスリップ量

  const sinD = Math.sin(dipRad);
  const cosD = Math.cos(dipRad);

  const d = depthMeters;
  const p = yMeters * cosD + d * sinD;
  const q = yMeters * sinD - d * cosD;

  // 4隅の寄与を合成 (Chinnery's notation)
  const fnStrike = (xi: number, eta: number) => strikeSlipVertical(xi, eta, q, dipRad);
  const fnDip = (xi: number, eta: number) => dipSlipVertical(xi, eta, q, dipRad);

  let uz = 0;
  if (Math.abs(U1) > 1e-4) {
    uz += U1 * chinnery(fnStrike, xMeters, p, lengthMeters, widthMeters);
  }
  if (Math.abs(U2) > 1e-4) {
    uz += U2 * chinnery(fnDip, xMeters, p, lengthMeters, widthMeters);
  }

  // 物理的リミッター（数値特異点保護）
  if (isNaN(uz) || !isFinite(uz)) return 0;
  const maxDisplacement = slipMeters * 1.5;
  return Math.max(-maxDisplacement, Math.min(maxDisplacement, uz));
}

/**
 * 緯度経度グリッド全体に対して断層モデルから初期海面変位配列 (Float32Array) を生成
 */
export function computeInitialDisplacementGrid(
  faults: FaultParams[],
  gridWidth: number,
  gridHeight: number,
  lonMin: number,
  lonMax: number,
  latMin: number,
  latMax: number
): Float32Array {
  const eta0 = new Float32Array(gridWidth * gridHeight);
  const dLon = (lonMax - lonMin) / gridWidth;
  const dLat = (latMax - latMin) / gridHeight;

  // 緯度1度あたりの距離 (約111km)
  const latMetersPerDeg = 111132;

  for (const fault of faults) {
    const strikeRad = (fault.strikeDeg * Math.PI) / 180;
    const cosStrike = Math.cos(strikeRad);
    const sinStrike = Math.sin(strikeRad);

    const L = fault.lengthKm * 1000;
    const W = fault.widthKm * 1000;
    const depth = fault.depthKm * 1000;
    const slip = fault.slipM;

    const epicLat = fault.epicenterLat;
    const epicLon = fault.epicenterLon;
    const lonMetersPerDeg = latMetersPerDeg * Math.cos((epicLat * Math.PI) / 180);

    // 断層の影響範囲を大まかに絞り込む（高速化）
    const searchRadiusKm = (fault.lengthKm + fault.widthKm) * 1.2;
    const minGridLon = epicLon - searchRadiusKm / (lonMetersPerDeg / 1000);
    const maxGridLon = epicLon + searchRadiusKm / (lonMetersPerDeg / 1000);
    const minGridLat = epicLat - searchRadiusKm / 111;
    const maxGridLat = epicLat + searchRadiusKm / 111;

    const colStart = Math.max(0, Math.floor((minGridLon - lonMin) / dLon));
    const colEnd = Math.min(gridWidth, Math.ceil((maxGridLon - lonMin) / dLon));
    const rowStart = Math.max(0, Math.floor((latMax - maxGridLat) / dLat));
    const rowEnd = Math.min(gridHeight, Math.ceil((latMax - minGridLat) / dLat));

    for (let r = rowStart; r < rowEnd; r++) {
      const lat = latMax - r * dLat;
      const dY = (lat - epicLat) * latMetersPerDeg;

      for (let c = colStart; c < colEnd; c++) {
        const lon = lonMin + c * dLon;
        const dX = (lon - epicLon) * lonMetersPerDeg;

        // 断層座標系 (走向方向 x, 走向直交方向 y) への回転変換
        // 北=Y, 東=X
        const faultX = dX * sinStrike + dY * cosStrike;
        const faultY = -dX * cosStrike + dY * sinStrike;

        // 断層原点を中心とするオフセット調整（矩形中央を震源座標とする場合）
        const shiftedX = faultX + L * 0.5;
        const shiftedY = faultY + W * 0.5 * Math.cos((fault.dipDeg * Math.PI) / 180);

        const dz = calculateOkadaVerticalDisplacement(
          shiftedX,
          shiftedY,
          depth,
          L,
          W,
          fault.dipDeg,
          fault.rakeDeg,
          slip
        );

        eta0[r * gridWidth + c] += dz;
      }
    }
  }

  return eta0;
}
