"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readPersistedWalkingRoute } from "@/lib/walkingRouteStorage";

type Coordinate = {
  lat: number;
  lng: number;
};

type TrackingState = "loading" | "ready" | "error";

type TrackingStatus = {
  state: TrackingState;
  message: string;
};

type FinishConfirmationState = {
  isOpen: boolean;
};

const HOLD_DURATION_MS = 2000;
const HOLD_TICK_MS = 50;
const FALLBACK_COORDINATE: Coordinate = {
  lat: 35.681236,
  lng: 139.767125,
};

const MOCK_REMAINING_MINUTES = 12;
const MOCK_REMAINING_DISTANCE_METERS = 800;

function buildMockRoute(origin: Coordinate): Coordinate[] {
  return [
    origin,
    {
      lat: origin.lat + 0.00038,
      lng: origin.lng + 0.00008,
    },
    {
      lat: origin.lat + 0.00082,
      lng: origin.lng + 0.00042,
    },
    {
      lat: origin.lat + 0.0007,
      lng: origin.lng + 0.00092,
    },
    {
      lat: origin.lat + 0.0002,
      lng: origin.lng + 0.00115,
    },
    {
      lat: origin.lat - 0.00018,
      lng: origin.lng + 0.00072,
    },
    {
      lat: origin.lat - 0.00005,
      lng: origin.lng + 0.00018,
    },
  ];
}

function normalizeHeading(value: number): number {
  return ((value % 360) + 360) % 360;
}

function getHeadingFromPosition(position: GeolocationPosition): number | null {
  const rawHeading = position.coords.heading;

  if (typeof rawHeading !== "number" || !Number.isFinite(rawHeading) || rawHeading < 0) {
    return null;
  }

  return normalizeHeading(rawHeading);
}

function calculateBearing(from: Coordinate, to: Coordinate): number | null {
  const latDelta = Math.abs(to.lat - from.lat);
  const lngDelta = Math.abs(to.lng - from.lng);

  if (latDelta < 0.00001 && lngDelta < 0.00001) {
    return null;
  }

  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);

  return normalizeHeading((Math.atan2(y, x) * 180) / Math.PI);
}

function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "位置情報が許可されていません。ブラウザ設定をご確認ください。";
    case error.POSITION_UNAVAILABLE:
      return "現在地を特定できませんでした。電波状況の良い場所でお試しください。";
    case error.TIMEOUT:
      return "現在地の取得がタイムアウトしました。もう一度お試しください。";
    default:
      return "現在地を取得できませんでした。";
  }
}

const DynamicWalkingNavigationMap = dynamic(
  () =>
    import("@/components/walking/WalkingNavigationMap").then(
      (module) => module.WalkingNavigationMap,
    ),
  {
    ssr: false,
    loading: () => <div className="h-full min-h-[360px] w-full animate-pulse bg-slate-100" />,
  },
);

type WalkingNavigationClientProps = {
  shouldUsePersistedSetupRoute: boolean;
};

