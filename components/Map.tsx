"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type UserLocation = {
  latitude: number;
  longitude: number;
};

type MapProps = {
  userLocation?: UserLocation | null;
};

const CHECKIN_RADIUS = 150;

const checkpoints = [
  {
    name: "Hồ Hoàn Kiếm",
    description:
      "Biểu tượng nổi tiếng của trung tâm Hà Nội.",
    icon: "🏞️",
    longitude: 105.852,
    latitude: 21.0285,
  },
  {
    name: "Văn Miếu - Quốc Tử Giám",
    description:
      "Di tích lịch sử và trường đại học đầu tiên của Việt Nam.",
    icon: "🏛️",
    longitude: 105.8356,
    latitude: 21.0278,
  },
  {
    name: "Hoàng thành Thăng Long",
    description:
      "Di sản văn hóa thế giới nằm giữa lòng Hà Nội.",
    icon: "🏯",
    longitude: 105.8412,
    latitude: 21.0359,
  },
  {
    name: "Lăng Chủ tịch Hồ Chí Minh",
    description:
      "Một địa điểm lịch sử quan trọng tại Ba Đình.",
    icon: "⭐",
    longitude: 105.8348,
    latitude: 21.0367,
  },
];

// ========================================
// KIỂM TRA TỌA ĐỘ
// ========================================

