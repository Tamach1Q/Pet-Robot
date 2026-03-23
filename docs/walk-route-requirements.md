# お散歩経路決定ロジック 要件定義ドラフト

## 1. 目的

高齢者向けペットロボットが、利用者の体調負荷と安全性を優先しながら、その日の天候や過去の散歩履歴を踏まえて「今日のお散歩経路」を提案する。

## 2. 基本コンセプト

- ロボットは犬らしさを持つが、経路判断は常に安全優先とする
- 利用者が迷わず選べるよう、毎回 1 つの最適案と 1 つの代替案を返す
- 「今日は短めにしよう」「日陰の多い道にしよう」といった説明可能な提案にする
- 通信障害や外部 API 障害時でも、最低限のオフライン提案を継続できるようにする

## 3. 想定ユースケース

### 主ユースケース

1. 朝、ロボットがクラウドに天気情報を問い合わせる
2. 過去の散歩履歴と利用者の最近の負荷状況を参照する
3. 候補経路を複数生成する
4. 安全制約で除外し、残った候補をスコアリングする
5. 最適経路を 1 件、代替経路を 1 件提案する

### 例

- 気温が高く湿度も高い日は、距離を短縮し、日陰率の高いルートを優先する
- 直近 3 日で長距離散歩が続いている場合、今日は短距離か休憩多めの経路を提案する
- 雨天時は屋根のある区間、公園回避、滑りやすい坂道回避を優先する

## 4. システム境界

### ロボット側

- 現在位置取得
- 利用者への提案表示・音声案内
- 散歩開始、休憩、終了などのイベント送信
- オフライン時の簡易提案

### クラウド側

- 天気、気温、湿度、降水確率などの外部情報取得
- 過去散歩履歴の蓄積
- 候補経路生成
- 経路評価と提案結果生成

## 5. 入力データ

### 必須入力

- 現在地
- 現在日時
- 当日天気
- 気温
- 湿度
- 降水確率
- 過去の散歩履歴

### 推奨入力

- 利用者の通常歩行速度
- 最近の歩行負荷
- 転倒リスクに関する設定
- 好みの散歩時間帯
- 好みの経路タイプ
- 坂道の許容度
- 休憩ポイントの位置
- 日陰の多さ
- 交通量の多さ

### 将来拡張入力

- 見守り機能から得られる体調シグナル
- ペットらしい感情推定結果
- 混雑情報
- 花や景色など満足度に関する環境特徴

## 6. 出力

### 提案レスポンス

- 推奨経路 ID
- 経路の GeoJSON もしくはポリライン
- 予想所要時間
- 推定歩数
- 想定負荷レベル
- 提案理由
- 代替経路
- 注意事項

### 提案理由の例

- 「今日は湿度が高いため、距離を 20% 短くした経路を提案します」
- 「直近の散歩が長めだったため、休憩ポイントの多いルートを優先しました」

## 7. 経路決定ロジック

### 7.1 全体フロー

1. 現在地を中心に候補経路を複数作る
2. 天候や安全条件で通行不可または非推奨区間を除外する
3. 各候補に対してスコアを計算する
4. 最上位を推奨経路、次点を代替経路として返す

### 7.2 候補経路生成

候補経路は以下のようなテンプレートで生成すると実装しやすい。

- 短距離周回コース
- 標準距離周回コース
- 気分転換コース
- 日陰優先コース
- 雨天対応コース

地図 API から道路ネットワークを取得し、出発点に戻る周回型を優先すると、高齢者向けとして扱いやすい。

### 7.3 ハード制約

以下に該当する候補はスコアリング前に除外する。

- 最大距離を超える
- 最大所要時間を超える
- 急坂区間が許容を超える
- 雨天時に滑りやすい区間を含む
- 夜間に照明不足区間を含む
- 気温や暑さ指数が危険閾値を超える

### 7.4 スコアリング

各候補経路に対して総合スコアを計算する。

