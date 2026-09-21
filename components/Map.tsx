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

type CheckpointDetails = {
  category: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  hours?: string;
  phone?: string;
  website?: string;
  price?: string;
};

const CHECKPOINT_LOCAL_IMAGES: Record<string, string[]> = {
  "Hoàng thành Thăng Long": [
    "/checkpoints/hoang-thanh-thang-long-1.jpg",
    "/checkpoints/hoang-thanh-thang-long-2.jpg",
    "/checkpoints/hoang-thanh-thang-long-3.jpg",
  ],
};

const CHECKPOINT_IMAGE_QUERIES: Record<string, string> = {
  "Hồ Hoàn Kiếm": "Hoan Kiem Lake Hanoi Vietnam",
  "Văn Miếu - Quốc Tử Giám": "Temple of Literature Hanoi Vietnam",
  "Hoàng thành Thăng Long": "Imperial Citadel of Thang Long Hanoi Vietnam",
  "Lăng Chủ tịch Hồ Chí Minh": "Ho Chi Minh Mausoleum Hanoi Vietnam",
  "Vịnh Hạ Long": "Ha Long Bay Vietnam",
  "Yên Tử": "Yen Tu Mountain Vietnam",
  "Quần thể Tràng An": "Trang An Scenic Landscape Complex Vietnam",
  "Hang Múa": "Mua Cave Ninh Binh Vietnam",
  "Chùa Bái Đính": "Bai Dinh Pagoda Ninh Binh Vietnam",
  "Đại Nội Huế": "Imperial City Hue Vietnam",
  "Chùa Thiên Mụ": "Thien Mu Pagoda Hue Vietnam",
  "Cầu Rồng Đà Nẵng": "Dragon Bridge Da Nang Vietnam",
  "Cầu Vàng Bà Nà Hills": "Golden Bridge Ba Na Hills Vietnam",
  "Ngũ Hành Sơn": "Marble Mountains Da Nang Vietnam",
  "Phong Nha": "Phong Nha Cave Vietnam",
  "Thác Bản Giốc": "Ban Gioc Waterfall Vietnam",
  "Nhà thờ Đá Sa Pa": "Sapa Stone Church Vietnam",
  "Tháp Bà Ponagar": "Po Nagar Cham Towers Nha Trang Vietnam",
  "Dinh Độc Lập": "Independence Palace Ho Chi Minh City Vietnam",
  "Núi Bà Đen": "Ba Den Mountain Vietnam",
  "Chợ nổi Cái Răng": "Cai Rang Floating Market Vietnam",
  "Thác Datanla": "Datanla Waterfall Da Lat Vietnam",
};

const CHECKPOINT_DETAILS: Record<string, CheckpointDetails> = {
  "Chùa Bái Đính": {
    category: "Địa điểm tôn giáo",
    address: "Xóm 6, Tây Hoa Lư, Ninh Bình",
    rating: 4.8,
    reviewCount: 25290,
    hours: "06:00–21:00",
    phone: "+84 913 899 135",
    website: "chuabaidinhninhbinh.vn",
  },
  "Chùa Thiên Mụ": {
    category: "Chùa / Di tích lịch sử - văn hóa",
    address: "Đường Nguyễn Phúc Nguyên, phường Kim Long, Huế",
    rating: 4.6,
    reviewCount: 20027,
    hours: "07:00–17:30",
  },
  "Cầu Vàng Bà Nà Hills": {
    category: "Điểm tham quan",
    address: "Hòa Vang, Đà Nẵng",
    rating: 4.6,
    hours: "08:00–19:00",
  },
  "Ngũ Hành Sơn": {
    category: "Danh thắng / Điểm tham quan",
    address: "81 Huyền Trân Công Chúa, Ngũ Hành Sơn, Đà Nẵng",
    hours: "07:00–17:30",
    phone: "+84 236 3961114",
    website: "nguhanhson.org",
  },
  "Tháp Bà Ponagar": {
    category: "Di tích lịch sử - văn hóa",
    address: "2 Tháng 4, phường Vĩnh Phước, Nha Trang, Khánh Hòa",
    rating: 4.3,
    reviewCount: 4842,
    hours: "06:00–17:30",
    phone: "+84 58 382 4525",
  },
  "Dinh Độc Lập": {
    category: "Bảo tàng / Di tích lịch sử",
    address: "135 Nam Kỳ Khởi Nghĩa, Bến Thành, TP. Hồ Chí Minh",
    rating: 4.5,
    hours: "07:00–18:00",
    phone: "+84 28 3822 3652",
    website: "dinhdoclap.gov.vn",
  },
  "Thác Bản Giốc": {
    category: "Danh thắng tự nhiên",
    address: "Trùng Khánh, Cao Bằng",
    hours: "07:00–18:00 (mùa hè)",
  },
  "Nhà thờ Đá Sa Pa": {
    category: "Nhà thờ / Điểm tham quan",
    address: "Trung tâm thị xã Sa Pa, Lào Cai",
    hours: "Khuôn viên mở tự do; giờ trong nhà thờ có thể thay đổi",
  },
};


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

