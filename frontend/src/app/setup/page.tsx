"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { SetupLocation } from "@/components/setup/SetupMap";
import { generateLoopRoute } from "@/lib/api/walkRoutes";

const DynamicSetupMap = dynamic(
  () => import("@/components/setup/SetupMap").then((module) => module.SetupMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[360px] animate-pulse rounded-[28px] bg-[color:var(--soft)]" />
    ),
  },
);

const INITIAL_LOCATION: SetupLocation = {
  lat: 33.95,
  lng: 134.36,
};

const QUICK_DURATIONS = [15, 30, 45] as const;

type SearchState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};

type GeocodeResult = SetupLocation & {
  label: string;
};

type LoopRouteViewModel = {
  coordinates: SetupLocation[];
  totalDistanceMeters: number;
  estimatedDurationSeconds: number;
};

type GeolocationRequestOptions = {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
};

type PermissionStateValue = "granted" | "prompt" | "denied" | "unsupported" | "unknown";

type LocationDiagnostics = {
  permissionState: PermissionStateValue;
  isSecureContext: boolean;
  protocol: string;
  host: string;
  isOnline: boolean;
  lastAttemptStartedAt: string | null;
  lastSuccessfulStage: "coarse" | "precise" | null;
  lastSuccessfulAccuracyMeters: number | null;
  lastCoarseDurationMs: number | null;
  lastPreciseDurationMs: number | null;
  lastErrorStage: "coarse" | "precise" | null;
  lastErrorCode: number | null;
  lastErrorMessage: string | null;
};

function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "位置情報の利用が許可されていません。ブラウザの設定を確認してください。";
    case error.POSITION_UNAVAILABLE:
      return "現在地を特定できませんでした。電波状況の良い場所でお試しください。";
    case error.TIMEOUT:
      return "現在地の取得がタイムアウトしました。もう一度お試しください。";
    default:
      return "現在地の取得に失敗しました。";
  }
}

function getCurrentPosition(options: GeolocationRequestOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function isGeolocationPositionError(error: unknown): error is GeolocationPositionError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "number"
  );
}

async function getGeolocationPermissionState(): Promise<PermissionStateValue> {
  if (typeof navigator === "undefined" || !("permissions" in navigator)) {
    return "unsupported";
  }

  try {
    const result = await navigator.permissions.query({
      name: "geolocation",
    });

    if (
      result.state === "granted" ||
      result.state === "prompt" ||
      result.state === "denied"
    ) {
      return result.state;
    }

    return "unknown";
  } catch {
    return "unsupported";
  }
}