```text
route_score
= safety_score * 0.40
+ comfort_score * 0.25
+ habit_score * 0.15
+ preference_score * 0.10
+ variety_score * 0.10
```

#### safety_score

- 交通量が少ない
- 横断回数が少ない
- 坂道が緩やか
- 夜間照明がある
- 雨天時に危険区間が少ない

#### comfort_score

- 気温、湿度に対して適切な距離
- 日陰が多い
- 休憩ポイントがある
- 路面状態が安定している

#### habit_score

- 最近の平均距離に近い
- 利用者の普段の歩行時間帯に合う
- 負荷が急に上がりすぎない

#### preference_score

- 公園が好き
- 住宅街を好む
- 静かな道を好む

#### variety_score

- 同じ道ばかりにならない
- ただし変化を付けすぎず、安心感を維持する

### 7.5 天候による動的補正

- 高温高湿: 距離上限を下げる、日陰重みを上げる
- 雨天: 安全性重みを上げる、屋外公園の優先度を下げる
- 寒冷時: 日当たりや短時間コースを優先する
- 強風時: 開けた道や橋を避ける

### 7.6 初期提案時間とパーソナライズ

最初から距離ベースで固定せず、まずは時間ベースで始める。

- 初回提案は 5 分から 10 分の短時間コースを優先する
- 初期フェーズでは「推奨歩行時間」と「最大許容時間」を分けて管理する
- 推奨歩行時間を超えても、最大許容時間以内なら即異常扱いしない
- 定番コースは必ず短時間で戻れる周回型または折り返し型にする

初期設定の例。

- 推奨歩行時間: 8 分
- 最大許容時間: 12 分
- 自宅または拠点から 3 分以内で引き返せる構造を優先

初期の個人差吸収は、距離よりも以下の観測値で行う。

- 休憩回数
- 休憩合計時間
- 速度低下率
- 途中中断の有無
- 帰路での失速
- 散歩後の主観疲労

パーソナライズの更新ルール例。

- 直近 3 回で休憩なし、主観疲労が低く、中断なしなら提案時間を 2 分増やす
- 直近 2 回で長い休憩または途中中断があれば提案時間を 2 分減らす
- 暑熱、雨天、体調不良シグナルがある日は通常より 20% から 40% 短縮する
- 連続して負荷が高い場合は、翌日は回復優先の短時間コースに固定する

この方式なら、安全側に倒しながら会話や行動ログで徐々に個人最適化できる。

### 7.7 定番コース登録型を基本にした候補生成

高齢者向けでは安心感と再現性が重要なため、候補経路は「その場生成のみ」にせず、定番コース登録型を基本にする。

- 基本は定番コースから提案する
- 条件が悪い日は定番コースの短縮版を返す
- 変化を付けたい日だけ類似コースを候補に混ぜる
- その場生成は、新規開拓ではなく定番コースが使えない場合の補助手段にする

候補プールの考え方。

- 定番短距離コース
- 定番標準コース
- 雨天代替コース
- 暑熱時短縮コース
- 気分転換用の変化コース

## 8. 散歩履歴の使い方

### 保存したい履歴

- 実施日時
- 実際の経路
- 実歩行時間
- 実距離
- 休憩回数
- 中断有無
- 利用者の主観フィードバック
- ロボット観測の負荷指標

### パーソナライズ更新に必要な入力

パーソナライズ更新は、散歩 1 回ごとの実績データを入力にして行う。

#### 自動取得する入力

- started_at
- ended_at
- actual_duration_min
- moving_duration_min
- distance_m
- route_id
- rest_count
- rest_duration_min
- avg_speed_m_per_min
- first_half_speed_m_per_min
- second_half_speed_m_per_min
- slowdown_ratio
- early_stop
- early_stop_reason_code
- returned_home_safely
- weather_wbgt
- weather_precipitation_mm_per_h
- weather_temperature_c
- weather_humidity_pct

