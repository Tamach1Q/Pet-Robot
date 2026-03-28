// @ts-ignore This screen is intended for the Expo app runtime.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// @ts-ignore This screen is intended for the Expo app runtime.
import { ActivityIndicator, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
// @ts-ignore This screen is intended for the Expo app runtime.
import MapView, { Marker, Polyline } from "react-native-maps";
// @ts-ignore This screen is intended for the Expo app runtime.
import * as Location from "expo-location";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type WalkMetrics = {
  remainingMinutes: number;
  remainingDistanceMeters: number;
};

type PermissionState = "idle" | "loading" | "granted" | "denied";

type CameraConfig = {
  center: Coordinate;
  heading: number;
  pitch: number;
  zoom: number;
};

type RemovableSubscription = {
  remove: () => void;
};

type PositionUpdate = {
  coords: {
    latitude: number;
    longitude: number;
    heading?: number | null;
  };
};

type HeadingUpdate = {
  trueHeading?: number | null;
  magHeading?: number | null;
};

type PermissionResponse = {
  status: "granted" | "denied" | "undetermined";
};

type ExpoLocationApi = {
  Accuracy: {
    BestForNavigation: number;
  };
  requestForegroundPermissionsAsync: () => Promise<PermissionResponse>;
  getCurrentPositionAsync: (options: Record<string, unknown>) => Promise<PositionUpdate>;
  watchPositionAsync: (
    options: Record<string, unknown>,
    callback: (position: PositionUpdate) => void,
  ) => Promise<RemovableSubscription>;
  watchHeadingAsync: (
    callback: (heading: HeadingUpdate) => void,
  ) => Promise<RemovableSubscription>;
};

type MapViewHandle = {
  animateCamera: (camera: CameraConfig, options?: { duration?: number }) => void;
};

const ExpoLocation = Location as ExpoLocationApi;

const HOLD_DURATION_MS = 2000;
const HOLD_TICK_MS = 50;

const FALLBACK_COORDINATE: Coordinate = {
  latitude: 35.681236,
  longitude: 139.767125,
};

const INITIAL_REGION = {
  latitude: FALLBACK_COORDINATE.latitude,
  longitude: FALLBACK_COORDINATE.longitude,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
};

const MOCK_METRICS: WalkMetrics = {
  remainingMinutes: 12,
  remainingDistanceMeters: 800,
};

function normalizeHeading(value?: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return ((value % 360) + 360) % 360;
}

function buildMockRoute(origin: Coordinate): Coordinate[] {
  return [
    origin,
    {
      latitude: origin.latitude + 0.00038,
      longitude: origin.longitude + 0.00008,
    },
    {
      latitude: origin.latitude + 0.00082,
      longitude: origin.longitude + 0.00042,
    },
    {
      latitude: origin.latitude + 0.0007,
      longitude: origin.longitude + 0.00092,
    },
    {
      latitude: origin.latitude + 0.0002,
      longitude: origin.longitude + 0.00115,
    },
    {
      latitude: origin.latitude - 0.00018,
      longitude: origin.longitude + 0.00072,
    },
    {
      latitude: origin.latitude - 0.00005,
      longitude: origin.longitude + 0.00018,
    },
  ];
}

function buildCameraConfig(center: Coordinate, heading: number): CameraConfig {
  return {
    center,
    heading,
    pitch: 52,
    zoom: 18,
  };
}

function formatDistance(meters: number): string {
  return `${meters.toLocaleString("ja-JP")}m`;
}

export default function WalkingNavigationScreen(): React.JSX.Element {
  const mapRef = useRef<MapViewHandle | null>(null);
  const routeSeededRef = useRef<boolean>(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionSubscriptionRef = useRef<RemovableSubscription | null>(null);
  const headingSubscriptionRef = useRef<RemovableSubscription | null>(null);

  const [permissionState, setPermissionState] = useState<PermissionState>("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>(
    buildMockRoute(FALLBACK_COORDINATE),
  );
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [isHoldingEndButton, setIsHoldingEndButton] = useState<boolean>(false);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState<boolean>(false);

  const activeCenter = currentLocation ?? FALLBACK_COORDINATE;

  const remainingTimeLabel = useMemo(
    () => `あと ${MOCK_METRICS.remainingMinutes} 分`,
    [],
  );
  const remainingDistanceLabel = useMemo(
    () => `残り ${formatDistance(MOCK_METRICS.remainingDistanceMeters)}`,
    [],
  );
  const holdInstructionLabel = isHoldingEndButton
    ? "そのまま押し続けてください"
    : "2秒長押しで終了します";

  const resetHoldFeedback = useCallback((resetProgress: boolean): void => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }

    setIsHoldingEndButton(false);

    if (resetProgress) {
      setHoldProgress(0);
    }
  }, []);

  const closeConfirmModal = useCallback((): void => {
    setIsConfirmModalVisible(false);
    setHoldProgress(0);
  }, []);

  const handleHoldCompleted = useCallback((): void => {
    resetHoldFeedback(false);
    setHoldProgress(1);
    console.log("散歩を終了します");
    setIsConfirmModalVisible(true);
  }, [resetHoldFeedback]);

  const startHoldToFinish = useCallback((): void => {
    if (isConfirmModalVisible) {
      return;
    }

    resetHoldFeedback(true);
    setIsHoldingEndButton(true);

    const startedAt = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setHoldProgress(Math.min(elapsed / HOLD_DURATION_MS, 1));
    }, HOLD_TICK_MS);

    holdTimerRef.current = setTimeout(() => {
      handleHoldCompleted();
    }, HOLD_DURATION_MS);
  }, [handleHoldCompleted, isConfirmModalVisible, resetHoldFeedback]);

  const cancelHoldToFinish = useCallback((): void => {
    if (!isHoldingEndButton) {
      setHoldProgress(0);
      return;
    }

    resetHoldFeedback(true);
  }, [isHoldingEndButton, resetHoldFeedback]);

  const confirmFinishWalk = useCallback((): void => {
    setIsConfirmModalVisible(false);
    setHoldProgress(0);
    console.log("散歩の終了が確定しました");
  }, []);

  useEffect(() => {
    let isMounted = true;

    const startLocationTracking = async (): Promise<void> => {
      setPermissionState("loading");
      setLocationError(null);

      try {
        const permission = await ExpoLocation.requestForegroundPermissionsAsync();

        if (!isMounted) {
          return;
        }

        if (permission.status !== "granted") {
          setPermissionState("denied");
          setLocationError("位置情報を許可すると現在地に合わせて地図が追従します。");
          return;
        }

        setPermissionState("granted");

        const initialPosition = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.BestForNavigation,
        });

        if (!isMounted) {
          return;
        }

        const initialCoordinate: Coordinate = {
          latitude: initialPosition.coords.latitude,
          longitude: initialPosition.coords.longitude,
        };

        setCurrentLocation(initialCoordinate);
        setHeading(normalizeHeading(initialPosition.coords.heading));

        if (!routeSeededRef.current) {
          setRouteCoordinates(buildMockRoute(initialCoordinate));
          routeSeededRef.current = true;
        }

        positionSubscriptionRef.current = await ExpoLocation.watchPositionAsync(
          {
            accuracy: ExpoLocation.Accuracy.BestForNavigation,
            distanceInterval: 5,
            timeInterval: 2500,
            mayShowUserSettingsDialog: true,
          },
          (position) => {
            const nextCoordinate: Coordinate = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };

            setCurrentLocation(nextCoordinate);

            const nextHeading = normalizeHeading(position.coords.heading);
            if (nextHeading > 0) {
              setHeading(nextHeading);
            }
          },
        );

        try {
          headingSubscriptionRef.current = await ExpoLocation.watchHeadingAsync((update) => {
            const nextHeading = normalizeHeading(update.trueHeading ?? update.magHeading);
            if (nextHeading > 0) {
              setHeading(nextHeading);
            }
          });
        } catch {
          setLocationError((currentError) => currentError ?? "方角センサーを取得できませんでした。");
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setPermissionState("denied");
        setLocationError("現在地を取得できませんでした。通信環境と端末設定をご確認ください。");
      }
    };

    void startLocationTracking();

    return () => {
      isMounted = false;
      resetHoldFeedback(true);
      positionSubscriptionRef.current?.remove();
      headingSubscriptionRef.current?.remove();
    };
  }, [resetHoldFeedback]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.animateCamera(buildCameraConfig(activeCenter, heading), {
      duration: 700,
    });
  }, [activeCenter, heading]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <Text style={styles.headerCaption}>おさんぽガイド</Text>
          <Text style={styles.remainingTimeText}>{remainingTimeLabel}</Text>
          <Text style={styles.remainingDistanceText}>{remainingDistanceLabel}</Text>
          <Text style={styles.headerHelperText}>
            画面は現在地にあわせて更新されます。ゆっくり歩いても大丈夫です。
          </Text>
        </View>

        <View style={styles.mapSection}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={INITIAL_REGION}
            showsCompass={false}
            showsUserLocation={false}
            showsMyLocationButton={false}
            toolbarEnabled={false}
            moveOnMarkerPress={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#0B6BFF"
              strokeWidth={8}
              lineCap="round"
              lineJoin="round"
            />
            <Marker coordinate={activeCenter} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={styles.markerHalo}>
                <View style={styles.markerCore}>
                  <View style={styles.markerDot} />
                </View>
              </View>
            </Marker>
          </MapView>

          {permissionState === "loading" ? (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="large" color="#0B6BFF" />
              <Text style={styles.mapOverlayText}>現在地を確認しています…</Text>
            </View>
          ) : null}

          {locationError ? (
            <View style={styles.mapStatusBanner}>
              <Text style={styles.mapStatusBannerText}>{locationError}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="お散歩を終わる。2秒間長押しすると終了確認が表示されます。"
            disabled={isConfirmModalVisible}
            onPressIn={startHoldToFinish}
            onPressOut={cancelHoldToFinish}
            style={({ pressed }: { pressed: boolean }) => [
              styles.endButton,
              pressed && styles.endButtonPressed,
            ]}
          >
            <View style={styles.endButtonProgressTrack}>
              <View
                style={[
                  styles.endButtonProgressFill,
                  {
                    width: `${holdProgress * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.endButtonText}>お散歩を終わる</Text>
            <Text style={styles.endButtonHint}>{holdInstructionLabel}</Text>
          </Pressable>
        </View>

        <Modal
          transparent
          animationType="fade"
          visible={isConfirmModalVisible}
          onRequestClose={closeConfirmModal}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>お疲れ様でした！</Text>
              <Text style={styles.modalMessage}>散歩を終了しますか？</Text>

              <Pressable
                accessibilityRole="button"
                onPress={closeConfirmModal}
                style={styles.modalSecondaryButton}
              >
                <Text style={styles.modalSecondaryButtonText}>もう少し歩く</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={confirmFinishWalk}
                style={styles.modalPrimaryButton}
              >
                <Text style={styles.modalPrimaryButtonText}>終了する</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerCard: {
    minHeight: 184,
    borderWidth: 1,
    borderColor: "#D9E0EA",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: "#F7FAFF",
    justifyContent: "center",
    marginBottom: 16,
  },
  headerCaption: {
    color: "#30507A",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  remainingTimeText: {
    color: "#0D1B2A",
    fontSize: 46,
    fontWeight: "800",
    lineHeight: 54,
    marginBottom: 10,
  },
  remainingDistanceText: {
    color: "#1B4D9A",
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
  },
  headerHelperText: {
    color: "#4C627A",
    fontSize: 16,
    lineHeight: 22,
    marginTop: 14,
  },
  mapSection: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D9E0EA",
    backgroundColor: "#EAF3FF",
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.84)",
  },
  mapOverlayText: {
    marginTop: 12,
    color: "#17324D",
    fontSize: 17,
    fontWeight: "700",
  },
  mapStatusBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 12,
    borderRadius: 16,
    backgroundColor: "rgba(13, 27, 42, 0.82)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  mapStatusBannerText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
  },
  markerHalo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(11, 107, 255, 0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  markerCore: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#0B6BFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  markerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  footer: {
    justifyContent: "flex-end",
  },
  endButton: {
    minHeight: 112,
    borderRadius: 24,
    backgroundColor: "#C62828",
    paddingHorizontal: 20,
    paddingVertical: 18,
    overflow: "hidden",
    justifyContent: "center",
    shadowColor: "#7D1C1C",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 4,
  },
  endButtonPressed: {
    transform: [{ scale: 0.995 }],
  },
  endButtonProgressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  endButtonProgressFill: {
    height: "100%",
    backgroundColor: "#FFD166",
  },
  endButtonText: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    textAlign: "center",
  },
  endButtonHint: {
    marginTop: 10,
    color: "#FFE4E4",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(13, 27, 42, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  modalTitle: {
    color: "#0D1B2A",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  modalMessage: {
    color: "#34495E",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 24,
  },
  modalSecondaryButton: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#C7D3E0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalSecondaryButtonText: {
    color: "#17324D",
    fontSize: 20,
    fontWeight: "700",
  },
  modalPrimaryButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#C62828",
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
});
