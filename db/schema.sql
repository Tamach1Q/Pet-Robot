CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    age_group SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_age_group_check CHECK (age_group BETWEEN 0 AND 3)
);

COMMENT ON TABLE users IS 'ユーザーの基本情報。散歩提案の詳細パラメータは user_profiles に分離する。';
COMMENT ON COLUMN users.age_group IS '0=未設定, 1=65-74歳, 2=75-84歳, 3=85歳以上';

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    preferred_walk_time_start TIME,
    preferred_walk_time_end TIME,
    mobility_support_level SMALLINT NOT NULL DEFAULT 0,
    slope_tolerance_level SMALLINT NOT NULL DEFAULT 1,
    heat_caution_level SMALLINT NOT NULL DEFAULT 2,
    rain_caution_level SMALLINT NOT NULL DEFAULT 2,
    prefers_fixed_routes BOOLEAN NOT NULL DEFAULT TRUE,
    recommended_duration_min SMALLINT NOT NULL DEFAULT 8,
    max_duration_min SMALLINT NOT NULL DEFAULT 12,
    estimated_speed_m_per_min INTEGER NOT NULL DEFAULT 50,
    fatigue_index NUMERIC(3,2) NOT NULL DEFAULT 0.20,
    rest_tendency_index NUMERIC(3,2) NOT NULL DEFAULT 0.20,
    early_stop_risk_index NUMERIC(3,2) NOT NULL DEFAULT 0.10,
    exploration_preference NUMERIC(3,2) NOT NULL DEFAULT 0.20,
    preferred_features_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_profile_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_profiles_mobility_support_level_check
        CHECK (mobility_support_level BETWEEN 0 AND 2),
    CONSTRAINT user_profiles_slope_tolerance_level_check
        CHECK (slope_tolerance_level BETWEEN 0 AND 2),
    CONSTRAINT user_profiles_heat_caution_level_check
        CHECK (heat_caution_level BETWEEN 0 AND 2),
    CONSTRAINT user_profiles_rain_caution_level_check
        CHECK (rain_caution_level BETWEEN 0 AND 2),
    CONSTRAINT user_profiles_recommended_duration_check
        CHECK (recommended_duration_min BETWEEN 5 AND 60),
    CONSTRAINT user_profiles_max_duration_check
        CHECK (max_duration_min BETWEEN recommended_duration_min AND 90),
    CONSTRAINT user_profiles_estimated_speed_check
        CHECK (estimated_speed_m_per_min BETWEEN 10 AND 150),
    CONSTRAINT user_profiles_fatigue_index_check
        CHECK (fatigue_index BETWEEN 0.00 AND 1.00),
    CONSTRAINT user_profiles_rest_tendency_index_check
        CHECK (rest_tendency_index BETWEEN 0.00 AND 1.00),
    CONSTRAINT user_profiles_early_stop_risk_index_check
        CHECK (early_stop_risk_index BETWEEN 0.00 AND 1.00),
    CONSTRAINT user_profiles_exploration_preference_check
        CHECK (exploration_preference BETWEEN 0.00 AND 1.00),
    CONSTRAINT user_profiles_walk_time_window_check
        CHECK (
            preferred_walk_time_start IS NULL
            OR preferred_walk_time_end IS NULL
            OR preferred_walk_time_start <> preferred_walk_time_end
        )
);

COMMENT ON TABLE user_profiles IS '散歩提案専用の個人設定と行動要約。';
COMMENT ON COLUMN user_profiles.mobility_support_level IS '0=補助なし, 1=軽い補助あり, 2=常に慎重運用';
COMMENT ON COLUMN user_profiles.slope_tolerance_level IS '0=坂道回避, 1=緩やかな坂のみ, 2=通常許容';
COMMENT ON COLUMN user_profiles.heat_caution_level IS '0=標準, 1=やや慎重, 2=かなり慎重';
COMMENT ON COLUMN user_profiles.rain_caution_level IS '0=標準, 1=小雨のみ許容, 2=ほぼ回避';
COMMENT ON COLUMN user_profiles.preferred_features_json IS '好みの経路特徴。例: park, shade, quiet_street, bench, familiar_route';

CREATE INDEX idx_user_profiles_preferred_walk_time
    ON user_profiles (preferred_walk_time_start, preferred_walk_time_end);

CREATE INDEX idx_user_profiles_last_profile_updated_at
    ON user_profiles (last_profile_updated_at DESC);

CREATE INDEX idx_user_profiles_preferred_features_json
    ON user_profiles
    USING GIN (preferred_features_json);

CREATE TABLE fixed_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    route_id TEXT NOT NULL,
    name TEXT NOT NULL,
    distance_m INTEGER NOT NULL,
    duration_min SMALLINT NOT NULL,
    tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    coordinates_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    polyline TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fixed_routes_user_route_unique UNIQUE (user_id, route_id),
    CONSTRAINT fixed_routes_distance_check
        CHECK (distance_m BETWEEN 0 AND 50000),
    CONSTRAINT fixed_routes_duration_check
        CHECK (duration_min BETWEEN 1 AND 300)
);

COMMENT ON TABLE fixed_routes IS 'ユーザーごとの定番散歩コース。';
COMMENT ON COLUMN fixed_routes.tags_json IS '経路特徴タグ。例: ["fixed", "shade", "quiet_street"]';
COMMENT ON COLUMN fixed_routes.coordinates_json IS '経路生成用の経由点列。例: [[35.6816, 139.7683], [35.6808, 139.7692]]';