#### 利用者または会話から取得する入力

- subjective_fatigue_level
- subjective_enjoyment_level
- route_preference_feedback
- free_comment

#### ロジック上の派生値

以下は保存してもよいが、更新時に都度計算してもよい。

- rest_ratio = rest_duration_min / actual_duration_min
- slowdown_ratio = max(0, 1 - second_half_speed / first_half_speed)
- subjective_fatigue_normalized = subjective_fatigue_level / 5
- load_score

#### 入力項目の役割

| 項目 | 主用途 |
|---|---|
| actual_duration_min | 実際に歩けた時間の把握 |
| moving_duration_min | 休憩込みではない実歩行量の把握 |
| rest_count, rest_duration_min | 休憩しやすさの更新 |
| first_half_speed_m_per_min, second_half_speed_m_per_min | 後半失速の検出 |
| early_stop, early_stop_reason_code | 中断リスクの更新 |
| subjective_fatigue_level | 疲労指数の更新 |
| subjective_enjoyment_level, route_preference_feedback | 嗜好学習 |
| weather_* | 天候要因と本人要因の切り分け |

#### 初期リリースで最低限必要な入力

MVP で最低限必要なのは以下。

- started_at
- ended_at
- actual_duration_min
- distance_m
- rest_count
- rest_duration_min
- first_half_speed_m_per_min
- second_half_speed_m_per_min
- early_stop
- subjective_fatigue_level
- route_id
- weather_wbgt
- weather_precipitation_mm_per_h

### 履歴活用ロジック

- 直近 7 日の平均距離をベースラインにする
- 長距離が連続している場合は抑制する
- 同じ経路が続きすぎたら適度に変化を付ける
- 中断率の高い経路は優先度を下げる
- 好評価の経路特徴を学習する

## 9. 推奨アーキテクチャ

## 9.1 初期 MVP

- ロボットアプリ
- API サーバ
- DB
- 天気 API
- 地図 API

```text
Robot App
  -> Route Planning API
      -> Weather Provider
      -> Map / Routing Provider
      -> Walk History DB
      -> Route Scoring Engine
```

### ロボットアプリの責務

- 位置送信
- 提案結果の受信と表示
- 散歩実績のアップロード

### API サーバの責務

- 提案要求受付
- 外部データ取得
- 候補経路生成
- スコア計算
- 推奨経路返却

### DB の責務

- ユーザープロファイル
- 散歩履歴
- 経路特徴量キャッシュ

## 10. API 例

### 提案取得

`POST /api/v1/walk-routes/suggest`

```json
{
  "userId": "user-001",
  "robotId": "robot-001",
  "currentLocation": {
    "lat": 35.0001,
    "lng": 139.0001
  },
  "requestedAt": "2026-03-23T08:00:00+09:00"
}
```

```json
{
  "recommendedRoute": {
    "routeId": "route-123",
    "durationMin": 18,
    "distanceM": 1200,
    "reason": "湿度が高いため短めで日陰の多い経路を提案",
    "riskLevel": "low"
  },
  "alternativeRoute": {
    "routeId": "route-124",
    "durationMin": 12,
    "distanceM": 800,
    "reason": "さらに短時間で戻れる代替案",
    "riskLevel": "low"
  }
}
```

### 散歩実績登録

`POST /api/v1/walk-history`

## 11. データモデル案

### users

- id
- age_group
- walking_speed_m_per_min
- preferred_distance_m
- max_distance_m
- max_duration_min
- slope_tolerance
- heat_tolerance
- rain_tolerance

### user_profile の考え方

ユーザープロファイルとは、散歩提案をその人向けに調整するための個人設定と行動要約のこと。

初期設定と、運用で更新される値を分けて考える。

#### 初期設定として持つもの

- 年齢帯
- 歩行補助具の有無
- 散歩したい時間帯
- 雨の日の許容度
- 暑さ寒さの慎重度
- 坂道の許容度
- 定番コースを好む度合い

