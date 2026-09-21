"use client";

export type GPSLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
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
 * Ưu tiên vị trí cache / network location trước.
 * Chỉ yêu cầu GPS độ chính xác cao nếu lần đầu thất bại.
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

      resolve(
        toGPSLocation(position)
      );
    };

    const finishReject = (
      error: Error
    ) => {
      if (finished) return;

      finished = true;

      if (highAccuracyTimer) {
        clearTimeout(highAccuracyTimer);
      }

      reject(error);
    };

    /*
     * LẦN 1:
     * Không ép high accuracy.
     */
    navigator.geolocation.getCurrentPosition(
      finishResolve,
      () => {
        if (finished) return;

        /*
         * LẦN 2:
         * Chỉ bật high accuracy khi lần đầu thất bại.
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
         * Không để GPS chờ vô hạn.
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
 * Theo dõi GPS liên tục.
 */
export function watchCurrentLocation(
  onLocation: (
    location: GPSLocation
  ) => void,
  onError?: (
    error: Error
  ) => void
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
 * Dừng GPS watcher.
 *
 * Chấp nhận cả number và null
 * để tương thích với state trong page.tsx.
 */
export function stopWatchingLocation(
  watchId: number | null
): void {
  if (
    watchId === null ||
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
 * Tính khoảng cách giữa hai vị trí.
 *
 * Hỗ trợ:
 *
 * calculateDistance(location1, location2)
 *
 * và:
 *
 * calculateDistance(
 *   latitude1,
 *   longitude1,
 *   latitude2,
 *   longitude2
 * )
 */

export function calculateDistance(
  location1: GPSLocation,
  location2: GPSLocation
): number;

export function calculateDistance(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number;

export function calculateDistance(
  a: GPSLocation | number,
  b: GPSLocation | number,
  c?: number,
  d?: number
): number {
  let latitude1: number;
  let longitude1: number;
  let latitude2: number;
  let longitude2: number;

  /*
   * Dạng:
   * calculateDistance(location1, location2)
   */
  if (
    typeof a === "object" &&
    typeof b === "object"
  ) {
    latitude1 = a.latitude;
    longitude1 = a.longitude;

    latitude2 = b.latitude;
    longitude2 = b.longitude;
  }

  /*
   * Dạng:
   * calculateDistance(
   *   lat1,
   *   lng1,
   *   lat2,
   *   lng2
   * )
   */
  else if (
    typeof a === "number" &&
    typeof b === "number" &&
    typeof c === "number" &&
    typeof d === "number"
  ) {
    latitude1 = a;
    longitude1 = b;
    latitude2 = c;
    longitude2 = d;
  }

  else {
    throw new Error(
      "calculateDistance cần 2 GPSLocation hoặc 4 tọa độ."
    );
  }

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

  const aValue =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

  const cValue =
    2 *
    Math.atan2(
      Math.sqrt(aValue),
      Math.sqrt(1 - aValue)
    );

  return earthRadius * cValue;
}