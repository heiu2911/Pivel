"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type UserLocation = {
  latitude: number;
  longitude: number;
};

type Checkpoint = {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  badge: string | null;
  longitude: number;
  latitude: number;
};

type MapProps = {
  userLocation?: UserLocation | null;
  checkpoints?: Checkpoint[];
};

type CityDefinition = {
  key: string;
  name: string;
  latitude: number;
  longitude: number;
};

type CityGroup = CityDefinition & {
  checkpoints: Checkpoint[];
};

const CHECKIN_RADIUS = 150;
const CITY_ZOOM_LIMIT = 10.5;

// Các điểm đại diện giúp gom checkpoint thành "gốc cây" ở zoom xa.
// Khi zoom gần hơn CITY_ZOOM_LIMIT, các checkpoint thật sẽ xuất hiện.
const CITY_DEFINITIONS: CityDefinition[] = [
  { key: "ha-noi", name: "Hà Nội", latitude: 21.0285, longitude: 105.8542 },
  { key: "ha-long", name: "Hạ Long", latitude: 20.9500, longitude: 107.0800 },
  { key: "ninh-binh", name: "Ninh Bình", latitude: 20.2500, longitude: 105.9700 },
  { key: "hue", name: "Huế", latitude: 16.4637, longitude: 107.5909 },
  { key: "da-nang", name: "Đà Nẵng", latitude: 16.0544, longitude: 108.2022 },
  { key: "phong-nha", name: "Phong Nha", latitude: 17.5762, longitude: 106.3047 },
  { key: "cao-bang", name: "Cao Bằng", latitude: 22.6650, longitude: 106.2630 },
  { key: "sapa", name: "Sa Pa", latitude: 22.3364, longitude: 103.8438 },
  { key: "nha-trang", name: "Nha Trang", latitude: 12.2388, longitude: 109.1967 },
  { key: "ho-chi-minh", name: "TP. Hồ Chí Minh", latitude: 10.7769, longitude: 106.7009 },
  { key: "tay-ninh", name: "Tây Ninh", latitude: 11.3100, longitude: 106.1000 },
  { key: "can-tho", name: "Cần Thơ", latitude: 10.0452, longitude: 105.7469 },
  { key: "da-lat", name: "Đà Lạt", latitude: 11.9404, longitude: 108.4583 },
];

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
  checkpoints = [],
}: MapProps) {
  const mapContainer =
    useRef<HTMLDivElement | null>(null);

  const map =
    useRef<mapboxgl.Map | null>(null);

  const userMarker =
    useRef<mapboxgl.Marker | null>(null);

  const checkpointMarkers =
    useRef<mapboxgl.Marker[]>([]);

  const cityMarkers =
    useRef<mapboxgl.Marker[]>([]);

  const currentMapMode =
    useRef<"cities" | "checkpoints" | null>(null);

  const checkpointZonesAdded =
    useRef(false);

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

    mapInstance.addControl(
      new mapboxgl.NavigationControl(),
      "bottom-right"
    );

    return () => {
      checkpointMarkers.current.forEach(
        (marker) => marker.remove()
      );

      checkpointMarkers.current = [];

      cityMarkers.current.forEach(
        (marker) => marker.remove()
      );

      cityMarkers.current = [];
      currentMapMode.current = null;

      if (
        userMarker.current
      ) {
        userMarker.current.remove();

        userMarker.current =
          null;
      }

      mapInstance.remove();

      map.current = null;

      checkpointZonesAdded.current =
        false;
    };
  }, []);

  // ========================================
  // GOM CHECKPOINT THEO THÀNH PHỐ
  // ========================================

  function buildCityGroups(): CityGroup[] {
    const groups = new globalThis.Map<string, CityGroup>();

    CITY_DEFINITIONS.forEach((city) => {
      groups.set(city.key, {
        ...city,
        checkpoints: [],
      });
    });

    checkpoints.forEach((checkpoint) => {
      if (
        !isValidCoordinate(
          checkpoint.latitude,
          checkpoint.longitude
        )
      ) {
        return;
      }

      let nearestCityKey: string | null = null;
      let nearestDistance: number | null = null;

      CITY_DEFINITIONS.forEach((city) => {
        const distance = calculateDistance(
          checkpoint.latitude,
          checkpoint.longitude,
          city.latitude,
          city.longitude
        );

        if (
          distance !== null &&
          (nearestDistance === null ||
            distance < nearestDistance)
        ) {
          nearestDistance = distance;
          nearestCityKey = city.key;
        }
      });

      if (nearestCityKey) {
        const group = groups.get(nearestCityKey);
        if (group) {
          group.checkpoints.push(checkpoint);
        }
      }
    });

    return Array.from(groups.values()).filter(
      (group) => group.checkpoints.length > 0
    );
  }

  // ========================================
  // HIỂN THỊ GỐC CÂY / CHECKPOINT
  // ========================================

  useEffect(() => {
    const mapInstance = map.current;

    if (!mapInstance) {
      return;
    }

    const cityGroups = buildCityGroups();

    const clearCityMarkers = () => {
      cityMarkers.current.forEach(
        (marker) => marker.remove()
      );
      cityMarkers.current = [];
    };

    const clearCheckpointMarkers = () => {
      checkpointMarkers.current.forEach(
        (marker) => marker.remove()
      );
      checkpointMarkers.current = [];
    };

    const createCityMarker = (city: CityGroup) => {
      const markerElement =
        document.createElement("div");

      markerElement.style.width = "64px";
      markerElement.style.height = "64px";
      markerElement.style.cursor = "pointer";
      markerElement.style.display = "flex";
      markerElement.style.alignItems = "center";
      markerElement.style.justifyContent = "center";
      markerElement.style.zIndex = "20";

      // Wrapper này để Mapbox tự quản lý transform.
      // Không scale trực tiếp wrapper để tránh marker bay.
      const icon = document.createElement("div");
      icon.style.width = "54px";
      icon.style.height = "54px";
      icon.style.borderRadius = "50%";
      icon.style.background = "rgba(7, 24, 42, 0.97)";
      icon.style.border = "2px solid rgba(255,255,255,0.95)";
      icon.style.display = "flex";
      icon.style.alignItems = "center";
      icon.style.justifyContent = "center";
      icon.style.fontSize = "28px";
      icon.style.boxShadow = "0 6px 22px rgba(0,0,0,0.5)";
      icon.style.transition = "transform 0.15s ease";
      icon.textContent = "🌳";

      markerElement.appendChild(icon);

      const label = document.createElement("div");
      label.style.position = "absolute";
      label.style.top = "58px";
      label.style.left = "50%";
      label.style.transform = "translateX(-50%)";
      label.style.whiteSpace = "nowrap";
      label.style.padding = "4px 8px";
      label.style.borderRadius = "999px";
      label.style.background = "rgba(7, 24, 42, 0.92)";
      label.style.border = "1px solid rgba(255,255,255,0.12)";
      label.style.color = "white";
      label.style.fontSize = "11px";
      label.style.fontWeight = "700";
      label.style.pointerEvents = "none";
      label.textContent = `${city.name} · ${city.checkpoints.length}`;
      markerElement.appendChild(label);

      markerElement.addEventListener("mouseenter", () => {
        icon.style.transform = "scale(1.08)";
      });

      markerElement.addEventListener("mouseleave", () => {
        icon.style.transform = "scale(1)";
      });

      markerElement.addEventListener("click", () => {
        mapInstance.flyTo({
          center: [city.longitude, city.latitude],
          zoom: 12.5,
          duration: 900,
          essential: true,
        });
      });

      const popup = new mapboxgl.Popup({
        offset: 34,
        closeButton: false,
        closeOnClick: false,
        maxWidth: "260px",
      }).setHTML(`
        <div style="padding:6px;font-family:system-ui,sans-serif;">
          <div style="font-size:28px;margin-bottom:4px;">🌳</div>
          <strong style="font-size:16px;color:#111827;">
            ${escapeHtml(city.name)}
          </strong>
          <div style="margin-top:6px;color:#4b5563;font-size:12px;">
            ${city.checkpoints.length} checkpoint đang khám phá
          </div>
          <div style="margin-top:8px;color:#2563eb;font-size:12px;font-weight:700;">
            Nhấn để zoom vào khu vực
          </div>
        </div>
      `);

      return new mapboxgl.Marker({
        element: markerElement,
        anchor: "center",
      })
        .setLngLat([city.longitude, city.latitude])
        .setPopup(popup)
        .addTo(mapInstance);
    };

    const createCheckpointMarker = (
      checkpoint: Checkpoint
    ) => {
      const markerElement =
        document.createElement("div");

      markerElement.style.width = "48px";
      markerElement.style.height = "48px";
      markerElement.style.cursor = "pointer";
      markerElement.style.zIndex = "10";

      // Mapbox quản lý transform của wrapper.
      // Hover chỉ scale element con để marker không bị bay.
      const markerIcon =
        document.createElement("div");

      markerIcon.style.width = "48px";
      markerIcon.style.height = "48px";
      markerIcon.style.borderRadius = "50%";
      markerIcon.style.background =
        "rgba(7, 24, 42, 0.96)";
      markerIcon.style.border =
        "2px solid rgba(255,255,255,0.9)";
      markerIcon.style.display = "flex";
      markerIcon.style.alignItems = "center";
      markerIcon.style.justifyContent = "center";
      markerIcon.style.fontSize = "26px";
      markerIcon.style.lineHeight = "1";
      markerIcon.style.boxShadow =
        "0 5px 20px rgba(0,0,0,0.45)";
      markerIcon.style.transition =
        "transform 0.15s ease";
      markerIcon.textContent =
        checkpoint.icon?.trim() || "📍";

      markerElement.appendChild(markerIcon);
      markerElement.title = checkpoint.name;

      markerElement.addEventListener("mouseenter", () => {
        markerIcon.style.transform = "scale(1.12)";
      });

      markerElement.addEventListener("mouseleave", () => {
        markerIcon.style.transform = "scale(1)";
      });

      const safeName = escapeHtml(checkpoint.name);
      const safeDescription = escapeHtml(
        checkpoint.description ??
          "Checkpoint du lịch TravelQuest."
      );
      const safeBadge = escapeHtml(
        checkpoint.badge ??
          "🏆 Huy hiệu TravelQuest"
      );

      const distanceFromUser =
        userLocation &&
        isValidCoordinate(
          userLocation.latitude,
          userLocation.longitude
        )
          ? calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              checkpoint.latitude,
              checkpoint.longitude
            )
          : null;

      const distanceText =
        distanceFromUser !== null
          ? distanceFromUser < 1000
            ? `${Math.round(distanceFromUser)} m từ bạn`
            : `${(distanceFromUser / 1000).toFixed(1)} km từ bạn`
          : "Khoảng cách GPS chưa xác định";

      const popup = new mapboxgl.Popup({
        offset: 30,
        closeButton: true,
        closeOnClick: false,
        maxWidth: "360px",
      }).setHTML(`
        <div style="width:320px;max-width:calc(100vw - 48px);overflow:hidden;border-radius:16px;background:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;box-shadow:0 10px 30px rgba(0,0,0,.18);">
          <div style="height:105px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#07182a,#123b5d);">
            <div style="width:70px;height:70px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:38px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);">
              ${escapeHtml(checkpoint.icon?.trim() || "📍")}
            </div>
          </div>
          <div style="padding:16px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
              <div>
                <div style="font-size:19px;line-height:1.25;font-weight:800;color:#111827;">${safeName}</div>
                <div style="margin-top:5px;font-size:12px;color:#6b7280;">📍 Địa danh TravelQuest</div>
              </div>
              <div style="flex-shrink:0;padding:5px 8px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:800;">CHECKPOINT</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:13px;padding:9px 10px;border-radius:10px;background:#f8fafc;">
              <span style="font-size:17px;">🏆</span>
              <span style="font-size:12px;color:#334155;font-weight:700;">${safeBadge}</span>
            </div>
            <p style="margin:13px 0 0;color:#475569;font-size:13px;line-height:1.55;">${safeDescription}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;">
              <div style="padding:9px 10px;border-radius:10px;background:#f8fafc;">
                <div style="font-size:10px;color:#94a3b8;font-weight:700;">KHOẢNG CÁCH</div>
                <div style="margin-top:3px;font-size:12px;color:#334155;font-weight:700;">${escapeHtml(distanceText)}</div>
              </div>
              <div style="padding:9px 10px;border-radius:10px;background:#f8fafc;">
                <div style="font-size:10px;color:#94a3b8;font-weight:700;">CHECK-IN</div>
                <div style="margin-top:3px;font-size:12px;color:#334155;font-weight:700;">Trong bán kính ${CHECKIN_RADIUS}m</div>
              </div>
            </div>
            <div style="margin-top:12px;padding-top:11px;border-top:1px solid #e5e7eb;color:#64748b;font-size:11px;line-height:1.5;">
              🧭 ${checkpoint.latitude.toFixed(5)}, ${checkpoint.longitude.toFixed(5)}
            </div>
          </div>
        </div>
      `);

      return new mapboxgl.Marker({
        element: markerElement,
        anchor: "center",
      })
        .setLngLat([
          checkpoint.longitude,
          checkpoint.latitude,
        ])
        .setPopup(popup)
        .addTo(mapInstance);
    };

    const renderMode = () => {
      const showCities =
        mapInstance.getZoom() <= CITY_ZOOM_LIMIT;

      const nextMode = showCities
        ? "cities"
        : "checkpoints";

      if (currentMapMode.current === nextMode) {
        return;
      }

      currentMapMode.current = nextMode;

      if (showCities) {
        clearCheckpointMarkers();
        clearCityMarkers();

        cityGroups.forEach((city) => {
          cityMarkers.current.push(
            createCityMarker(city)
          );
        });

        console.log(
          `TravelQuest: zoom xa → ${cityGroups.length} khu vực thành phố.`
        );
      } else {
        clearCityMarkers();
        clearCheckpointMarkers();

        checkpoints.forEach((checkpoint) => {
          if (
            !isValidCoordinate(
              checkpoint.latitude,
              checkpoint.longitude
            )
          ) {
            return;
          }

          checkpointMarkers.current.push(
            createCheckpointMarker(checkpoint)
          );
        });

        console.log(
          `TravelQuest: zoom gần → ${checkpoints.length} checkpoint.`
        );
      }
    };

    const setup = () => {
      currentMapMode.current = null;
      renderMode();
    };

    if (mapInstance.isStyleLoaded()) {
      setup();
    } else {
      mapInstance.once("load", setup);
    }

    mapInstance.on("zoomend", renderMode);

    return () => {
      mapInstance.off("zoomend", renderMode);
      clearCityMarkers();
      clearCheckpointMarkers();
      currentMapMode.current = null;
    };
  }, [checkpoints]);

  // ========================================
  // VÙNG CHECK-IN
  // ========================================

  useEffect(() => {
    const mapInstance = map.current;

    if (!mapInstance) {
      return;
    }

    const updateZones = () => {
      const sourceId =
        "checkpoint-zones";

      const layerId =
        "checkpoint-zone-fill";

      const sourceData = {
        type:
          "FeatureCollection" as const,

        features:
          checkpoints
            .filter(
              (checkpoint) =>
                isValidCoordinate(
                  checkpoint.latitude,
                  checkpoint.longitude
                )
            )
            .map(
              (checkpoint) => ({
                type:
                  "Feature" as const,

                properties: {
                  name:
                    checkpoint.name,
                },

                geometry: {
                  type:
                    "Point" as const,

                  coordinates: [
                    checkpoint.longitude,
                    checkpoint.latitude,
                  ],
                },
              })
            ),
      };

      const existingSource =
        mapInstance.getSource(
          sourceId
        ) as mapboxgl.GeoJSONSource | undefined;

      if (existingSource) {
        existingSource.setData(
          sourceData
        );
      } else {
        mapInstance.addSource(
          sourceId,
          {
            type: "geojson",
            data: sourceData,
          }
        );
      }

      if (
        !mapInstance.getLayer(
          layerId
        )
      ) {
        mapInstance.addLayer({
          id: layerId,

          type: "circle",

          source: sourceId,

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

      checkpointZonesAdded.current =
        true;
    };

    if (
      mapInstance.isStyleLoaded()
    ) {
      updateZones();
    } else {
      mapInstance.once(
        "load",
        updateZones
      );
    }
  }, [checkpoints]);

  // ========================================
  // GPS MARKER
  // ========================================

  useEffect(() => {
    const mapInstance = map.current;

    if (
      !mapInstance ||
      !userLocation
    ) {
      return;
    }

    const latitude =
      userLocation.latitude;

    const longitude =
      userLocation.longitude;

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

    if (
      userMarker.current
    ) {
      userMarker.current.remove();

      userMarker.current =
        null;
    }

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
        .addTo(mapInstance);

    // Tìm checkpoint gần nhất
    let nearestDistance:
      number | null = null;

    let nearestCheckpoint:
      Checkpoint | null = null;

    checkpoints.forEach(
      (checkpoint) => {
        const distance =
          calculateDistance(
            latitude,
            longitude,
            checkpoint.latitude,
            checkpoint.longitude
          );

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

    if (
      nearestDistance !== null &&
      nearestCheckpoint !== null
    ) {
      console.log(
        `Checkpoint gần nhất: ${Math.round(
          nearestDistance
        )}m`
      );

      if (
        nearestDistance <=
        CHECKIN_RADIUS
      ) {
        console.log(
          "Bạn đang trong vùng check-in!"
        );
      }
    }

    mapInstance.flyTo({
      center: [
        longitude,
        latitude,
      ],

      zoom: 15,

      duration: 1000,
    });
  }, [
    userLocation,
    checkpoints,
  ]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
    />
  );
}