#### 散歩ログから更新するもの

- 推奨歩行時間
- 最大許容時間
- 推定歩行速度
- 疲労回復のしやすさ
- 休憩しやすさ
- 中断しやすさ
- 好きなコース特徴

このプロファイルは「診断結果」ではなく、散歩提案のための安全パラメータとして扱う。

### user_profiles

`users` と分けて、散歩提案専用のパラメータを持つテーブルとして定義する。

#### 確定項目

- id
- user_id
- preferred_walk_time_start
- preferred_walk_time_end
- mobility_support_level
- slope_tolerance_level
- heat_caution_level
- rain_caution_level
- prefers_fixed_routes
- recommended_duration_min
- max_duration_min
- estimated_speed_m_per_min
- fatigue_index
- rest_tendency_index
- early_stop_risk_index
- exploration_preference
- preferred_features_json
- last_profile_updated_at
- created_at
- updated_at

#### 項目定義

| 項目名 | 型 | 必須 | 初期値例 | 更新方法 | 用途 |
|---|---|---|---|---|---|
| id | UUID | 必須 | 自動採番 | 固定 | プロファイル ID |
| user_id | UUID | 必須 | users.id | 固定 | ユーザーとの紐付け |
| preferred_walk_time_start | TIME | 任意 | 07:00 | 手動設定 | 好みの散歩開始時間帯 |
| preferred_walk_time_end | TIME | 任意 | 10:00 | 手動設定 | 好みの散歩終了時間帯 |
| mobility_support_level | SMALLINT | 必須 | 0 | 手動設定 | 歩行補助の有無や慎重度 |
| slope_tolerance_level | SMALLINT | 必須 | 1 | 手動設定 + 見直し | 坂道許容度 |
| heat_caution_level | SMALLINT | 必須 | 2 | 手動設定 | 暑さに対する慎重度 |
| rain_caution_level | SMALLINT | 必須 | 2 | 手動設定 | 雨に対する慎重度 |
| prefers_fixed_routes | BOOLEAN | 必須 | true | 手動設定 | 定番コース優先かどうか |
| recommended_duration_min | SMALLINT | 必須 | 8 | 自動更新 | 次回提案の基準時間 |
| max_duration_min | SMALLINT | 必須 | 12 | 自動更新 | 許容上限時間 |
| estimated_speed_m_per_min | INTEGER | 必須 | 50 | 自動更新 | 距離見積り用の歩行速度 |
| fatigue_index | DECIMAL(3,2) | 必須 | 0.20 | 自動更新 | 短期的な疲れやすさ |
| rest_tendency_index | DECIMAL(3,2) | 必須 | 0.20 | 自動更新 | 休憩の出やすさ |
| early_stop_risk_index | DECIMAL(3,2) | 必須 | 0.10 | 自動更新 | 途中中断の起こりやすさ |
| exploration_preference | DECIMAL(3,2) | 必須 | 0.20 | 自動更新 + 手動補正 | 新しい道の受容度 |
| preferred_features_json | JSONB | 任意 | `{}` | 自動更新 | 好みのコース特徴 |
| last_profile_updated_at | TIMESTAMP | 必須 | 現在時刻 | 自動更新 | プロファイル最終更新日時 |
| created_at | TIMESTAMP | 必須 | 現在時刻 | 固定 | 作成日時 |
| updated_at | TIMESTAMP | 必須 | 現在時刻 | 自動更新 | 更新日時 |

#### レベル値の意味

- mobility_support_level: `0=補助なし`, `1=軽い補助あり`, `2=常に慎重運用`
- slope_tolerance_level: `0=坂道回避`, `1=緩やかな坂のみ`, `2=通常許容`
- heat_caution_level: `0=標準`, `1=やや慎重`, `2=かなり慎重`
- rain_caution_level: `0=標準`, `1=小雨のみ許容`, `2=ほぼ回避`

