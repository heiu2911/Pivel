"use client";

export type GPSLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

const HIGH_ACCURACY_TIMEOUT = 20000;
const GPS_MAX_ACCEPTABLE_ACCURACY = 150;
const GPS_PREFERRED_ACCURACY = 50;

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

function isUsableGPSLocation(
  location: GPSLocation
): boolean {
  return (
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    Number.isFinite(location.accuracy) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180 &&
    (location.accuracy ?? Infinity) <=
      GPS_MAX_ACCEPTABLE_ACCURACY
  );
}

/**
 * Lấy vị trí hiện tại.
 *
 * Không sử dụng vị trí cache cũ. Luôn ưu tiên high accuracy và
 * lấy nhiều mẫu trong một khoảng ngắn để tránh nhận ngay một
 * network location có độ chính xác quá thấp.
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

    const finishResolve = (
      location: GPSLocation
    ) => {
      if (finished) return;

      finished = true;
      cleanup();
      resolve(location);
    };

    const finishReject = (
      error: Error
    ) => {
      if (finished) return;

      finished = true;
      cleanup();
      reject(error);
    };

    const handlePosition = (
      position: GeolocationPosition
    ) => {
      if (finished) return;

      const location =
        toGPSLocation(position);

      if (!Number.isFinite(location.accuracy)) {
        return;
      }

      if (
        bestLocation === null ||
        (location.accuracy ?? Infinity) <
          (bestLocation.accuracy ?? Infinity)
      ) {
        bestLocation = location;
      }

      /*
       * Khi đã có fix đủ tốt thì trả về ngay.
       */
      if (
        (location.accuracy ?? Infinity) <=
        GPS_PREFERRED_ACCURACY
      ) {
        finishResolve(location);
        return;
      }

      /*
       * Nếu chưa đạt mức ưu tiên thì tiếp tục lấy mẫu.
       * Chỉ dùng fix <= 150m khi hết thời gian chờ.
       */
    };

    const handleError = (
      error: GeolocationPositionError
    ) => {
      if (finished) return;

      if (
        error.code ===
        error.PERMISSION_DENIED
      ) {
        finishReject(
          mapGeolocationError(error)
        );
      }
    };

    /*
     * Watch high-accuracy trong thời gian ngắn giúp trình duyệt
     * có cơ hội lấy GPS thật thay vì trả về network/cached location.
     */
    watchId =
      navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        {
          enableHighAccuracy: true,
          timeout: HIGH_ACCURACY_TIMEOUT,
          maximumAge: 0,
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
          "GPS chưa xác định được vị trí đủ chính xác. Hãy bật Vị trí chính xác (Precise Location) cho trình duyệt và thử lại."
        )
      );
    }, HIGH_ACCURACY_TIMEOUT + 1000);
  });
}

/**
 * Theo dõi GPS liên tục.
 *
 * Không dùng cache và luôn ưu tiên GPS độ chính xác cao.
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
      const location =
        toGPSLocation(position);

      if (!isUsableGPSLocation(location)) {
        return;
      }

      onLocation(location);
    },
    (error) => {
      onError?.(
        mapGeolocationError(error)
      );
    },
    {
      enableHighAccuracy: true,
      timeout: HIGH_ACCURACY_TIMEOUT,
      maximumAge: 0,
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
