"use client";

export type GPSLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

// Laptop thường định vị bằng Wi‑Fi/network nên có thể cần lâu hơn
// và độ chính xác thấp hơn GPS trên điện thoại.
const GPS_REQUEST_TIMEOUT = 15000;
const GPS_MAX_ACCEPTABLE_ACCURACY = 10000;
const GPS_PREFERRED_ACCURACY = 500;
const GPS_FIRST_FIX_WAIT = 3500;

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
 * Trên laptop không ép Precise Location/high accuracy.
 * Chỉ cần trình duyệt trả về tọa độ hợp lệ là TravelQuest
 * có thể đặt marker; accuracy vẫn được giữ lại để các logic
 * khác quyết định mức độ tin cậy.
 */
export function getCurrentLocation(): Promise<GPSLocation> {
  ensureBrowser();

  return new Promise((resolve, reject) => {
    let finished = false;
    let bestLocation: GPSLocation | null = null;
    let watchId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
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
      if (!isUsableGPSLocation(location)) return;

      if (
        bestLocation === null ||
        (location.accuracy ?? Infinity) <
          (bestLocation.accuracy ?? Infinity)
      ) {
        bestLocation = location;
      }

      // Nếu fix đã khá chính xác thì trả về ngay.
      // Nếu browser chỉ trả về vị trí thô (thường gặp trên laptop),
      // giữ watch thêm một khoảng ngắn để có cơ hội nhận fix tốt hơn.
      if (
        location.accuracy === undefined ||
        location.accuracy <= GPS_PREFERRED_ACCURACY
      ) {
        finishResolve(location);
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      if (finished) return;

      if (error.code === error.PERMISSION_DENIED) {
        finishReject(mapGeolocationError(error));
      }
      // TIMEOUT/POSITION_UNAVAILABLE: tiếp tục chờ hoặc dùng
      // bestLocation ở cuối timeout tổng.
    };

    // Dùng getCurrentPosition song song với watchPosition.
    // Một số bản Chrome/Edge trên Windows không phát fix qua watch ngay,
    // nhưng lại trả về được qua request một lần.
    navigator.geolocation.getCurrentPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: false,
        timeout: GPS_REQUEST_TIMEOUT,
        maximumAge: 10000,
      }
    );

    watchId = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: false,
        timeout: GPS_REQUEST_TIMEOUT,
        maximumAge: 10000,
      }
    );

    timeoutId = setTimeout(() => {
      if (finished) return;

      if (bestLocation && isUsableGPSLocation(bestLocation)) {
        finishResolve(bestLocation);
        return;
      }

      finishReject(
        new Error(
          "Chrome/Edge không trả về tọa độ dù quyền Vị trí đã được cấp. Hãy kiểm tra Windows Location Services, quyền vị trí của trình duyệt và thử tải lại trang."
        )
      );
    }, GPS_REQUEST_TIMEOUT);

    // Cho browser một khoảng ngắn để cải thiện fix đầu tiên,
    // thay vì khóa UI trong toàn bộ timeout.
    setTimeout(() => {
      if (finished) return;
      if (bestLocation && isUsableGPSLocation(bestLocation)) {
        finishResolve(bestLocation);
      }
    }, GPS_FIRST_FIX_WAIT);
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