#### preferred_features_json の例

```json
{
  "park": 0.6,
  "shade": 0.8,
  "quiet_street": 0.7,
  "bench": 0.5,
  "familiar_route": 0.9
}
```

値は `0.0` から `1.0` で持ち、スコアリング時の重みに使う。

#### 初期リリースで入れない項目

以下は将来拡張に回し、初期の `user_profiles` には入れない。

- 医療情報
- 詳細な疾患情報
- 感情推定の生データ
- 家族連絡先
- 常時計測のバイタル生データ

これらは責務が重く、散歩経路提案の MVP には不要。

### walk_history

- id
- user_id
- started_at
- ended_at
- distance_m
- duration_min
- route_id
- stopped_early
- user_feedback

### walk_history の確定項目

| 項目名 | 型 | 必須 | 初期値例 | 用途 |
|---|---|---|---|---|
| id | UUID | 必須 | 自動採番 | 履歴 ID |
| user_id | UUID | 必須 | users.id | ユーザー紐付け |
| route_id | TEXT | 任意 | route-123 | 通ったコース識別子 |
| started_at | TIMESTAMP | 必須 | 現在時刻 | 散歩開始時刻 |
| ended_at | TIMESTAMP | 必須 | 現在時刻 | 散歩終了時刻 |
| actual_duration_min | SMALLINT | 必須 | 8 | 休憩込み総時間 |
| moving_duration_min | SMALLINT | 任意 | 7 | 実歩行時間 |
| distance_m | INTEGER | 必須 | 420 | 実距離 |
| rest_count | SMALLINT | 必須 | 1 | 休憩回数 |
| rest_duration_min | SMALLINT | 必須 | 1 | 休憩合計時間 |
| avg_speed_m_per_min | INTEGER | 任意 | 52 | 平均速度 |
| first_half_speed_m_per_min | INTEGER | 任意 | 54 | 前半速度 |
| second_half_speed_m_per_min | INTEGER | 任意 | 48 | 後半速度 |
| slowdown_ratio | NUMERIC(3,2) | 任意 | 0.11 | 後半速度低下率 |
| early_stop | BOOLEAN | 必須 | false | 中断有無 |
| early_stop_reason_code | TEXT | 任意 | fatigue | 中断理由 |
| returned_home_safely | BOOLEAN | 必須 | true | 安全帰宅確認 |
| subjective_fatigue_level | SMALLINT | 任意 | 2 | 主観疲労 1-5 |
| subjective_enjoyment_level | SMALLINT | 任意 | 4 | 満足度 1-5 |
| route_preference_feedback | SMALLINT | 任意 | 4 | コース好み 1-5 |
| free_comment | TEXT | 任意 | null | 会話や自由記述 |
| weather_wbgt | NUMERIC(4,1) | 任意 | 24.5 | 当時の WBGT |
| weather_precipitation_mm_per_h | NUMERIC(4,1) | 任意 | 0.0 | 時間雨量 |
| weather_temperature_c | NUMERIC(4,1) | 任意 | 21.5 | 気温 |
| weather_humidity_pct | NUMERIC(5,2) | 任意 | 58.0 | 湿度 |
| load_score | NUMERIC(3,2) | 任意 | 0.17 | 更新時に使った負荷スコア |
| created_at | TIMESTAMP | 必須 | 現在時刻 | 作成日時 |

### route_features

- route_id
- distance_m
- elevation_gain_m
- shade_score
- crossing_count
- traffic_score
- rest_spot_count
- rain_risk_score

## 12. MVP の実装方針

### Phase 1

- 天気、気温、湿度、散歩履歴だけを使う
- 候補経路は 3 から 5 本程度
- ルールベースでスコアリングする
- 利用者ごとの閾値は固定設定から開始する

### Phase 2

