"use client";

export type GPSLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

const DEFAULT_TIMEOUT = 10000;
const HIGH_ACCURACY_TIMEOUT = 15000;
const CACHE_MAX_AGE = 30000;

function ensureBrowser(): void {
  if (
    typeof window === "undefined" ||
    !("geolocation" in navigator)
  ) {
    throw new Error("Trình duyệt không hỗ trợ GPS.");
  }
}

function mapGeolocationError(
  error: GeolocationPositionError
): Error {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return new Error(
        "Bạn chưa cấp quyền truy cập vị trí cho trình duyệt."
      );

    case error.POSITION_UNAVAILABLE:
      return new Error(
        "Không thể xác định vị trí hiện tại. Hãy bật GPS/vị trí và thử lại."
      );

    case error.TIMEOUT:
      return new Error(
        "GPS chưa xác định được vị trí. Hãy thử lại ở nơi có tín hiệu tốt hơn."
      );

    default:
      return new Error(
        "Không thể lấy vị trí hiện tại."
      );
  }
}

function toGPSLocation(
  position: GeolocationPosition
): GPSLocation {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Math.round(position.coords.accuracy),
  };
}

/**
 * Lấy vị trí hiện tại.
 *
 * Ưu tiên vị trí đã được thiết bị/browser cache.
 * Nếu không có thì mới yêu cầu GPS chính xác cao.
 */
export function getCurrentLocation(): Promise<GPSLocation> {
  ensureBrowser();

  return new Promise((resolve, reject) => {
    let finished = false;
    let highAccuracyTimer:
      ReturnType<typeof setTimeout> | null = null;

    const finishResolve = (
      position: GeolocationPosition
    ) => {
      if (finished) return;

      finished = true;

      if (highAccuracyTimer) {
        clearTimeout(highAccuracyTimer);
      }

      resolve(toGPSLocation(position));
    };

    const finishReject = (error: Error) => {
      if (finished) return;

      finished = true;

      if (highAccuracyTimer) {
        clearTimeout(highAccuracyTimer);
      }

      reject(error);
    };

    /*
     * LẦN 1
     *
     * Không ép GPS độ chính xác cao.
     * Trên điện thoại cách này thường phản hồi nhanh hơn.
     */
    navigator.geolocation.getCurrentPosition(
      finishResolve,
      () => {
        if (finished) return;

        /*
         * LẦN 2
         *
         * Nếu lần đầu không lấy được vị trí,
         * mới yêu cầu high accuracy.
         */
        navigator.geolocation.getCurrentPosition(
          finishResolve,
          (error) => {
            finishReject(
              mapGeolocationError(error)
            );
          },
          {
            enableHighAccuracy: true,
            timeout: HIGH_ACCURACY_TIMEOUT,
            maximumAge: CACHE_MAX_AGE,
          }
        );

        /*
         * Chặn trường hợp trình duyệt/GPS
         * chờ quá lâu.
         */
        highAccuracyTimer = setTimeout(() => {
          finishReject(
            new Error(
              "GPS chưa xác định được vị trí. Hãy thử lại ở nơi có tín hiệu tốt hơn."
            )
          );
        }, HIGH_ACCURACY_TIMEOUT + 1000);
      },
      {
        enableHighAccuracy: false,
        timeout: DEFAULT_TIMEOUT,
        maximumAge: CACHE_MAX_AGE,
      }
    );
  });
}

/**
 * Theo dõi vị trí liên tục.
 *
 * Không ép high accuracy liên tục để:
 * - giảm timeout
 * - giảm hao pin
 * - hoạt động ổn định hơn trên mobile
 */
export function watchCurrentLocation(
  onLocation: (location: GPSLocation) => void,
  onError?: (error: Error) => void
): number {
  ensureBrowser();

  return navigator.geolocation.watchPosition(
    (position) => {
      onLocation(
        toGPSLocation(position)
      );
    },
    (error) => {
      onError?.(
        mapGeolocationError(error)
      );
    },
    {
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 10000,
    }
  );
}

/**
 * Dừng theo dõi GPS.
 */
export function stopWatchingLocation(
  watchId: number
): void {
  if (
    typeof navigator === "undefined" ||
    !("geolocation" in navigator)
  ) {
    return;
  }

  navigator.geolocation.clearWatch(
    watchId
  );
}

/**
 * Tính khoảng cách giữa hai tọa độ.
 *
 * Kết quả: mét.
 */
export function calculateDistance(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  const earthRadius = 6371000;

  const lat1 =
    (latitude1 * Math.PI) / 180;

  const lat2 =
    (latitude2 * Math.PI) / 180;

  const deltaLat =
    ((latitude2 - latitude1) * Math.PI) /
    180;

  const deltaLng =
    ((longitude2 - longitude1) * Math.PI) /
    180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
}