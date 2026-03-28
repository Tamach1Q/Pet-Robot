# Frontend Skeleton

## 方針

- Next.js App Router
- 高齢者向け 3画面のみ
- 散歩中画面は表示専用
- リード操作前提

## 起動

```bash
cd frontend
npm install
npm run dev
```

フロントは `3001` 番ポートで起動する。
バックエンドは `3002` 番ポート想定。

```bash
API_PROXY_TARGET=http://127.0.0.1:3002
```

`NEXT_PUBLIC_API_BASE_URL` を設定しない場合、フロントは同一オリジンの `/api` に投げて
Next.js の rewrite 経由でバックエンドへ接続する。

## 画面

- `/proposal`
- `/walking`
- `/feedback`

## 次にやること

1. API クライアントと画面を実データ接続
2. フィードバック送信の状態管理
3. バックエンドURLを環境変数化