- 坂道、日陰、交通量などの特徴量を追加する
- 経路特徴量を事前計算する
- ユーザー嗜好を反映する

### Phase 3

- フィードバックを使ったパーソナライズ
- 体調シグナルや見守り機能との連携
- 予測モデルによる満足度推定

## 12.1 パーソナライズ更新式のイメージ

最初は複雑な機械学習モデルではなく、毎回の散歩結果から少しずつ値を更新する。

### 目的

- 今日の提案時間を長くしてよいか
- 今日は短くすべきか
- どの種類のコースを好むか

を安全側に判定すること。

### まず管理する主要パラメータ

- recommended_duration_min
- max_duration_min
- estimated_speed_m_per_min
- fatigue_index
- route_preference_score

### 1. 推奨歩行時間の更新

散歩 1 回ごとに「今回の負荷スコア」を計算し、その結果で次回提案時間を更新する。

```text
load_score
= rest_ratio * 0.35
+ slowdown_ratio * 0.25
+ subjective_fatigue * 0.25
+ early_stop_flag * 0.15
```

各値の例。

- rest_ratio: 休憩時間 / 総散歩時間
- slowdown_ratio: 後半速度低下率
- subjective_fatigue: 5 段階疲労アンケートを 0.0 から 1.0 に正規化
- early_stop_flag: 途中中断ありなら 1、なければ 0

更新ルール例。

```text
if load_score <= 0.20:
  next_recommended_duration = current_duration + 2
elif load_score <= 0.45:
  next_recommended_duration = current_duration
else:
  next_recommended_duration = current_duration - 2
```

ただし安全のため、以下の制約をかける。

- 1 回で増やすのは最大 2 分
- 1 回で減らすのも最大 2 分
- 最小提案時間は 5 分
- 初期最大提案時間は 15 分程度に制限

### 2. 最大許容時間の更新

最大許容時間は推奨歩行時間より常に少し長く取る。

```text
max_duration_min = recommended_duration_min + buffer_min
```

初期の buffer_min は 3 から 4 分程度。

負荷が安定して低い状態が続いたときだけ、buffer を 1 分広げてもよい。

### 3. 推定歩行速度の更新

歩行速度は経路長の見積りに使う。

```text
estimated_speed
= 0.7 * previous_estimated_speed
+ 0.3 * current_walk_speed
```

これは直近の値に引っ張られすぎないようにするための平滑化。

### 4. 疲労指数の更新

短期的な疲れやすさを 0 から 1 の指数で持つ。

```text
fatigue_index
= 0.6 * previous_fatigue_index
+ 0.4 * load_score
```

fatigue_index が高い日は、通常提案時間に補正をかける。

```text
adjusted_duration
= recommended_duration_min * (1 - fatigue_index * 0.3)
```

例えば fatigue_index が 0.5 なら、通常より 15% 短くする。

### 5. コース嗜好の更新

コースごとに特徴量を持たせ、好まれた特徴を少しずつ上げる。

特徴量の例。

- 公園がある
- 日陰が多い
- 静かな道
- ベンチが多い
- いつもの道に近い

更新のイメージ。

```text
preference(feature)
= previous_preference(feature)
+ learning_rate * feedback_signal
```

feedback_signal の例。

- 散歩後評価が高い
- 中断しなかった
- 歩行速度低下が少ない
- 会話で「この道が好き」と反応した

### 6. 天候補正を最後にかける

個人最適化後でも、最後は必ず天候で安全補正する。

```text
final_duration
= adjusted_duration
+ weather_factor
```

例。

- WBGT 28 以上: 30% 短縮
- 1 時間雨量 1 mm 以上: 20% 短縮
- WBGT 31 以上または強い雨: 提案せず中止

### 実装イメージ

初期値。

```json
{
  "recommendedDurationMin": 8,
  "maxDurationMin": 12,
  "estimatedSpeedMPerMin": 50,
  "fatigueIndex": 0.2
}
```