export function WalkingNavigationClient({
  shouldUsePersistedSetupRoute,
}: WalkingNavigationClientProps) {
  const hasPersistedRouteRef = useRef(false);
  const hasMockRouteSeededFromGpsRef = useRef(false);
  const previousLocationRef = useRef<Coordinate | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [heading, setHeading] = useState(0);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[] | null>(null);
  const [routeSource, setRouteSource] = useState<"persisted" | "mock">("mock");
  const [storedRouteDurationSeconds, setStoredRouteDurationSeconds] = useState<number | null>(null);
  const [storedRouteDistanceMeters, setStoredRouteDistanceMeters] = useState<number | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>({
    state: "loading",
    message: "現在地を確認しています。ブラウザの位置情報を許可してください。",
  });
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHoldingFinishButton, setIsHoldingFinishButton] = useState(false);
  const [finishConfirmation, setFinishConfirmation] = useState<FinishConfirmationState>({
    isOpen: false,
  });

  const routeFallbackCenter = routeCoordinates?.[0] ?? FALLBACK_COORDINATE;
  const activeCenter = currentLocation ?? routeFallbackCenter;
  const remainingMinutes = storedRouteDurationSeconds !== null
    ? Math.max(1, Math.round(storedRouteDurationSeconds / 60))
    : MOCK_REMAINING_MINUTES;
  const remainingDistanceMeters = storedRouteDistanceMeters ?? MOCK_REMAINING_DISTANCE_METERS;

  const remainingDistanceLabel = useMemo(
    () => `${remainingDistanceMeters.toLocaleString("ja-JP")}m`,
    [remainingDistanceMeters],
  );

  const resetHoldState = useCallback((resetProgress: boolean) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }

    setIsHoldingFinishButton(false);

    if (resetProgress) {
      setHoldProgress(0);
    }
  }, []);

  const handleHoldCompleted = useCallback(() => {
    resetHoldState(false);
    setHoldProgress(1);
    console.log("散歩を終了します");
    setFinishConfirmation({
      isOpen: true,
    });
  }, [resetHoldState]);

  const handleFinishPointerDown = useCallback(() => {
    if (finishConfirmation.isOpen) {
      return;
    }

    resetHoldState(true);
    setIsHoldingFinishButton(true);

    const startedAt = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setHoldProgress(Math.min(elapsed / HOLD_DURATION_MS, 1));
    }, HOLD_TICK_MS);

    holdTimerRef.current = setTimeout(() => {
      handleHoldCompleted();
    }, HOLD_DURATION_MS);
  }, [finishConfirmation.isOpen, handleHoldCompleted, resetHoldState]);

  const handleFinishPointerUp = useCallback(() => {
    resetHoldState(true);
  }, [resetHoldState]);

  const handleCloseModal = useCallback(() => {
    setFinishConfirmation({
      isOpen: false,
    });
    setHoldProgress(0);
  }, []);

  const handleConfirmFinish = useCallback(() => {
    console.log("散歩の終了が確定しました");
    setFinishConfirmation({
      isOpen: false,
    });
    setHoldProgress(0);
  }, []);

  useEffect(() => {
    if (!shouldUsePersistedSetupRoute) {
      hasPersistedRouteRef.current = false;
      setRouteCoordinates(buildMockRoute(FALLBACK_COORDINATE));
      setRouteSource("mock");
      setStoredRouteDurationSeconds(null);
      setStoredRouteDistanceMeters(null);
      return;
    }

    const persistedRoute = readPersistedWalkingRoute();

    if (persistedRoute) {
      hasPersistedRouteRef.current = true;
      setRouteCoordinates(persistedRoute.coordinates);
      setRouteSource("persisted");
      setStoredRouteDurationSeconds(persistedRoute.estimatedDurationSeconds);
      setStoredRouteDistanceMeters(Math.round(persistedRoute.totalDistanceMeters));
      setTrackingStatus((current) => ({
        ...current,
        message: "散歩前に生成した経路を読み込みました。現在地を確認しています。",
      }));
      return;
    }

    hasPersistedRouteRef.current = false;
    setRouteCoordinates(buildMockRoute(FALLBACK_COORDINATE));
    setRouteSource("mock");
    setStoredRouteDurationSeconds(null);
    setStoredRouteDistanceMeters(null);
  }, [shouldUsePersistedSetupRoute]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setTrackingStatus({
        state: "error",
        message: hasPersistedRouteRef.current
          ? "このブラウザでは位置情報を利用できません。散歩前に生成した経路を表示しています。"
          : "このブラウザでは位置情報を利用できません。モック地図を表示しています。",
      });
      return;
    }

    let isMounted = true;

    const applyPosition = (position: GeolocationPosition) => {
      if (!isMounted) {
        return;
      }

      const nextLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      const directHeading = getHeadingFromPosition(position);
      const derivedHeading =
        directHeading ?? (previousLocationRef.current
          ? calculateBearing(previousLocationRef.current, nextLocation)
          : null);

      previousLocationRef.current = nextLocation;
      setCurrentLocation(nextLocation);

      if (derivedHeading !== null) {
        setHeading(derivedHeading);
      }

      if (!hasPersistedRouteRef.current && !hasMockRouteSeededFromGpsRef.current) {
        setRouteCoordinates(buildMockRoute(nextLocation));
        setRouteSource("mock");
        hasMockRouteSeededFromGpsRef.current = true;
      }

      setTrackingStatus({
        state: "ready",
        message: hasPersistedRouteRef.current
          ? "散歩前に生成した経路に沿って現在地を表示しています。"
          : "現在地に追従しています。",
      });
    };

    const applyError = (error: GeolocationPositionError) => {
      if (!isMounted) {
        return;
      }

      setTrackingStatus({
        state: "error",
        message: hasPersistedRouteRef.current
          ? `${getGeolocationErrorMessage(error)} 散歩前に生成した経路を表示しています。`
          : `${getGeolocationErrorMessage(error)} モック地図を表示しています。`,
      });
    };

    navigator.geolocation.getCurrentPosition(applyPosition, applyError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });

    const watchId = navigator.geolocation.watchPosition(applyPosition, applyError, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 3000,
    });

    return () => {
      isMounted = false;
      navigator.geolocation.clearWatch(watchId);
      resetHoldState(true);
    };
  }, [resetHoldState]);

  return (
    <>
      <main className="min-h-screen bg-white px-4 py-4 text-slate-900 sm:px-6 sm:py-6">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[560px] flex-col rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:min-h-[calc(100vh-3rem)] sm:p-5">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-5">
            <p className="text-base font-bold tracking-[0.08em] text-slate-500">WALK NAVIGATION</p>
            <p className="mt-3 text-[3.2rem] font-black leading-none text-slate-950 sm:text-[3.8rem]">
              あと {remainingMinutes} 分
            </p>
            <p className="mt-3 text-2xl font-bold text-sky-700">残り {remainingDistanceLabel}</p>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {routeSource === "persisted"
                ? "散歩前に生成した経路を表示しています。画面は現在地に合わせて更新します。"
                : "画面は現在地に合わせて更新します。落ち着いてゆっくり進めば大丈夫です。"}
            </p>
          </div>

          <div className="relative mt-4 flex-1 overflow-hidden rounded-[28px] border border-slate-200 bg-sky-50">
            {routeCoordinates ? (
              <DynamicWalkingNavigationMap
                center={activeCenter}
                routeCoordinates={routeCoordinates}
                heading={heading}
                trackingMessage={trackingStatus.message}
                isLoading={trackingStatus.state === "loading"}
              />
            ) : (
              <div className="h-full min-h-[360px] w-full animate-pulse bg-slate-100" />
            )}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onPointerDown={handleFinishPointerDown}
              onPointerUp={handleFinishPointerUp}
              onPointerLeave={handleFinishPointerUp}
              onPointerCancel={handleFinishPointerUp}
              onContextMenu={(event) => {
                event.preventDefault();
              }}
              className="relative flex min-h-[112px] w-full flex-col items-center justify-center overflow-hidden rounded-[28px] bg-red-700 px-6 py-5 text-white shadow-[0_18px_38px_rgba(185,28,28,0.22)] transition active:scale-[0.995]"
            >
              <div className="absolute inset-x-0 top-0 h-2 bg-white/20">
                <div
                  className="h-full bg-amber-300 transition-[width]"
                  style={{
                    width: `${holdProgress * 100}%`,
                  }}
                />
              </div>
              <span className="text-[1.9rem] font-black leading-none">お散歩を終わる</span>
              <span className="mt-3 text-base font-bold text-red-100">
                {isHoldingFinishButton ? "そのまま押し続けてください" : "2秒長押しで終了します"}
              </span>
            </button>
          </div>
        </div>
      </main>

      {finishConfirmation.isOpen ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-[420px] rounded-[28px] bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <p className="text-center text-3xl font-black text-slate-950">お疲れ様でした！</p>
            <p className="mt-3 text-center text-xl font-bold text-slate-600">
              散歩を終了しますか？
            </p>

            <button
              type="button"
              onClick={handleCloseModal}
              className="mt-6 flex min-h-14 w-full items-center justify-center rounded-[20px] border border-slate-300 bg-white px-5 text-xl font-bold text-slate-800"
            >
              もう少し歩く
            </button>
            <button
              type="button"
              onClick={handleConfirmFinish}
              className="mt-3 flex min-h-14 w-full items-center justify-center rounded-[20px] bg-red-700 px-5 text-xl font-black text-white"
            >
              終了する
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