function isValidCoordinate(
  latitude: number,
  longitude: number
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

// ========================================
// TÍNH KHOẢNG CÁCH GPS
// ========================================

function calculateDistance(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number | null {
  if (
    !isValidCoordinate(
      latitude1,
      longitude1
    ) ||
    !isValidCoordinate(
      latitude2,
      longitude2
    )
  ) {
    return null;
  }

  const earthRadius = 6371000;

  const lat1 =
    (latitude1 * Math.PI) / 180;

  const lat2 =
    (latitude2 * Math.PI) / 180;

  const deltaLat =
    ((latitude2 - latitude1) *
      Math.PI) /
    180;

  const deltaLng =
    ((longitude2 - longitude1) *
      Math.PI) /
    180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

  // Chặn sai số floating point
  const safeA = Math.min(
    1,
    Math.max(0, a)
  );

  const c =
    2 *
    Math.atan2(
      Math.sqrt(safeA),
      Math.sqrt(1 - safeA)
    );

  const distance =
    earthRadius * c;

  if (!Number.isFinite(distance)) {
    return null;
  }

  return distance;
}

export default function Map({
  userLocation = null,
}: MapProps) {
  const mapContainer =
    useRef<HTMLDivElement | null>(null);

  const map =
    useRef<mapboxgl.Map | null>(null);

  const userMarker =
    useRef<mapboxgl.Marker | null>(null);

  // ========================================
  // KHỞI TẠO MAPBOX
  // ========================================

  useEffect(() => {
    if (!mapContainer.current) {
      return;
    }

    const token =
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!token) {
      console.error(
        "Thiếu NEXT_PUBLIC_MAPBOX_TOKEN trong .env.local"
      );

      return;
    }

    mapboxgl.accessToken = token;

    if (map.current) {
      return;
    }

    const mapInstance =
      new mapboxgl.Map({
        container:
          mapContainer.current,

        style:
          "mapbox://styles/mapbox/streets-v12",

        center: [
          105.852,
          21.0285,
        ],

        zoom: 13,
      });

    map.current =
      mapInstance;

    // ========================================
    // NAVIGATION CONTROL
    // ========================================

    mapInstance.addControl(
      new mapboxgl.NavigationControl(),
      "bottom-right"
    );

    // ========================================
    // CHECKPOINT MARKERS
    // ========================================

    checkpoints.forEach(
      (checkpoint) => {
        const markerElement =
          document.createElement("div");

        markerElement.style.width =
          "42px";

        markerElement.style.height =
          "42px";

        markerElement.style.borderRadius =
          "50%";

        markerElement.style.background =
          "rgba(7, 24, 42, 0.95)";

        markerElement.style.border =
          "2px solid rgba(255,255,255,0.8)";

        markerElement.style.display =
          "flex";

        markerElement.style.alignItems =
          "center";

        markerElement.style.justifyContent =
          "center";

        markerElement.style.fontSize =
          "22px";

        markerElement.style.cursor =
          "pointer";

        markerElement.style.boxShadow =
          "0 4px 16px rgba(0,0,0,0.35)";

        markerElement.textContent =
          checkpoint.icon;

        const popup =
          new mapboxgl.Popup({
            offset: 25,
          }).setHTML(`
            <div style="padding: 4px;">
              <strong>
                ${checkpoint.name}
              </strong>

              <p
                style="
                  margin-top: 6px;
                  margin-bottom: 0;
                "
              >
                ${checkpoint.description}
              </p>

              <p
                style="
                  margin-top: 8px;
                  font-size: 12px;
                  color: #666;
                "
              >
                Vùng check-in: ${CHECKIN_RADIUS}m
              </p>
            </div>
          `);

        new mapboxgl.Marker(
          markerElement
        )
          .setLngLat([
            checkpoint.longitude,
            checkpoint.latitude,
          ])
          .setPopup(popup)
          .addTo(mapInstance);
      }
    );

    // ========================================
    // VÙNG CHECK-IN
    // ========================================

    mapInstance.on(
      "load",
      () => {
        if (
          mapInstance.getSource(
            "checkpoint-zones"
          )
        ) {
          return;
        }

        const sourceData = {
          type: "FeatureCollection" as const,

          features:
            checkpoints.map(
              (checkpoint) => ({
                type: "Feature" as const,

                properties: {
                  name:
                    checkpoint.name,
                },

                geometry: {
                  type: "Point" as const,

                  coordinates: [
                    checkpoint.longitude,
                    checkpoint.latitude,
                  ],
                },
              })
            ),
        };

        mapInstance.addSource(
          "checkpoint-zones",
          {
            type: "geojson",
            data: sourceData,
          }
        );

        if (
          !mapInstance.getLayer(
            "checkpoint-zone-fill"
          )
        ) {
          mapInstance.addLayer({
            id: "checkpoint-zone-fill",

            type: "circle",

            source:
              "checkpoint-zones",

            paint: {
              "circle-radius": 35,

              "circle-color":
                "#2563eb",

              "circle-opacity":
                0.12,

              "circle-stroke-color":
                "#60a5fa",

              "circle-stroke-width":
                2,

              "circle-stroke-opacity":
                0.5,
            },
          });
        }
      }
    );

    // ========================================
    // CLEANUP
    // ========================================

    return () => {
      if (
        userMarker.current
      ) {
        userMarker.current.remove();

        userMarker.current =
          null;
      }

      mapInstance.remove();

      map.current = null;
    };
  }, []);

  // ============================================
  // HIỂN THỊ VỊ TRÍ GPS
  // ============================================

  useEffect(() => {
    if (
      !map.current ||
      !userLocation
    ) {
      return;
    }

    const latitude =
      userLocation.latitude;

    const longitude =
      userLocation.longitude;

    // ========================================
    // CHẶN GPS KHÔNG HỢP LỆ
    // ========================================

    if (
      !isValidCoordinate(
        latitude,
        longitude
      )
    ) {
      console.warn(
        "GPS trả về tọa độ không hợp lệ:",
        userLocation
      );

      return;
    }

    // ========================================
    // XÓA MARKER GPS CŨ
    // ========================================

    if (
      userMarker.current
    ) {
      userMarker.current.remove();

      userMarker.current =
        null;
    }

    // ========================================
    // TẠO GPS MARKER
    // ========================================

    const gpsElement =
      document.createElement("div");

    gpsElement.style.width =
      "20px";

    gpsElement.style.height =
      "20px";

    gpsElement.style.borderRadius =
      "50%";

    gpsElement.style.background =
      "#2563eb";

    gpsElement.style.border =
      "4px solid white";

    gpsElement.style.boxShadow =
      "0 0 0 6px rgba(37,99,235,0.25)";

    userMarker.current =
      new mapboxgl.Marker(
        gpsElement
      )
        .setLngLat([
          longitude,
          latitude,
        ])
        .addTo(map.current);

    // ========================================
    // TÌM CHECKPOINT GẦN NHẤT
    // ========================================

    let nearestDistance:
      number | null = null;

    let nearestCheckpoint:
      (typeof checkpoints)[number] | null =
      null;

    checkpoints.forEach(
      (checkpoint) => {
        const distance =
          calculateDistance(
            latitude,
            longitude,
            checkpoint.latitude,
            checkpoint.longitude
          );

        // Chỉ nhận khoảng cách hợp lệ
        if (
          distance === null
        ) {
          return;
        }

        if (
          nearestDistance === null ||
          distance <
            nearestDistance
        ) {
          nearestDistance =
            distance;

          nearestCheckpoint =
            checkpoint;
        }
      }
    );

    // ========================================
    // LOG KHOẢNG CÁCH
    // ========================================

    if (
      nearestDistance !== null &&
      nearestCheckpoint !== null
    ) {
      const roundedDistance =
        Math.round(
          nearestDistance
        );

      console.log(
        `Checkpoint gần nhất: ${roundedDistance}m`
      );

      if (
        nearestDistance <=
        CHECKIN_RADIUS
      ) {
        console.log(
          "Bạn đang trong vùng check-in!"
        );
      }
    } else {
      console.warn(
        "Không thể tính khoảng cách tới checkpoint."
      );
    }

    // ========================================
    // ĐƯA MAP TỚI VỊ TRÍ GPS
    // ========================================

    map.current.flyTo({
      center: [
        longitude,
        latitude,
      ],

      zoom: 15,

      duration: 1000,
    });
  }, [userLocation]);

  // ========================================
  // RENDER
  // ========================================

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
    />
  );
}