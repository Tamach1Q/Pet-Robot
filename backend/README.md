# Backend Skeleton

## 起動想定

```bash
cd backend
npm install
npm run dev
```

PostgreSQL を使う場合。

```bash
export STORAGE_MODE=postgres
export DATABASE_URL=postgresql://user:password@localhost:5432/pet_robot
export OPENROUTESERVICE_API_KEY=your_api_key
npm run dev
```

## 現在の構成

- `src/controllers`
- `src/services`
- `src/repositories`
- `src/routes`
- `src/types`
- `src/config`

## 現状の前提

- Fastify ベース
- Repository は InMemory と PostgreSQL を切り替え可能
- API は MVP の 5 本だけ作成

## 次に置き換える部分

1. PostgreSQL に初期データを投入
2. バリデーションを追加
3. Weather API 実装を追加
4. 認証認可を追加
