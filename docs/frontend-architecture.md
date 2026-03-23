# 高齢者向けフロント構成と Next.js 採用理由

## 1. 結論

高齢者向けフロントの初期実装は、`Next.js + TypeScript + App Router` が妥当。

理由は、今必要なのが派手なネイティブ機能よりも、以下だから。

- 3画面程度の MVP を早く作りたい
- バックエンド API とつなぎやすくしたい
- 将来、家族向け画面も同じフロント基盤に載せやすくしたい
- 画面遷移と状態管理を素直に構成したい

## 2. Next.js を選ぶ理由

### 2.1 実装を早く始めやすい

- 画面ルーティングが分かりやすい
- TypeScript と相性がよい
- API 呼び出しを画面ごとに整理しやすい

### 2.2 MVP に必要な画面数と相性がよい

今回の高齢者向けUIは 3画面で、複雑なネイティブ機能よりも画面設計が重要。

- 今日のお散歩提案
- いまのお散歩
- 今日の感想

この程度なら、Web ベースで十分に形にできる。

### 2.3 将来の拡張に耐えやすい

- 家族向け画面を同じプロジェクトに追加しやすい
- デザインシステムを共通化しやすい
- バックエンド API との接続コードを集約しやすい

### 2.4 今回の要件では Flutter より軽く始められる

Flutter も候補だが、現時点では以下の理由で Next.js が先。

- まずは UI と API の接続確認を優先したい
- ロボット本体との連携仕様がまだ固まっていない
- MVP の段階ではスマホ・タブレット・PCで確認できる方が便利

## 3. 今回のフロント構成方針

- App Router を使う
- 画面は `proposal`, `walking`, `feedback` の 3ルート
- API 呼び出しは `src/lib/api` に寄せる
- 画面共通UIは `src/components` に寄せる
- デザイン定数は `src/styles` と `src/lib/constants` に寄せる

## 4. ディレクトリ構成

```text
frontend/
  package.json
  tsconfig.json
  next.config.ts
  src/
    app/
      layout.tsx
      page.tsx
      globals.css
      proposal/
        page.tsx
      walking/
        page.tsx
      feedback/
        page.tsx
    components/
      layout/
        ScreenShell.tsx
      proposal/
        ProposalCard.tsx
      walking/
        WalkingStatusCard.tsx
      feedback/
        FeedbackForm.tsx
      ui/
        PrimaryButton.tsx
        SecondaryButton.tsx
        RatingSelector.tsx
    lib/
      api/
        client.ts
        walkRoutes.ts
        walkHistory.ts
        userProfile.ts
      constants/
        copy.ts
        routes.ts
    types/
      api.ts
      ui.ts
```

## 5. ルートごとの役割

### `/proposal`

- 今日の散歩提案表示
- 提案理由表示
- 行く / 短いコース / やめる

### `/walking`

- 散歩中状態表示
- 残り時間表示
- 状態ラベル表示

操作は持たせない。

### `/feedback`

- 疲労度入力
- 楽しさ入力
- 道の評価入力
- 送信

## 6. フロント実装上の重要ポイント

- 散歩中画面は操作UIではなく表示専用にする
- リード操作前提なので、画面は安心感を優先する
- 文字サイズと余白を大きく取る
- API 失敗時の文言も簡潔にする

## 7. 次の実装順

1. `frontend/` の雛形を作る
2. `/proposal` 画面を先に作る
3. API クライアントで `walk-routes/suggest` をつなぐ
4. `/feedback` で `walk-history` をつなぐ