CREATE INDEX idx_fixed_routes_user_id
    ON fixed_routes (user_id);

CREATE TABLE walk_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    route_id TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL,
    actual_duration_min SMALLINT NOT NULL,
    moving_duration_min SMALLINT,
    distance_m INTEGER NOT NULL,
    rest_count SMALLINT NOT NULL DEFAULT 0,
    rest_duration_min SMALLINT NOT NULL DEFAULT 0,
    avg_speed_m_per_min INTEGER,
    first_half_speed_m_per_min INTEGER,
    second_half_speed_m_per_min INTEGER,
    slowdown_ratio NUMERIC(3,2),
    early_stop BOOLEAN NOT NULL DEFAULT FALSE,
    early_stop_reason_code TEXT,
    returned_home_safely BOOLEAN NOT NULL DEFAULT TRUE,
    subjective_fatigue_level SMALLINT,
    subjective_enjoyment_level SMALLINT,
    route_preference_feedback SMALLINT,
    free_comment TEXT,
    weather_wbgt NUMERIC(4,1),
    weather_precipitation_mm_per_h NUMERIC(4,1),
    weather_temperature_c NUMERIC(4,1),
    weather_humidity_pct NUMERIC(5,2),
    load_score NUMERIC(3,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT walk_history_time_order_check
        CHECK (ended_at >= started_at),
    CONSTRAINT walk_history_actual_duration_check
        CHECK (actual_duration_min BETWEEN 1 AND 300),
    CONSTRAINT walk_history_moving_duration_check
        CHECK (
            moving_duration_min IS NULL
            OR moving_duration_min BETWEEN 0 AND actual_duration_min
        ),
    CONSTRAINT walk_history_distance_check
        CHECK (distance_m BETWEEN 0 AND 50000),
    CONSTRAINT walk_history_rest_count_check
        CHECK (rest_count BETWEEN 0 AND 100),
    CONSTRAINT walk_history_rest_duration_check
        CHECK (rest_duration_min BETWEEN 0 AND 300),
    CONSTRAINT walk_history_avg_speed_check
        CHECK (
            avg_speed_m_per_min IS NULL
            OR avg_speed_m_per_min BETWEEN 0 AND 200
        ),
    CONSTRAINT walk_history_first_half_speed_check
        CHECK (
            first_half_speed_m_per_min IS NULL
            OR first_half_speed_m_per_min BETWEEN 0 AND 200
        ),
    CONSTRAINT walk_history_second_half_speed_check
        CHECK (
            second_half_speed_m_per_min IS NULL
            OR second_half_speed_m_per_min BETWEEN 0 AND 200
        ),
    CONSTRAINT walk_history_slowdown_ratio_check
        CHECK (
            slowdown_ratio IS NULL
            OR slowdown_ratio BETWEEN 0.00 AND 1.00
        ),
    CONSTRAINT walk_history_subjective_fatigue_level_check
        CHECK (
            subjective_fatigue_level IS NULL
            OR subjective_fatigue_level BETWEEN 1 AND 5
        ),
    CONSTRAINT walk_history_subjective_enjoyment_level_check
        CHECK (
            subjective_enjoyment_level IS NULL
            OR subjective_enjoyment_level BETWEEN 1 AND 5
        ),
    CONSTRAINT walk_history_route_preference_feedback_check
        CHECK (
            route_preference_feedback IS NULL
            OR route_preference_feedback BETWEEN 1 AND 5
        ),
    CONSTRAINT walk_history_weather_wbgt_check
        CHECK (
            weather_wbgt IS NULL
            OR weather_wbgt BETWEEN 0.0 AND 50.0
        ),
    CONSTRAINT walk_history_weather_precipitation_check
        CHECK (
            weather_precipitation_mm_per_h IS NULL
            OR weather_precipitation_mm_per_h BETWEEN 0.0 AND 500.0
        ),
    CONSTRAINT walk_history_weather_temperature_check
        CHECK (
            weather_temperature_c IS NULL
            OR weather_temperature_c BETWEEN -30.0 AND 60.0
        ),
    CONSTRAINT walk_history_weather_humidity_check
        CHECK (
            weather_humidity_pct IS NULL
            OR weather_humidity_pct BETWEEN 0.0 AND 100.0
        ),
    CONSTRAINT walk_history_load_score_check
        CHECK (
            load_score IS NULL
            OR load_score BETWEEN 0.00 AND 1.00
        )
);

COMMENT ON TABLE walk_history IS '散歩1回ごとの実績。パーソナライズ更新の入力として使う。';
COMMENT ON COLUMN walk_history.actual_duration_min IS '休憩込みの総散歩時間。';
COMMENT ON COLUMN walk_history.moving_duration_min IS '停止時間を除いた実歩行時間。';
COMMENT ON COLUMN walk_history.slowdown_ratio IS '前半と後半の速度差から算出する失速率。';
COMMENT ON COLUMN walk_history.early_stop_reason_code IS 'fatigue, weather, safety, device, user_request など。';
COMMENT ON COLUMN walk_history.load_score IS '休憩、失速、主観疲労、中断をもとに算出した負荷スコア。';

CREATE INDEX idx_walk_history_user_started_at
    ON walk_history (user_id, started_at DESC);

CREATE INDEX idx_walk_history_route_id
    ON walk_history (route_id);

CREATE INDEX idx_walk_history_user_load_score
    ON walk_history (user_id, load_score);