ある散歩の結果。

```json
{
  "walkDurationMin": 8,
  "restDurationMin": 1,
  "slowdownRatio": 0.1,
  "subjectiveFatigue": 2,
  "earlyStop": false
}
```

このとき。

- rest_ratio = 1 / 8 = 0.125
- slowdown_ratio = 0.1
- subjective_fatigue = 2 / 5 = 0.4
- early_stop_flag = 0

なので。

```text
load_score
= 0.125 * 0.35
+ 0.1 * 0.25
+ 0.4 * 0.25
+ 0 * 0.15
= 0.16875
```

負荷は低めなので、次回提案時間は 8 分から 10 分へ増やしてよい。

### 運用上の重要点

- 増やすより減らす判断を優先する
- 1 回の散歩結果だけで大きく変えない
- 会話データは補助に使い、安全判定は行動データを優先する
- パーソナライズ結果は、利用者本人や家族に説明できる形にする

## 13. 非機能要件

- 提案応答時間は 3 秒以内を目標
- 天気 API 障害時は直近キャッシュで代替
- 地図 API 障害時は登録済み定番コースから提案
- 個人位置情報は暗号化して保存
- 提案理由をログとして残し、あとから説明可能にする

## 13.1 気象中止基準の初期案

暑さについては、気温単独ではなく WBGT を優先する。

- WBGT 31 以上: 原則中止
- WBGT 28 以上 31 未満: 短時間コースのみ、日陰優先、休憩頻度増
- WBGT 25 以上 28 未満: 通常より短めに補正
- 熱中症警戒アラート発表時: 高齢者向けモードでは原則中止寄りに倒す

寒さについては、初期実装では地域差が大きいため、気温と風を併用した簡易基準から始める。

- 体感温度が低い日、強風日、降雪時は短時間コースまたは中止
- 将来的には風速と路面凍結リスクを加味する

雨については、ハード仕様と転倒リスクを踏まえて降水量ベースで段階制御する。

- 1 時間雨量 0 以上 1 mm 未満: 許容
- 1 時間雨量 1 以上 3 mm 未満: 短時間コース、滑りやすい区間回避
- 1 時間雨量 3 mm 以上: 高齢者向け初期仕様では原則中止
- 雷注意報、大雨注意報、強風注意報など安全上の注意情報がある場合は中止寄りに倒す

初期は保守的に設定し、実機の防水等級や転倒データが集まってから緩和を検討する。

## 14. 実装上の重要判断

最初から機械学習に寄せすぎず、まずはルールベースで始めるのが妥当。

理由は以下。

- 高齢者向けでは説明可能性が重要
- 初期データが少ない
- 安全制約を明示的に扱いやすい
- 実運用で閾値調整しやすい

## 15. 次に決めるべき項目

- 1 回の散歩の最大距離と最大時間
- 暑さ、寒さ、雨に対する中止基準
- 候補経路をその場生成するか、定番コースを事前登録するか
- 提案を 1 件だけ出すか、複数案を出すか
- 利用者ごとの設定をどこまで持つか
- ロボット単体でどこまで判断し、どこからクラウドに寄せるか

## 16. 最初の結論

最初の実装は、以下の形が最も現実的。

- クラウドで天気 API と散歩履歴を参照
- 定番コース登録型を基本にし、必要時のみ地図 API から追加候補を生成
- 安全制約で除外
- ルールベーススコアリングで最適経路を 1 件提案
- 通信障害時は定番の短距離コースを返す

この形なら、将来の感情推定や見守り機能とも自然に接続できる。

## 17. LLM 利用方針

経路決定コア自体には LLM は必須ではない。

- 天気取得、履歴参照、経路スコアリングは通常の API と業務ロジックで実装する
- Gemini API などの LLM は、会話的な提案説明、散歩後フィードバック要約、パーソナライズ補助に使う
- 安全判定そのものは、説明可能なルールベースで持つ