function createCheckpointDetailsModal({
  checkpoint,
  details,
  distanceText,
  mapInstance,
  userLocation,
  onClose,
}: {
  checkpoint: Checkpoint;
  details: CheckpointDetails;
  distanceText: string;
  mapInstance: mapboxgl.Map;
  userLocation: UserLocation | null;
  onClose: () => void;
}): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "9999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "24px";
  overlay.style.background = "rgba(3, 12, 24, 0.62)";
  overlay.style.backdropFilter = "blur(3px)";

  const card = document.createElement("div");
  card.style.width = "min(720px, calc(100vw - 32px))";
  card.style.maxHeight = "min(820px, calc(100vh - 48px))";
  card.style.overflow = "hidden";
  card.style.borderRadius = "22px";
  card.style.background = "#ffffff";
  card.style.boxShadow = "0 24px 80px rgba(0,0,0,0.45)";
  card.style.fontFamily = "system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";
  card.style.color = "#202124";
  card.style.display = "flex";
  card.style.flexDirection = "column";

  const safeName = escapeHtml(checkpoint.name);
  const safeDescription = escapeHtml(checkpoint.description ?? "Checkpoint du lịch TravelQuest.");
  const safeBadge = escapeHtml(checkpoint.badge ?? "🏆 Huy hiệu TravelQuest");
  const category = escapeHtml(details.category);

  const imageSection = document.createElement("div");
  imageSection.style.position = "relative";
  imageSection.style.width = "100%";
  imageSection.style.height = "300px";
  imageSection.style.background = "linear-gradient(135deg,#dbeafe,#e0f2fe)";
  imageSection.style.overflow = "hidden";

  const gallery = document.createElement("div");
  gallery.style.width = "100%";
  gallery.style.height = "100%";
  gallery.style.position = "relative";

  const mainImage = document.createElement("img");
  mainImage.alt = checkpoint.name;
  mainImage.style.width = "100%";
  mainImage.style.height = "100%";
  mainImage.style.objectFit = "cover";
  mainImage.style.display = "none";

  const loading = document.createElement("div");
  loading.textContent = "Đang tải hình ảnh…";
  loading.style.position = "absolute";
  loading.style.inset = "0";
  loading.style.display = "flex";
  loading.style.alignItems = "center";
  loading.style.justifyContent = "center";
  loading.style.color = "#64748b";
  loading.style.fontSize = "14px";

  const counter = document.createElement("div");
  counter.style.position = "absolute";
  counter.style.right = "14px";
  counter.style.top = "14px";
  counter.style.padding = "7px 10px";
  counter.style.borderRadius = "999px";
  counter.style.background = "rgba(0,0,0,.68)";
  counter.style.color = "#fff";
  counter.style.fontSize = "12px";
  counter.style.fontWeight = "800";
  counter.style.display = "none";

  const previousButton = document.createElement("button");
  previousButton.type = "button";
  previousButton.textContent = "‹";
  previousButton.setAttribute("aria-label", "Ảnh trước");
  previousButton.style.position = "absolute";
  previousButton.style.left = "12px";
  previousButton.style.top = "50%";
  previousButton.style.transform = "translateY(-50%)";
  previousButton.style.width = "42px";
  previousButton.style.height = "42px";
  previousButton.style.border = "0";
  previousButton.style.borderRadius = "50%";
  previousButton.style.background = "rgba(0,0,0,.58)";
  previousButton.style.color = "#fff";
  previousButton.style.fontSize = "30px";
  previousButton.style.lineHeight = "1";
  previousButton.style.cursor = "pointer";
  previousButton.style.display = "none";

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.textContent = "›";
  nextButton.setAttribute("aria-label", "Ảnh tiếp theo");
  nextButton.style.position = "absolute";
  nextButton.style.right = "12px";
  nextButton.style.top = "50%";
  nextButton.style.transform = "translateY(-50%)";
  nextButton.style.width = "42px";
  nextButton.style.height = "42px";
  nextButton.style.border = "0";
  nextButton.style.borderRadius = "50%";
  nextButton.style.background = "rgba(0,0,0,.58)";
  nextButton.style.color = "#fff";
  nextButton.style.fontSize = "30px";
  nextButton.style.lineHeight = "1";
  nextButton.style.cursor = "pointer";
  nextButton.style.display = "none";

  const thumbnails = document.createElement("div");
  thumbnails.style.position = "absolute";
  thumbnails.style.left = "14px";
  thumbnails.style.bottom = "14px";
  thumbnails.style.display = "flex";
  thumbnails.style.gap = "7px";

  gallery.appendChild(mainImage);
  gallery.appendChild(loading);
  gallery.appendChild(counter);
  gallery.appendChild(previousButton);
  gallery.appendChild(nextButton);
  gallery.appendChild(thumbnails);
  imageSection.appendChild(gallery);

  let galleryImages: string[] = [];
  let activeImageIndex = 0;

  const renderGallery = () => {
    if (!galleryImages.length) return;

    mainImage.src = galleryImages[activeImageIndex];
    mainImage.style.display = "block";
    loading.style.display = "none";
    counter.textContent = (activeImageIndex + 1) + " / " + galleryImages.length;
    counter.style.display = "block";

    previousButton.style.display = galleryImages.length > 1 ? "flex" : "none";
    previousButton.style.alignItems = "center";
    previousButton.style.justifyContent = "center";
    nextButton.style.display = galleryImages.length > 1 ? "flex" : "none";
    nextButton.style.alignItems = "center";
    nextButton.style.justifyContent = "center";

    thumbnails.innerHTML = "";
    galleryImages.forEach((url, index) => {
      const thumbnail = document.createElement("button");
      thumbnail.type = "button";
      thumbnail.setAttribute("aria-label", "Xem ảnh " + (index + 1));
      thumbnail.style.width = "58px";
      thumbnail.style.height = "42px";
      thumbnail.style.padding = "0";
      thumbnail.style.border = index === activeImageIndex ? "2px solid #fff" : "2px solid rgba(255,255,255,.45)";
      thumbnail.style.borderRadius = "8px";
      thumbnail.style.overflow = "hidden";
      thumbnail.style.background = "#111827";
      thumbnail.style.cursor = "pointer";

      const thumbnailImage = document.createElement("img");
      thumbnailImage.src = url;
      thumbnailImage.alt = checkpoint.name + " - ảnh " + (index + 1);
      thumbnailImage.style.width = "100%";
      thumbnailImage.style.height = "100%";
      thumbnailImage.style.objectFit = "cover";

      thumbnail.appendChild(thumbnailImage);
      thumbnail.addEventListener("click", () => {
        activeImageIndex = index;
        renderGallery();
      });
      thumbnails.appendChild(thumbnail);
    });
  };

  previousButton.addEventListener("click", () => {
    if (!galleryImages.length) return;
    activeImageIndex =
      (activeImageIndex - 1 + galleryImages.length) %
      galleryImages.length;
    renderGallery();
  });

  nextButton.addEventListener("click", () => {
    if (!galleryImages.length) return;
    activeImageIndex =
      (activeImageIndex + 1) % galleryImages.length;
    renderGallery();
  });

  const loadCheckpointImages = async () => {
    try {
      const localImages = CHECKPOINT_LOCAL_IMAGES[checkpoint.name];

      if (localImages?.length) {
        galleryImages = localImages;
        activeImageIndex = 0;
        renderGallery();
        return;
      }

      const query = encodeURIComponent(
        CHECKPOINT_IMAGE_QUERIES[checkpoint.name] ??
        (checkpoint.name + " Vietnam landmark")
      );

      const response = await fetch(
        "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=" +
          query +
          "&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1400&format=json&origin=*"
      );

      if (!response.ok) throw new Error("Không tải được ảnh");

      const data = (await response.json()) as {
        query?: {
          pages?: Record<string, {
            imageinfo?: Array<{
              thumburl?: string;
              url?: string;
            }>;
          }>;
        };
      };

      const pages = data.query?.pages
        ? Object.values(data.query.pages)
        : [];

      galleryImages = pages
        .map(
          (page) =>
            page.imageinfo?.[0]?.thumburl ??
            page.imageinfo?.[0]?.url
        )
        .filter(
          (url): url is string =>
            typeof url === "string" && url.length > 0
        )
        .slice(0, 3);

      if (!galleryImages.length) {
        throw new Error("Không tìm thấy ảnh");
      }

      activeImageIndex = 0;
      renderGallery();
    } catch {
      loading.textContent = "Chưa có hình ảnh cho địa danh này";
    }
  };

  const openFullGallery = () => {
    if (!galleryImages.length) {
      return;
    }

    let fullGalleryIndex = activeImageIndex;

    const lightbox = document.createElement("div");
    lightbox.style.position = "fixed";
    lightbox.style.inset = "0";
    lightbox.style.zIndex = "10000";
    lightbox.style.background = "rgba(0,0,0,.94)";
    lightbox.style.display = "flex";
    lightbox.style.flexDirection = "column";
    lightbox.style.alignItems = "center";
    lightbox.style.justifyContent = "center";
    lightbox.style.padding = "24px";

    const title = document.createElement("div");
    title.textContent = checkpoint.name;
    title.style.position = "absolute";
    title.style.top = "20px";
    title.style.left = "24px";
    title.style.color = "#fff";
    title.style.fontSize = "18px";
    title.style.fontWeight = "800";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Đóng thư viện ảnh");
    closeButton.style.position = "absolute";
    closeButton.style.top = "14px";
    closeButton.style.right = "18px";
    closeButton.style.width = "44px";
    closeButton.style.height = "44px";
    closeButton.style.border = "0";
    closeButton.style.borderRadius = "50%";
    closeButton.style.background = "rgba(255,255,255,.14)";
    closeButton.style.color = "#fff";
    closeButton.style.fontSize = "30px";
    closeButton.style.cursor = "pointer";

    const fullImage = document.createElement("img");
    fullImage.alt = checkpoint.name;
    fullImage.style.maxWidth = "min(1200px, 92vw)";
    fullImage.style.maxHeight = "72vh";
    fullImage.style.width = "auto";
    fullImage.style.height = "auto";
    fullImage.style.objectFit = "contain";
    fullImage.style.borderRadius = "12px";
    fullImage.style.boxShadow = "0 20px 70px rgba(0,0,0,.55)";

    const fullCounter = document.createElement("div");
    fullCounter.style.marginTop = "14px";
    fullCounter.style.color = "rgba(255,255,255,.82)";
    fullCounter.style.fontSize = "13px";
    fullCounter.style.fontWeight = "700";

    const fullPrevious = document.createElement("button");
    fullPrevious.type = "button";
    fullPrevious.textContent = "‹";
    fullPrevious.setAttribute("aria-label", "Ảnh trước");
    fullPrevious.style.position = "absolute";
    fullPrevious.style.left = "24px";
    fullPrevious.style.top = "50%";
    fullPrevious.style.transform = "translateY(-50%)";
    fullPrevious.style.width = "48px";
    fullPrevious.style.height = "48px";
    fullPrevious.style.border = "0";
    fullPrevious.style.borderRadius = "50%";
    fullPrevious.style.background = "rgba(255,255,255,.14)";
    fullPrevious.style.color = "#fff";
    fullPrevious.style.fontSize = "34px";
    fullPrevious.style.cursor = "pointer";

    const fullNext = document.createElement("button");
    fullNext.type = "button";
    fullNext.textContent = "›";
    fullNext.setAttribute("aria-label", "Ảnh tiếp theo");
    fullNext.style.position = "absolute";
    fullNext.style.right = "24px";
    fullNext.style.top = "50%";
    fullNext.style.transform = "translateY(-50%)";
    fullNext.style.width = "48px";
    fullNext.style.height = "48px";
    fullNext.style.border = "0";
    fullNext.style.borderRadius = "50%";
    fullNext.style.background = "rgba(255,255,255,.14)";
    fullNext.style.color = "#fff";
    fullNext.style.fontSize = "34px";
    fullNext.style.cursor = "pointer";

    const fullThumbs = document.createElement("div");
    fullThumbs.style.display = "flex";
    fullThumbs.style.gap = "8px";
    fullThumbs.style.marginTop = "16px";
    fullThumbs.style.maxWidth = "92vw";
    fullThumbs.style.overflowX = "auto";

    const renderFullGallery = () => {
      fullImage.src = galleryImages[fullGalleryIndex];
      fullCounter.textContent =
        (fullGalleryIndex + 1) + " / " + galleryImages.length;

      fullThumbs.innerHTML = "";
      galleryImages.forEach((url, index) => {
        const thumb = document.createElement("button");
        thumb.type = "button";
        thumb.style.width = "74px";
        thumb.style.height = "52px";
        thumb.style.padding = "0";
        thumb.style.flexShrink = "0";
        thumb.style.border =
          index === fullGalleryIndex
            ? "2px solid #fff"
            : "2px solid rgba(255,255,255,.28)";
        thumb.style.borderRadius = "8px";
        thumb.style.overflow = "hidden";
        thumb.style.background = "#111";
        thumb.style.cursor = "pointer";

        const img = document.createElement("img");
        img.src = url;
        img.alt = checkpoint.name + " - ảnh " + (index + 1);
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";

        thumb.appendChild(img);
        thumb.addEventListener("click", () => {
          fullGalleryIndex = index;
          renderFullGallery();
        });
        fullThumbs.appendChild(thumb);
      });
    };

    const closeFullGallery = () => {
      document.removeEventListener("keydown", onFullGalleryKeyDown);
      lightbox.remove();
    };

    const onFullGalleryKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeFullGallery();
      } else if (event.key === "ArrowLeft") {
        fullGalleryIndex =
          (fullGalleryIndex - 1 + galleryImages.length) %
          galleryImages.length;
        renderFullGallery();
      } else if (event.key === "ArrowRight") {
        fullGalleryIndex =
          (fullGalleryIndex + 1) % galleryImages.length;
        renderFullGallery();
      }
    };

    closeButton.addEventListener("click", closeFullGallery);
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) {
        closeFullGallery();
      }
    });
    fullPrevious.addEventListener("click", () => {
      fullGalleryIndex =
        (fullGalleryIndex - 1 + galleryImages.length) %
        galleryImages.length;
      renderFullGallery();
    });
    fullNext.addEventListener("click", () => {
      fullGalleryIndex =
        (fullGalleryIndex + 1) % galleryImages.length;
      renderFullGallery();
    });

    lightbox.appendChild(title);
    lightbox.appendChild(closeButton);
    lightbox.appendChild(fullPrevious);
    lightbox.appendChild(fullImage);
    lightbox.appendChild(fullNext);
    lightbox.appendChild(fullCounter);
    lightbox.appendChild(fullThumbs);
    document.body.appendChild(lightbox);

    renderFullGallery();
    document.addEventListener("keydown", onFullGalleryKeyDown);
  };

  const viewAllImagesButton = document.createElement("button");
  viewAllImagesButton.type = "button";
  viewAllImagesButton.textContent = "Xem toàn bộ hình ảnh";
  viewAllImagesButton.style.position = "absolute";
  viewAllImagesButton.style.right = "14px";
  viewAllImagesButton.style.bottom = "14px";
  viewAllImagesButton.style.padding = "9px 13px";
  viewAllImagesButton.style.border = "0";
  viewAllImagesButton.style.borderRadius = "10px";
  viewAllImagesButton.style.background = "rgba(0,0,0,.72)";
  viewAllImagesButton.style.color = "#fff";
  viewAllImagesButton.style.fontSize = "12px";
  viewAllImagesButton.style.fontWeight = "800";
  viewAllImagesButton.style.cursor = "pointer";
  viewAllImagesButton.style.backdropFilter = "blur(5px)";
  viewAllImagesButton.addEventListener("click", openFullGallery);
  imageSection.appendChild(viewAllImagesButton);

  const address = escapeHtml(details.address ?? "Chưa cập nhật địa chỉ");
  const hours = escapeHtml(details.hours ?? "Chưa cập nhật giờ mở cửa");
  const phone = escapeHtml(details.phone ?? "Chưa cập nhật");
  const website = escapeHtml(details.website ?? "Chưa cập nhật");
  const rating = details.rating !== undefined ? "⭐ " + details.rating.toFixed(1) : "⭐ Chưa có đánh giá";
  const reviewCount = details.reviewCount !== undefined ? "(" + details.reviewCount.toLocaleString("vi-VN") + " đánh giá)" : "";

  const header = document.createElement("div");
  header.style.padding = "16px 20px 16px";
  header.style.borderBottom = "1px solid #e5e7eb";
  header.style.flexShrink = "0";
  header.innerHTML =
    "<div style=\"display:flex;align-items:flex-start;gap:14px;\">" +
      "<div style=\"min-width:0;flex:1;\">" +
        "<div style=\"font-size:22px;line-height:1.2;font-weight:800;color:#111827;\">" + safeName + "</div>" +
        "<div style=\"margin-top:5px;font-size:13px;color:#667085;\">" + category + "</div>" +
        "<div style=\"margin-top:7px;font-size:13px;\"><strong style=\"color:#111827;\">" + rating + "</strong><span style=\"color:#667085;margin-left:6px;\">" + reviewCount + "</span></div>" +
      "</div>" +
      "<button data-action=\"close\" aria-label=\"Đóng\" style=\"width:40px;height:40px;border:0;border-radius:50%;background:#f3f4f6;color:#374151;font-size:22px;cursor:pointer;\">×</button>" +
    "</div>";

  const tabs = document.createElement("div");
  tabs.style.display = "grid";
  tabs.style.gridTemplateColumns = "repeat(4,1fr)";
  tabs.style.borderBottom = "1px solid #e5e7eb";
  tabs.style.flexShrink = "0";

  const body = document.createElement("div");
  body.style.overflowY = "auto";
  body.style.padding = "18px 20px 22px";

  const tabNames = ["Tổng quan", "Vé", "Bài đánh giá", "Giới thiệu"];
  const tabButtons: HTMLButtonElement[] = [];

  const infoRow = (icon: string, title: string, value: string) =>
    "<div style=\"display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #eef0f2;\">" +
      "<div style=\"width:24px;flex:0 0 24px;text-align:center;font-size:19px;\">" + icon + "</div>" +
      "<div style=\"min-width:0;\"><div style=\"font-size:11px;color:#8a9199;font-weight:700;text-transform:uppercase;letter-spacing:.03em;\">" + title + "</div>" +
      "<div style=\"margin-top:3px;font-size:14px;color:#344054;line-height:1.45;word-break:break-word;\">" + value + "</div></div>" +
    "</div>";

  const renderOverview = () => {
    body.innerHTML =
      "<div style=\"font-size:14px;line-height:1.65;color:#3c4043;\">" + safeDescription + "</div>" +
      "<div style=\"margin-top:14px;padding:12px 14px;border-radius:14px;background:#f0f9ff;color:#174e57;font-size:12px;font-weight:700;\">" + safeBadge + "</div>" +
      "<div style=\"margin-top:12px;\">" +
        infoRow("📍", "Địa chỉ", address) +
        infoRow("◷", "Giờ mở cửa", hours) +
        infoRow("📏", "Khoảng cách", escapeHtml(distanceText)) +
        infoRow("☎", "Điện thoại", phone) +
        infoRow("🌐", "Website", website) +
      "</div>" +
      "<div style=\"margin-top:14px;font-size:11px;color:#8a9199;\">Giờ mở cửa là thông tin tham khảo và có thể thay đổi theo ngày/lễ.</div>";
  };

  const renderTickets = () => {
    const price = details.price
      ? "Giá tham khảo: <strong style=\"color:#111827;\">" + escapeHtml(details.price) + "</strong>"
      : "TravelQuest chưa có dữ liệu giá vé cho checkpoint này.";
    body.innerHTML =
      "<div style=\"padding:16px;border-radius:16px;background:#f8fafc;\">" +
        "<div style=\"font-size:15px;font-weight:800;color:#111827;\">🎟️ Thông tin vé</div>" +
        "<div style=\"margin-top:8px;font-size:13px;color:#667085;line-height:1.55;\">" + price + "</div>" +
        "<div style=\"margin-top:12px;font-size:12px;color:#8a9199;\">Dữ liệu giá vé có thể được bổ sung vào checkpoint sau này.</div>" +
      "</div>";
  };

  const renderReviews = () => {
    body.innerHTML =
      "<div style=\"padding:16px;border-radius:16px;background:#f8fafc;\">" +
        "<div style=\"font-size:15px;font-weight:800;color:#111827;\">⭐ Đánh giá</div>" +
        "<div style=\"margin-top:8px;font-size:24px;font-weight:800;color:#111827;\">" + rating + "</div>" +
        "<div style=\"margin-top:4px;font-size:13px;color:#667085;\">" + (reviewCount || "Chưa có dữ liệu đánh giá") + "</div>" +
        "<div style=\"margin-top:14px;font-size:13px;color:#667085;line-height:1.55;\">Review TravelQuest sẽ hiển thị tại đây khi dữ liệu đánh giá checkpoint được tải vào.</div>" +
      "</div>";
  };

  const renderAbout = () => {
    body.innerHTML =
      "<div style=\"font-size:14px;line-height:1.65;color:#3c4043;\">" + safeDescription + "</div>" +
      "<div style=\"margin-top:14px;\">" +
        infoRow("🏷️", "Loại địa điểm", category) +
        infoRow("📍", "Tọa độ", checkpoint.latitude.toFixed(5) + ", " + checkpoint.longitude.toFixed(5)) +
        infoRow("🎯", "Bán kính check-in", CHECKIN_RADIUS + "m") +
      "</div>";
  };

  tabNames.forEach((name, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name;
    button.style.border = "0";
    button.style.background = "transparent";
    button.style.padding = "13px 6px";
    button.style.fontSize = "13px";
    button.style.fontWeight = index === 0 ? "800" : "600";
    button.style.color = index === 0 ? "#00897b" : "#667085";
    button.style.cursor = "pointer";
    button.style.borderBottom = index === 0 ? "3px solid #00897b" : "3px solid transparent";
    button.addEventListener("click", () => {
      tabButtons.forEach((tab, tabIndex) => {
        tab.style.fontWeight = tabIndex === index ? "800" : "600";
        tab.style.color = tabIndex === index ? "#00897b" : "#667085";
        tab.style.borderBottom = tabIndex === index ? "3px solid #00897b" : "3px solid transparent";
      });
      if (index === 0) renderOverview();
      if (index === 1) renderTickets();
      if (index === 2) renderReviews();
      if (index === 3) renderAbout();
    });
    tabButtons.push(button);
    tabs.appendChild(button);
  });

  const actions = document.createElement("div");
  actions.style.display = "grid";
  actions.style.gridTemplateColumns = "repeat(5,minmax(0,1fr))";
  actions.style.gap = "8px";
  actions.style.padding = "14px 20px";
  actions.style.borderBottom = "1px solid #e5e7eb";
  actions.style.flexShrink = "0";

  const makeAction = (icon: string, label: string, action: () => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.style.border = "0";
    button.style.background = "transparent";
    button.style.cursor = "pointer";
    button.style.padding = "0";
    button.innerHTML =
      "<span style=\"display:flex;width:42px;height:42px;margin:auto;border-radius:50%;align-items:center;justify-content:center;background:#e0f5f5;color:#007c91;font-size:19px;\">" + icon + "</span>" +
      "<span style=\"display:block;margin-top:6px;font-size:11px;font-weight:700;color:#174e57;\">" + label + "</span>";
    button.addEventListener("click", action);
    return button;
  };

  const savedKey = "travelquest-saved-places";
  const saveButton = makeAction("♡", "Lưu", () => {
    try {
      const raw = window.localStorage.getItem(savedKey);
      const ids = raw ? JSON.parse(raw) : [];
      const current = Array.isArray(ids) ? ids.filter((id): id is number => typeof id === "number") : [];
      const saved = current.includes(checkpoint.id);
      const next = saved ? current.filter((id) => id !== checkpoint.id) : [...current, checkpoint.id];
      window.localStorage.setItem(savedKey, JSON.stringify(next));
      const icon = saveButton.querySelector("span");
      const label = saveButton.querySelectorAll("span")[1];
      if (icon) {
        icon.style.background = next.includes(checkpoint.id) ? "#00897b" : "#e0f5f5";
        icon.style.color = next.includes(checkpoint.id) ? "white" : "#007c91";
        icon.textContent = next.includes(checkpoint.id) ? "♥" : "♡";
      }
      if (label) label.textContent = next.includes(checkpoint.id) ? "Đã lưu" : "Lưu";
    } catch {
      // Ignore localStorage failures.
    }
  });

  const actionButtons = [
    makeAction("➤", "Đường đi", () => {
      if (userLocation) {
        mapInstance.fitBounds(
          [[userLocation.longitude, userLocation.latitude], [checkpoint.longitude, checkpoint.latitude]],
          { padding: 90, maxZoom: 15, duration: 900 }
        );
      } else {
        mapInstance.flyTo({ center: [checkpoint.longitude, checkpoint.latitude], zoom: 15, duration: 900 });
      }
    }),
    saveButton,
    makeAction("◎", "Gần đó", () => {
      mapInstance.flyTo({ center: [checkpoint.longitude, checkpoint.latitude], zoom: 16, duration: 900 });
    }),
    makeAction("☎", "Gọi điện", () => {
      if (details.phone) window.location.href = "tel:" + details.phone.replace(/[^\d+]/g, "");
    }),
    makeAction("⌯", "Chia sẻ", async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title: checkpoint.name, text: checkpoint.name + " · TravelQuest", url: window.location.href });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(window.location.href);
          window.alert("Đã sao chép liên kết TravelQuest.");
        }
      } catch {
        // User cancelled sharing.
      }
    }),
  ];
  actionButtons.forEach((button) => actions.appendChild(button));

  renderOverview();
  card.appendChild(imageSection);
  card.appendChild(header);
  card.appendChild(tabs);
  card.appendChild(actions);
  card.appendChild(body);
  overlay.appendChild(card);
  void loadCheckpointImages();

  const close = () => {
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };

  header.querySelector<HTMLButtonElement>("[data-action=\"close\"]")?.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", onKeyDown);

  return overlay;
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

      const details = CHECKPOINT_DETAILS[checkpoint.name] ?? {
        category: "Địa danh TravelQuest",
      };

      const openDetailsModal = () => {
        const existingModal = document.querySelector(
          "[data-travelquest-checkpoint-modal=\"true\"]"
        );

        if (existingModal) existingModal.remove();

        const overlay = createCheckpointDetailsModal({
          checkpoint,
          details,
          distanceText,
          mapInstance,
          userLocation,
          onClose: () => undefined,
        });

        overlay.dataset.travelquestCheckpointModal = "true";
        document.body.appendChild(overlay);
      };

      markerElement.addEventListener("click", openDetailsModal);

      return new mapboxgl.Marker({
        element: markerElement,
        anchor: "center",
      })
        .setLngLat([
          checkpoint.longitude,
          checkpoint.latitude,
        ])
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
          distance < nearestDistance
        ) {
          nearestDistance = distance;
          nearestCheckpoint = checkpoint;
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