"use client";

export type GPSLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

const DEFAULT_TIMEOUT = 10000;
const HIGH_ACCURACY_TIMEOUT = 15000;
const CACHE_MAX_AGE = 30000;
const LOCATION_FALLBACK_TIMEOUT = 30000;
const MAX_ACCEPTABLE_ACCURACY = 10000;

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
        "TravelQuest chưa được Chrome/Edge cấp quyền Vị trí. Hãy cho phép Location cho trang này rồi tải lại trang."
      );

    case error.POSITION_UNAVAILABLE:
      return new Error(
        "Windows/Chrome chưa cung cấp được vị trí. Hãy bật Location Services của Windows và thử lại."
      );

    case error.TIMEOUT:
      return new Error(
        "Trình duyệt mất quá lâu để xác định vị trí. TravelQuest sẽ thử lại khi có vị trí mới."
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
    accuracy: Number.isFinite(position.coords.accuracy)
      ? Math.round(position.coords.accuracy)
      : undefined,
  };
}

function isUsableGPSLocation(
  location: GPSLocation
): boolean {
  return (
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180 &&
    (
      location.accuracy === undefined ||
      location.accuracy <= MAX_ACCEPTABLE_ACCURACY
    )
  );
}

/**
 * Lấy vị trí hiện tại.
 *
 * Trên laptop Windows, ưu tiên network/Wi-Fi location thay vì
 * ép high accuracy ngay từ đầu. Nếu browser chưa trả vị trí,
 * watchPosition tiếp tục chờ một fix mới.
 */
export function getCurrentLocation(): Promise<GPSLocation> {
  ensureBrowser();

  return new Promise((resolve, reject) => {
    let finished = false;
    let watchId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastError: GeolocationPositionError | null = null;

    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const finishResolve = (
      position: GeolocationPosition
    ) => {
      if (finished) return;

      const location = toGPSLocation(position);

      if (!isUsableGPSLocation(location)) {
        return;
      }

      finished = true;
      cleanup();
      resolve(location);
    };

    const finishReject = (error: Error) => {
      if (finished) return;

      finished = true;
      cleanup();
      reject(error);
    };

    const handlePosition = (
      position: GeolocationPosition
    ) => {
      finishResolve(position);
    };

    const handleError = (
      error: GeolocationPositionError
    ) => {
      if (finished) return;

      lastError = error;

      // Không reject ngay.
      // Trên Windows, POSITION_UNAVAILABLE/TIMEOUT có thể xảy ra
      // trước khi Location Services trả về một tọa độ hợp lệ.
    };

    const options: PositionOptions = {
      enableHighAccuracy: false,
      timeout: DEFAULT_TIMEOUT,
      maximumAge: CACHE_MAX_AGE,
    };

    // Thử lấy vị trí cache/network hiện tại trước.
    navigator.geolocation.getCurrentPosition(
      handlePosition,
      handleError,
      options
    );

    // Nếu lần trên chưa có kết quả, tiếp tục chờ vị trí mới.
    watchId = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: false,
        timeout: HIGH_ACCURACY_TIMEOUT,
        maximumAge: CACHE_MAX_AGE,
      }
    );

    timeoutId = setTimeout(() => {
      if (finished) return;

      if (lastError !== null) {
        finishReject(mapGeolocationError(lastError));
        return;
      }

      finishReject(
        new Error(
          "Chrome/Edge chưa trả về tọa độ. Hãy kiểm tra quyền Location của trang TravelQuest và Location Services của Windows."
        )
      );
    }, LOCATION_FALLBACK_TIMEOUT);
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
      const location = toGPSLocation(position);

      if (!isUsableGPSLocation(location)) return;

      onLocation(location);
    },
    (error) => {
      onError?.(
        mapGeolocationError(error)
      );
    },
    {
      enableHighAccuracy: false,
      timeout: HIGH_ACCURACY_TIMEOUT,
      maximumAge: CACHE_MAX_AGE,
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

  if (
    typeof a === "object" &&
    typeof b === "object"
  ) {
    latitude1 = a.latitude;
    longitude1 = a.longitude;

    latitude2 = b.latitude;
    longitude2 = b.longitude;
  }

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
