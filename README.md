# Pet Robot

高齢者の散歩を支援する `Pet Robot` のプロトタイプです。  
現在地の取得、散歩時間の設定、ループ経路の自動生成、散歩中ナビゲーション、散歩後フィードバックまでを Web UI と TypeScript API で検証しています。

## 現在の実装範囲

- `/setup`
  - GPS で現在地を取得
  - 地図上で出発地点を調整
  - 散歩時間を入力
  - OpenRouteService を使ってループ経路を生成
- `/walking`
  - 生成済み経路を使った散歩中 UI
  - 現在地トラッキング
- `/proposal`
  - おすすめコースを 1 件表示する旧 UI
- `/feedback`
  - 散歩後のフィードバック入力

最新版の散歩準備フローは `/setup` です。

## 技術スタック

- Frontend: Next.js 15 / React 19 / TypeScript / Leaflet / React Leaflet
- Backend: Fastify / TypeScript
- Routing API: OpenRouteService
- Storage:
  - 既定: In-memory
  - 任意: PostgreSQL

## ディレクトリ構成

```text
.
├── backend/   # Fastify API
├── frontend/  # Next.js Web UI
├── db/        # DB 関連ファイル
└── docs/      # 要件・設計メモ
```

## セットアップ

### 1. バックエンド

```bash
cd backend
npm install
npm run dev
```

既定では `http://127.0.0.1:3002` で起動します。

### 2. フロントエンド

別ターミナルで起動します。

```bash
cd frontend
npm install
npm run dev
```

フロントエンドは `http://127.0.0.1:3001` で起動します。

## Docker

Docker Desktop が入っていれば、`docker compose` で一式起動できます。

### 起動

```bash
docker compose up --build
```

`backend/.env.local` に `OPENROUTESERVICE_API_KEY=...` が入っていれば、そのまま使われます。  
未作成なら、以下のように作成してください。

```bash
cat <<'EOF' > backend/.env.local
OPENROUTESERVICE_API_KEY=your_api_key
EOF
```

起動されるもの:

- `frontend`
  - `http://127.0.0.1:3001`
- `backend`
  - `http://127.0.0.1:3002`
- `postgres`
  - `localhost:5432`

### 停止

```bash
docker compose down
```

DB データも消す場合:

```bash
docker compose down -v
```

### 補足

- PostgreSQL は `db/schema.sql` と `db/seed.sql` で初期化されます。
- `/setup` の経路生成には `backend/.env.local` の `OPENROUTESERVICE_API_KEY` が必要です。
- フロントエンドは Docker 内で `http://backend:3002` に proxy します。

## よく使う URL

- `http://127.0.0.1:3001/setup`
  - 現在地取得とループ経路生成
- `http://127.0.0.1:3001/walking`
  - 散歩中ナビゲーション
- `http://127.0.0.1:3001/proposal`
  - 旧おすすめ UI
- `http://127.0.0.1:3002/health`
  - バックエンドのヘルスチェック

## 環境変数

### バックエンド

`backend/.env.local` などで読み込まれます。

- `OPENROUTESERVICE_API_KEY` または `ORS_API_KEY`
  - `/setup` のループ経路生成で使用
- `PORT`
  - 既定値は `3002`
- `STORAGE_MODE`
  - `memory` または `postgres`
- `DATABASE_URL`
  - `STORAGE_MODE=postgres` のとき必須

PostgreSQL を使う例:

```bash
export STORAGE_MODE=postgres
export DATABASE_URL=postgresql://user:password@localhost:5432/pet_robot
export OPENROUTESERVICE_API_KEY=your_api_key
npm run dev
```

### フロントエンド

- `API_PROXY_TARGET`
  - 既定値は `http://127.0.0.1:3002`
  - Next.js の `/api/*` rewrite 先
- `NEXT_PUBLIC_API_BASE_URL`
  - 未設定なら同一オリジンの `/api` を使用

通常は追加設定なしで動かせます。

## API

主なエンドポイント:

- `POST /api/v1/walk-routes/loop`
- `POST /api/v1/walk-routes/suggest`
- `POST /api/v1/walk-history`
- `GET /api/v1/users/:userId/walk-history`
- `GET /api/v1/users/:userId/profile`
- `PATCH /api/v1/users/:userId/profile`

詳細は `docs/api-design.md` を参照してください。

## 補足

- `frontend/src/screens/WalkingNavigationScreen.tsx` は Expo / React Native 向けの試作画面です。
- 現在の Web 版ルーティングで使われているのは `frontend/src/app/*` 配下です。

## ドキュメント

- `docs/api-design.md`
- `docs/system-architecture.md`
- `docs/frontend-architecture.md`
- `docs/walk-route-requirements.md`
- `docs/elderly-wireframes.md`
- `docs/load-score-pseudocode.md`
