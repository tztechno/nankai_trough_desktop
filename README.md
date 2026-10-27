# Nankai Trough Tsunami Simulator (Desktop Edition)
**南海トラフ津波広域伝播シミュレーター デスクトップ版**

南海トラフ巨大地震に伴う広域海洋津波伝播を物理ベース（Okada弾性転位モデル × 2次元非線形浅水流方程式）でシミュレーションするデスクトップアプリケーションです。Tauri v2 による超軽量・ネイティブ動作を実現しています。

---

## 主な特徴

- **完全オフライン動作**: 海底地形データ（GEBCO）を同梱し、ネットワーク不要で高速実行可能。
- **超軽量＆高パフォーマンス**: アプリケーション本体わずか数MB、数秒で120分の物理計算を一括実行。
- **市街地遡上連携用 CSV 出力**:
  - 全期間データ（Full Timeline: 地震発生 t=0 から。水位・流速ベクトル・流向を含む）
- **マルチプラットフォーム**: macOS（Apple Silicon / Intel）および Windows 10/11 対応。

---

## 開発・起動方法

```bash
# 依存関係のインストール
npm install

# 開発モード起動 (Vite + Tauri)
npm run tauri dev

# リリースビルド
npm run tauri build
```

---

## 自動ビルド・リリース (GitHub Actions)

本リポジトリの `main` ブランチへ push されると、GitHub Actions（`.github/workflows/build-windows.yml`）が自動起動し、Windows 版インストーラー（`.exe`）がビルドされて GitHub Releases に自動添付されます。
