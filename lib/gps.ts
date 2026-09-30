"use client";

export type GPSLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

// Laptop thường định vị bằng Wi‑Fi/network nên có thể cần lâu hơn
// và độ chính xác thấp hơn GPS trên điện thoại.
const GPS_REQUEST_TIMEOUT = 45000;
const GPS_WATCH_TIMEOUT = 60000;
const GPS_CACHED_LOCATION_MAX_AGE = 120000;
const GPS_MAX_ACCEPTABLE_ACCURACY = 10000;

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
        "Chrome/Edge hiện chưa nhận được tọa độ từ Windows. TravelQuest sẽ tiếp tục thử lại thay vì dừng ngay."
      );
    case error.TIMEOUT:
      return new Error(
        "Chrome/Edge mất quá lâu để xác định vị trí. Hãy thử lại sau vài giây."
      );
    default:
      return new Error("Không thể lấy vị trí hiện tại.");
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
    (location.accuracy === undefined ||
      location.accuracy <= GPS_MAX_ACCEPTABLE_ACCURACY)
  );
}

/**
 * Lấy vị trí hiện tại.
 *
 * Trên laptop, Windows/Chrome thường cần thời gian để suy ra vị trí
 * từ Wi-Fi/network. Vì vậy:
 * 1. Cho phép dùng tọa độ cache gần đây để phản hồi nhanh.
 * 2. Thử getCurrentPosition trước.
 * 3. Nếu request đầu tiên timeout/unavailable, chuyển sang watchPosition
 *    thay vì chạy hai request song song.
 * 4. Chỉ thất bại sau tổng thời gian đủ dài cho laptop.
 */
export function getCurrentLocation(): Promise<GPSLocation> {
  ensureBrowser();

  return new Promise<GPSLocation>((resolve, reject) => {
    let finished = false;
    let watchId: number | null = null;
    let totalTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let fallbackStarted = false;
    let lastError: GeolocationPositionError | null = null;

    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }

      if (totalTimeoutId !== null) {
        clearTimeout(totalTimeoutId);
        totalTimeoutId = null;
      }
    };

    const finishResolve = (location: GPSLocation) => {
      if (finished) return;
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

    const handlePosition = (position: GeolocationPosition) => {
      if (finished) return;

      const location = toGPSLocation(position);

      if (isUsableGPSLocation(location)) {
        finishResolve(location);
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      if (finished) return;

      lastError = error;

      if (error.code === error.PERMISSION_DENIED) {
        finishReject(mapGeolocationError(error));
        return;
      }

      if (!fallbackStarted) {
        startWatchFallback();
      }
    };

    const startWatchFallback = () => {
      if (finished || fallbackStarted) return;

      fallbackStarted = true;

      watchId = navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        {
          enableHighAccuracy: false,
          timeout: GPS_WATCH_TIMEOUT,
          maximumAge: GPS_CACHED_LOCATION_MAX_AGE,
        }
      );
    };

    // Cho phép Chrome trả về vị trí cache gần đây nếu đã có.
    // Nếu cache không có/không dùng được, browser sẽ tiếp tục lấy vị trí mới.
    navigator.geolocation.getCurrentPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: false,
        timeout: GPS_REQUEST_TIMEOUT,
        maximumAge: GPS_CACHED_LOCATION_MAX_AGE,
      }
    );

    totalTimeoutId = setTimeout(() => {
      if (finished) return;

      finishReject(
        lastError
          ? mapGeolocationError(lastError)
          : new Error(
              "Chrome/Edge chưa trả về tọa độ sau 45 giây. TravelQuest đã thử cả vị trí cache và cơ chế theo dõi vị trí của trình duyệt."
            )
      );
    }, GPS_REQUEST_TIMEOUT);

    // Nếu browser không gọi error callback khi request đầu tiên bị treo,
    // vẫn chuyển sang watchPosition trước khi tổng timeout kết thúc.
    setTimeout(() => {
      if (!finished && !fallbackStarted) {
        startWatchFallback();
      }
    }, 12000);
  });
}

/**
 * Theo dõi vị trí liên tục, phù hợp với laptop.
 */
export function watchCurrentLocation(
  onLocation: (location: GPSLocation) => void,
  onError?: (error: Error) => void
): number {
  ensureBrowser();

  return navigator.geolocation.watchPosition(
    (position) => {
      const location = toGPSLocation(position);

      if (!isUsableGPSLocation(location)) return;

      onLocation(location);
    },
    (error) => {
      onError?.(mapGeolocationError(error));
    },
    {
      enableHighAccuracy: false,
      timeout: GPS_REQUEST_TIMEOUT,
      maximumAge: 60000,
    }
  );
}

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

  navigator.geolocation.clearWatch(watchId);
}

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
  } else if (
    typeof a === "number" &&
    typeof b === "number" &&
    typeof c === "number" &&
    typeof d === "number"
  ) {
    latitude1 = a;
    longitude1 = b;
    latitude2 = c;
    longitude2 = d;
  } else {
    throw new Error(
      "calculateDistance cần 2 GPSLocation hoặc 4 tọa độ."
    );
  }

  const earthRadius = 6371000;
  const lat1 = (latitude1 * Math.PI) / 180;
  const lat2 = (latitude2 * Math.PI) / 180;
  const deltaLat = ((latitude2 - latitude1) * Math.PI) / 180;
  const deltaLng = ((longitude2 - longitude1) * Math.PI) / 180;

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