function clampMinutes(value: number): number {
  return Math.min(Math.max(Math.round(value), 5), 120);
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function mockGeocodeAddress(query: string): Promise<GeocodeResult> {
  const normalizedQuery = query.trim().toLowerCase();

  await sleep(700);

  if (!normalizedQuery) {
    throw new Error("query is empty");
  }

  const presetResults: Array<GeocodeResult & { keywords: string[] }> = [
    {
      label: "徳島県神山町役場 付近",
      lat: 33.9647,
      lng: 134.3509,
      keywords: ["神山", "kamiyama", "徳島", "tokushima"],
    },
    {
      label: "徳島駅 付近",
      lat: 34.0747,
      lng: 134.5549,
      keywords: ["徳島駅", "tokushima station"],
    },
    {
      label: "東京駅 付近",
      lat: 35.6812,
      lng: 139.7671,
      keywords: ["東京", "tokyo"],
    },
    {
      label: "大阪駅 付近",
      lat: 34.7025,
      lng: 135.4959,
      keywords: ["大阪", "osaka"],
    },
  ];

  const presetMatch = presetResults.find((candidate) =>
    candidate.keywords.some((keyword) => normalizedQuery.includes(keyword)),
  );

  if (presetMatch) {
    return presetMatch;
  }

  const hash = Array.from(normalizedQuery).reduce(
    (accumulator, character, index) =>
      accumulator + character.charCodeAt(0) * (index + 1),
    0,
  );
  const latOffset = ((hash % 25) - 12) * 0.0022;
  const lngOffset = ((Math.floor(hash / 25) % 25) - 12) * 0.0025;

  return {
    label: `${query.trim()} 付近`,
    lat: Number((INITIAL_LOCATION.lat + latOffset).toFixed(6)),
    lng: Number((INITIAL_LOCATION.lng + lngOffset).toFixed(6)),
  };
}

export default function SetupPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({
    status: "idle",
    message: "住所や地名を入れると、モック検索で地図が移動します。",
  });
  const [mapCenter, setMapCenter] = useState<SetupLocation>(INITIAL_LOCATION);
  const [markerPosition, setMarkerPosition] = useState<SetupLocation>(INITIAL_LOCATION);
  const [zoom, setZoom] = useState(14);
  const [walkMinutes, setWalkMinutes] = useState<number>(15);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedRoute, setGeneratedRoute] = useState<LoopRouteViewModel | null>(null);
  const [generationMessage, setGenerationMessage] = useState(
    "まだ経路は作成されていません。",
  );
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [locationState, setLocationState] = useState<SearchState>({
    status: "loading",
    message: "現在地を確認しています。位置情報の利用を許可してください。",
  });
  const [locationDiagnostics, setLocationDiagnostics] = useState<LocationDiagnostics>({
    permissionState: "unknown",
    isSecureContext: typeof window !== "undefined" ? window.isSecureContext : false,
    protocol: typeof window !== "undefined" ? window.location.protocol : "",
    host: typeof window !== "undefined" ? window.location.host : "",
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    lastAttemptStartedAt: null,
    lastSuccessfulStage: null,
    lastSuccessfulAccuracyMeters: null,
    lastCoarseDurationMs: null,
    lastPreciseDurationMs: null,
    lastErrorStage: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  });
  const hasRequestedInitialLocationRef = useRef(false);
  const hasUserAdjustedLocationRef = useRef(false);

  function clearGeneratedRoute(message = "条件が変わりました。もう一度経路を作成してください。") {
    setGeneratedRoute(null);
    setGenerationError(null);
    setGenerationMessage(message);
  }

  function requestCurrentLocation(forceApply = false) {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationState({
        status: "error",
        message: "このブラウザでは位置情報を利用できません。",
      });
      setLocationDiagnostics((current) => ({
        ...current,
        permissionState: "unsupported",
        lastErrorStage: "coarse",
        lastErrorCode: null,
        lastErrorMessage: "Geolocation API unavailable",
      }));
      return;
    }

    setLocationState({
      status: "loading",
      message: "現在地を取得しています。少しお待ちください。",
    });

    const coarseOptions: GeolocationRequestOptions = {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 5 * 60 * 1000,
    };
    const preciseOptions: GeolocationRequestOptions = {
      enableHighAccuracy: true,
      timeout: 25000,
      maximumAge: 0,
    };

    void (async () => {
      const permissionState = await getGeolocationPermissionState();
      const attemptStartedAt = new Date().toISOString();

      setLocationDiagnostics((current) => ({
        ...current,
        permissionState,
        isSecureContext: window.isSecureContext,
        protocol: window.location.protocol,
        host: window.location.host,
        isOnline: navigator.onLine,
        lastAttemptStartedAt: attemptStartedAt,
        lastErrorStage: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      }));

      try {
        const coarseStartedAt = performance.now();
        const coarsePosition = await getCurrentPosition(coarseOptions);
        const coarseDurationMs = Math.round(performance.now() - coarseStartedAt);
        const nextLocation = {
          lat: coarsePosition.coords.latitude,
          lng: coarsePosition.coords.longitude,
        };

        setLocationDiagnostics((current) => ({
          ...current,
          lastSuccessfulStage: "coarse",
          lastSuccessfulAccuracyMeters: Math.round(coarsePosition.coords.accuracy),
          lastCoarseDurationMs: coarseDurationMs,
        }));

        if (hasUserAdjustedLocationRef.current && !forceApply) {
          setLocationState({
            status: "success",
            message: "現在地は取得しました。手動で選んだ出発地点を優先しています。",
          });
          return;
        }

        hasUserAdjustedLocationRef.current = false;
        setMapCenter(nextLocation);
        setMarkerPosition(nextLocation);
        setZoom(16);
        clearGeneratedRoute("現在地を取得しました。この地点で経路を作成できます。");
        setLocationState({
          status: "success",
          message: "現在地を出発地点に設定しました。",
        });

        try {
          const preciseStartedAt = performance.now();
          const precisePosition = await getCurrentPosition(preciseOptions);
          const preciseDurationMs = Math.round(performance.now() - preciseStartedAt);
          const refinedLocation = {
            lat: precisePosition.coords.latitude,
            lng: precisePosition.coords.longitude,
          };

          setLocationDiagnostics((current) => ({
            ...current,
            lastSuccessfulStage: "precise",
            lastSuccessfulAccuracyMeters: Math.round(precisePosition.coords.accuracy),
            lastPreciseDurationMs: preciseDurationMs,
          }));

          if (hasUserAdjustedLocationRef.current && !forceApply) {
            return;
          }

          setMapCenter(refinedLocation);
          setMarkerPosition(refinedLocation);
          setZoom(Math.max(zoom, 16));
          clearGeneratedRoute("現在地をより正確に取得しました。この地点で経路を作成できます。");
          setLocationState({
            status: "success",
            message: "現在地をより正確な位置に更新しました。",
          });
        } catch (preciseError) {
          setLocationDiagnostics((current) => ({
            ...current,
            lastErrorStage: "precise",
            lastErrorCode: isGeolocationPositionError(preciseError) ? preciseError.code : null,
            lastErrorMessage: isGeolocationPositionError(preciseError)
              ? geolocationErrorMessage(preciseError)
              : "High accuracy lookup failed",
          }));
          console.warn("SetupPage.requestCurrentLocation precise lookup skipped", {
            preciseError,
          });
        }
      } catch (error) {
        console.error("SetupPage.requestCurrentLocation failed", {
          error,
        });

        if (isGeolocationPositionError(error)) {
          setLocationDiagnostics((current) => ({
            ...current,
            lastErrorStage: "coarse",
            lastErrorCode: error.code,
            lastErrorMessage: geolocationErrorMessage(error),
          }));
          setLocationState({
            status: "error",
            message: geolocationErrorMessage(error),
          });
          return;
        }

        const nextLocation = {
          lat: INITIAL_LOCATION.lat,
          lng: INITIAL_LOCATION.lng,
        };
        setMapCenter(nextLocation);
        setMarkerPosition(nextLocation);
        setLocationDiagnostics((current) => ({
          ...current,
          lastErrorStage: "coarse",
          lastErrorCode: null,
          lastErrorMessage: "Unknown geolocation failure",
        }));
        setLocationState({
          status: "error",
          message: "現在地を取得できなかったため、初期地点を表示しています。",
        });
      }
    })();
  }

  useEffect(() => {
    if (hasRequestedInitialLocationRef.current) {
      return;
    }

    hasRequestedInitialLocationRef.current = true;
    requestCurrentLocation();
  }, []);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!searchQuery.trim()) {
      setSearchState({
        status: "error",
        message: "住所または地名を入力してください。",
      });
      return;
    }

    setSearchState({
      status: "loading",
      message: "地図を移動しています。",
    });

    try {
      const result = await mockGeocodeAddress(searchQuery);
      hasUserAdjustedLocationRef.current = true;
      setMapCenter(result);
      setMarkerPosition(result);
      setZoom(15);
      clearGeneratedRoute("出発地点が変わりました。新しい条件で経路を作成できます。");
      setSearchState({
        status: "success",
        message: `${result.label} に移動しました。`,
      });
    } catch (error) {
      console.error("SetupPage.handleSearch failed", {
        searchQuery,
        error,
      });
      setSearchState({
        status: "error",
        message: "検索に失敗しました。入力内容を見直してください。",
      });
    }
  }

  function handleDurationInput(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = Number(event.target.value);

    if (!Number.isFinite(nextValue)) {
      return;
    }

    setWalkMinutes(clampMinutes(nextValue));
    clearGeneratedRoute();
  }

  function handleMarkerMove(nextPosition: SetupLocation) {
    hasUserAdjustedLocationRef.current = true;
    setMarkerPosition(nextPosition);
    clearGeneratedRoute("出発地点を動かしました。もう一度経路を作成してください。");
  }

  async function handleGenerateRoute() {
    setIsSubmitting(true);
    setGenerationError(null);
    setGenerationMessage("経路を作成しています。少しお待ちください。");

    try {
      const payload = {
        currentLocation: {
          lat: Number(markerPosition.lat.toFixed(6)),
          lng: Number(markerPosition.lng.toFixed(6)),
        },
        desiredWalkMinutes: walkMinutes,
      };

      console.log("散歩条件", payload);
      const response = await generateLoopRoute(payload);
      const coordinates = response.route.coordinates.map(([lng, lat]) => ({
        lat,
        lng,
      }));

      setGeneratedRoute({
        coordinates,
        totalDistanceMeters: response.route.totalDistanceMeters,
        estimatedDurationSeconds: response.route.estimatedDurationSeconds,
      });
      setGenerationMessage("ループ経路を作成しました。地図と結果を確認できます。");
    } catch (error) {
      console.error("SetupPage.handleGenerateRoute failed", {
        markerPosition,
        walkMinutes,
        error,
      });
      setGeneratedRoute(null);
      setGenerationError(
        error instanceof Error
          ? error.message
          : "経路生成に失敗しました。バックエンドの起動状態を確認してください。",
      );
      setGenerationMessage("経路を作成できませんでした。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 text-[color:var(--ink)] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)]/95 px-6 py-7 shadow-[0_24px_60px_rgba(90,60,32,0.08)]">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.22em] text-[color:var(--accent-strong)]">
            WALK SETUP
          </p>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">
            散歩条件を決める
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-8 text-[color:var(--muted)] sm:text-lg">
            出発場所と散歩時間を見やすく設定できます。大きなピンを動かして、安心して出発地点を決めてください。
          </p>
        </header>

        <div className="space-y-6">
          <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 py-5 shadow-[0_24px_60px_rgba(90,60,32,0.08)] sm:px-6 sm:py-6">
            <div className="mb-5 flex flex-col gap-2">
              <h2 className="text-2xl font-black sm:text-[2rem]">1. 出発地点の設定</h2>
              <p className="text-base leading-7 text-[color:var(--muted)] sm:text-lg">
                住所検索で地図を移動できます。ピンのドラッグでも出発位置を細かく調整できます。
              </p>
            </div>

            <div
              className={`mb-5 flex flex-col gap-3 rounded-[24px] px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
                locationState.status === "error"
                  ? "bg-rose-50 text-rose-700"
                  : locationState.status === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-[color:var(--surface-strong)] text-[color:var(--muted)]"
              }`}
            >
              <div>
                <p className="text-sm font-black tracking-[0.08em]">GPS 連携</p>
                <p className="mt-1 text-base font-semibold sm:text-lg">
                  {locationState.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => requestCurrentLocation(true)}
                disabled={locationState.status === "loading"}
                className="inline-flex h-14 items-center justify-center rounded-[20px] border-2 border-current px-5 text-lg font-black transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {locationState.status === "loading" ? "取得中..." : "現在地を再取得"}
              </button>
            </div>

            <div className="mb-5 rounded-[24px] bg-[color:var(--surface-strong)] px-4 py-4 text-sm text-[color:var(--muted)] sm:text-base">
              <p className="font-black text-[color:var(--ink)]">位置情報の診断</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <p>権限状態: {locationDiagnostics.permissionState}</p>
                <p>Secure Context: {locationDiagnostics.isSecureContext ? "yes" : "no"}</p>
                <p>URL: {locationDiagnostics.protocol}//{locationDiagnostics.host}</p>
                <p>ネット接続: {locationDiagnostics.isOnline ? "online" : "offline"}</p>
                <p>最終試行: {locationDiagnostics.lastAttemptStartedAt ?? "未実行"}</p>
                <p>成功段階: {locationDiagnostics.lastSuccessfulStage ?? "なし"}</p>
                <p>
                  成功精度: {locationDiagnostics.lastSuccessfulAccuracyMeters !== null
                    ? `${locationDiagnostics.lastSuccessfulAccuracyMeters}m`
                    : "不明"}
                </p>
                <p>
                  粗い取得時間: {locationDiagnostics.lastCoarseDurationMs !== null
                    ? `${locationDiagnostics.lastCoarseDurationMs}ms`
                    : "未取得"}
                </p>
                <p>
                  高精度取得時間: {locationDiagnostics.lastPreciseDurationMs !== null
                    ? `${locationDiagnostics.lastPreciseDurationMs}ms`
                    : "未取得"}
                </p>
                <p>失敗段階: {locationDiagnostics.lastErrorStage ?? "なし"}</p>
                <p>失敗コード: {locationDiagnostics.lastErrorCode ?? "なし"}</p>
                <p className="sm:col-span-2">
                  失敗詳細: {locationDiagnostics.lastErrorMessage ?? "なし"}
                </p>
              </div>
            </div>

            <form className="mb-5 flex flex-col gap-3 lg:flex-row" onSubmit={handleSearch}>
              <label className="sr-only" htmlFor="address-search">
                住所検索
              </label>
              <input
                id="address-search"
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="例: 徳島県神山町、東京駅"
                className="h-16 flex-1 rounded-[22px] border-2 border-[color:var(--line)] bg-white px-5 text-lg font-semibold outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(204,107,44,0.15)]"
              />
              <button
                type="submit"
                disabled={searchState.status === "loading"}
                className="inline-flex h-16 items-center justify-center rounded-[22px] bg-[color:var(--accent)] px-8 text-xl font-black text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {searchState.status === "loading" ? "検索中..." : "地図を移動する"}
              </button>
            </form>

            <div
              className={`mb-5 rounded-[20px] px-4 py-3 text-base font-semibold sm:text-lg ${
                searchState.status === "error"
                  ? "bg-rose-50 text-rose-700"
                  : searchState.status === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-[color:var(--surface-strong)] text-[color:var(--muted)]"
              }`}
            >
              {searchState.message}
            </div>

            <div className="mb-5 h-[360px] overflow-hidden rounded-[28px] border border-[color:var(--line)] bg-[color:var(--soft)] sm:h-[440px]">
              <DynamicSetupMap
                center={mapCenter}
                markerPosition={markerPosition}
                zoom={zoom}
                routeCoordinates={generatedRoute?.coordinates}
                onMarkerMove={handleMarkerMove}
                onZoomChange={setZoom}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] bg-[color:var(--surface-strong)] px-4 py-4">
                <p className="text-sm font-bold text-[color:var(--muted)]">緯度</p>
                <p className="mt-2 text-2xl font-black">
                  {markerPosition.lat.toFixed(6)}
                </p>
              </div>
              <div className="rounded-[22px] bg-[color:var(--surface-strong)] px-4 py-4">
                <p className="text-sm font-bold text-[color:var(--muted)]">経度</p>
                <p className="mt-2 text-2xl font-black">
                  {markerPosition.lng.toFixed(6)}
                </p>
              </div>
              <div className="rounded-[22px] bg-[color:var(--surface-strong)] px-4 py-4">
                <p className="text-sm font-bold text-[color:var(--muted)]">地図の拡大</p>
                <p className="mt-2 text-2xl font-black">Zoom {zoom}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 py-5 shadow-[0_24px_60px_rgba(90,60,32,0.08)] sm:px-6 sm:py-6">
            <div className="mb-5 flex flex-col gap-2">
              <h2 className="text-2xl font-black sm:text-[2rem]">2. 散歩時間の設定</h2>
              <p className="text-base leading-7 text-[color:var(--muted)] sm:text-lg">
                おすすめ時間をタップするか、下の入力欄とスライダーで細かく調整してください。
              </p>
            </div>

            <div className="mb-6 flex flex-wrap gap-3">
              {QUICK_DURATIONS.map((duration) => {
                const isActive = walkMinutes === duration;

                return (
                  <button
                    key={duration}
                    type="button"
                    onClick={() => {
                      setWalkMinutes(duration);
                      clearGeneratedRoute();
                    }}
                    className={`min-w-[110px] rounded-full border-2 px-6 py-4 text-xl font-black transition ${
                      isActive
                        ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white shadow-[0_12px_28px_rgba(159,77,24,0.22)]"
                        : "border-[color:var(--line)] bg-white text-[color:var(--ink)] hover:border-[color:var(--accent)]"
                    }`}
                  >
                    {duration}分
                  </button>
                );
              })}
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[24px] bg-[color:var(--surface-strong)] px-5 py-5">
                <label className="mb-3 block text-lg font-bold" htmlFor="walk-time-range">
                  スライダーで調整
                </label>
                <input
                  id="walk-time-range"
                  type="range"
                  min={5}
                  max={120}
                  step={5}
                  value={walkMinutes}
                  onChange={handleDurationInput}
                  className="h-4 w-full accent-[var(--accent)]"
                />
                <div className="mt-4 flex justify-between text-sm font-bold text-[color:var(--muted)] sm:text-base">
                  <span>5分</span>
                  <span>60分</span>
                  <span>120分</span>
                </div>
              </div>

              <div className="rounded-[24px] bg-[color:var(--surface-strong)] px-5 py-5">
                <label className="mb-3 block text-lg font-bold" htmlFor="walk-time-number">
                  数字で入力
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="walk-time-number"
                    type="number"
                    min={5}
                    max={120}
                    step={5}
                    value={walkMinutes}
                    onChange={handleDurationInput}
                    className="h-16 w-full rounded-[20px] border-2 border-[color:var(--line)] bg-white px-4 text-3xl font-black outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(204,107,44,0.15)]"
                  />
                  <span className="text-2xl font-black">分</span>
                </div>
                <p className="mt-4 text-base font-semibold text-[color:var(--muted)]">
                  いまの設定: <span className="text-[color:var(--accent-strong)]">{walkMinutes}分</span>
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 py-5 shadow-[0_24px_60px_rgba(90,60,32,0.08)] sm:px-6 sm:py-6">
            <div className="mb-5 flex flex-col gap-2">
              <h2 className="text-2xl font-black sm:text-[2rem]">3. 経路生成</h2>
              <p className="text-base leading-7 text-[color:var(--muted)] sm:text-lg">
                いま選んだ出発地点と散歩時間で、経路生成処理を開始します。
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                void handleGenerateRoute();
              }}
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-3 rounded-[24px] bg-[color:var(--accent)] px-6 py-5 text-2xl font-black text-white shadow-[0_18px_36px_rgba(159,77,24,0.28)] transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block h-7 w-7 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                  作成中です...
                </>
              ) : (
                "この条件で経路を作成する"
              )}
            </button>

            <div
              className={`mt-5 rounded-[22px] px-4 py-4 text-base font-semibold sm:text-lg ${
                generationError
                  ? "bg-rose-50 text-rose-700"
                  : generatedRoute
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-[color:var(--surface-strong)] text-[color:var(--muted)]"
              }`}
            >
              {generationError ?? generationMessage}
            </div>

            {generatedRoute ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] bg-[color:var(--surface-strong)] px-4 py-4">
                  <p className="text-sm font-bold text-[color:var(--muted)]">総距離</p>
                  <p className="mt-2 text-2xl font-black">
                    {(generatedRoute.totalDistanceMeters / 1000).toFixed(2)} km
                  </p>
                </div>
                <div className="rounded-[22px] bg-[color:var(--surface-strong)] px-4 py-4">
                  <p className="text-sm font-bold text-[color:var(--muted)]">推定時間</p>
                  <p className="mt-2 text-2xl font-black">
                    {Math.round(generatedRoute.estimatedDurationSeconds / 60)} 分
                  </p>
                </div>
                <div className="rounded-[22px] bg-[color:var(--surface-strong)] px-4 py-4">
                  <p className="text-sm font-bold text-[color:var(--muted)]">経路点数</p>
                  <p className="mt-2 text-2xl font-black">
                    {generatedRoute.coordinates.length} 点
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
