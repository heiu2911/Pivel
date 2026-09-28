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

type FriendLocation = {
  user_id: string;
  latitude: number;
  longitude: number;
  display_name: string;
  level: number;
  xp: number;
  avatar_url?: string | null;
};

type MapProps = {
  userLocation?: UserLocation | null;
  checkpoints?: Checkpoint[];
  avatarUrl?: string | null;
  avatarEmoji?: string;
  friendLocations?: FriendLocation[];
  showCheckpoints?: boolean;
  onFriendMarkerClick?: (userId: string) => void;
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

const CITY_IMAGE_QUERIES: Record<string, string> = {
  "ha-noi": "Hanoi Vietnam",
  "ha-long": "Ha Long Vietnam",
  "ninh-binh": "Ninh Binh Vietnam",
  "hue": "Hue Vietnam",
  "da-nang": "Da Nang Vietnam",
  "phong-nha": "Phong Nha Vietnam",
  "cao-bang": "Cao Bang Vietnam",
  "sapa": "Sapa Vietnam",
  "nha-trang": "Nha Trang Vietnam",
  "ho-chi-minh": "Ho Chi Minh City Vietnam",
  "tay-ninh": "Tay Ninh Vietnam",
  "can-tho": "Can Tho Vietnam",
  "da-lat": "Da Lat Vietnam",
};

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
  "Miếu ông Trường (con)": [
    "/checkpoints/mieu-ong-truong-con.webp",
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
  "Miếu ông Trường (con)": "Miếu ông Trường con Hải Phòng Vietnam",
};

const CHECKPOINT_DETAILS: Record<string, CheckpointDetails> = {
  "Hồ Hoàn Kiếm": {
    category: "Hồ / Danh thắng đô thị",
    address: "Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội",
    hours: "Mở 24 giờ",
    website: "hanoi.gov.vn",
  },
  "Văn Miếu - Quốc Tử Giám": {
    category: "Di tích lịch sử - văn hóa",
    address: "58 Quốc Tử Giám, phường Văn Miếu - Quốc Tử Giám, Hà Nội",
    rating: 4.6,
    reviewCount: 24945,
    hours: "08:00–17:00; tour đêm 18:30–22:00 Thứ 4, Thứ 7, Chủ nhật",
    phone: "+84 24 3747 2566",
    website: "vanmieu.gov.vn",
    price: "70.000đ/người lớn; 35.000đ vé ưu tiên; miễn phí trẻ em dưới 16 tuổi",
  },
  "Hoàng thành Thăng Long": {
    category: "Di sản văn hóa thế giới / Di tích lịch sử",
    address: "19C Hoàng Diệu, phường Ba Đình, Hà Nội",
    hours: "08:00–17:00 tất cả các ngày",
    phone: "+84 24 3734 5427",
    website: "hoangthanhthanglong.vn",
    price: "Xem giá vé hiện hành trên website chính thức",
  },
  "Lăng Chủ tịch Hồ Chí Minh": {
    category: "Di tích lịch sử",
    address: "Quảng trường Ba Đình, Ba Đình, Hà Nội",
    hours: "Lịch viếng thay đổi theo mùa và ngày; kiểm tra thông báo trước khi đi",
    website: "baotanghochiminh.vn",
  },
  "Vịnh Hạ Long": {
    category: "Di sản thiên nhiên thế giới / Vịnh biển",
    address: "Thành phố Hạ Long, Quảng Ninh",
    hours: "Theo lịch tàu và cảng; nên kiểm tra trước chuyến đi",
    website: "halongbay.com.vn",
  },
  "Yên Tử": {
    category: "Danh thắng / Quần thể di tích tâm linh",
    address: "Khu di tích và danh thắng Yên Tử, Quảng Ninh",
    hours: "Theo lịch vận hành cáp treo và khu di tích",
    website: "yentutunglam.vn",
  },
  "Quần thể Tràng An": {
    category: "Di sản văn hóa và thiên nhiên thế giới",
    address: "Hoa Lư, Ninh Bình",
    hours: "07:00–18:00",
    website: "trangandanhthang.vn",
  },
  "Hang Múa": {
    category: "Danh thắng / Điểm ngắm cảnh",
    address: "Thôn Khê Đầu Hạ, Hoa Lư, Ninh Bình",
    hours: "06:00–19:00",
    phone: "+84 378 699 330",
    price: "Từ khoảng 100.000đ/người; có thể thay đổi",
  },
  "Chùa Bái Đính": {
    category: "Quần thể chùa / Điểm du lịch tâm linh",
    address: "Xóm 6, Tây Hoa Lư, Ninh Bình",
    rating: 4.8,
    reviewCount: 25290,
    hours: "06:00–21:00",
    phone: "+84 913 899 135",
    website: "chuabaidinhninhbinh.vn",
  },
  "Đại Nội Huế": {
    category: "Di tích lịch sử - văn hóa / Di sản thế giới",
    address: "Đường 23/8, phường Phú Xuân, thành phố Huế",
    hours: "Mùa hè 06:30–17:30; mùa đông 07:00–17:00",
    website: "hue.gov.vn",
  },
  "Chùa Thiên Mụ": {
    category: "Chùa / Di tích lịch sử - văn hóa",
    address: "Đường Nguyễn Phúc Nguyên, phường Kim Long, Huế",
    rating: 4.6,
    reviewCount: 20027,
    hours: "07:00–17:30",
  },
  "Cầu Rồng Đà Nẵng": {
    category: "Cầu / Biểu tượng kiến trúc Đà Nẵng",
    address: "Cầu Rồng, An Hải, Đà Nẵng",
    rating: 4.5,
    reviewCount: 9488,
    hours: "Mở 24 giờ",
    website: "visitdanang.travel",
  },
  "Cầu Vàng Bà Nà Hills": {
    category: "Điểm tham quan / Công trình kiến trúc",
    address: "Khu du lịch Sun World Bà Nà Hills, Hòa Vang, Đà Nẵng",
    rating: 4.6,
    hours: "Khu du lịch 08:00–22:00; lịch cáp treo có thể khác",
    phone: "+84 866 311 186",
    website: "sunworldsbanahills.com",
  },
  "Ngũ Hành Sơn": {
    category: "Danh thắng / Quần thể núi đá",
    address: "81 Huyền Trân Công Chúa, Ngũ Hành Sơn, Đà Nẵng",
    hours: "07:00–17:30",
    phone: "+84 236 396 1114",
    website: "nguhanhson.org",
  },
  "Phong Nha": {
    category: "Hang động / Di sản thiên nhiên",
    address: "Trung tâm Du lịch Phong Nha, Phong Nha, Quảng Trị",
    hours: "07:00–18:00; giờ bán vé có thể kết thúc sớm hơn",
    phone: "+84 918 841 455",
    website: "phongnhatourism.com.vn",
  },
  "Thác Bản Giốc": {
    category: "Danh thắng tự nhiên / Thác nước",
    address: "Xã Đàm Thủy, Trùng Khánh, Cao Bằng",
    hours: "Khoảng 07:00–18:00; có thể thay đổi theo mùa",
    website: "caobangtourism.vn",
  },
  "Nhà thờ Đá Sa Pa": {
    category: "Nhà thờ / Điểm tham quan",
    address: "Trung tâm Sa Pa, Lào Cai",
    hours: "Khuôn viên mở; giờ vào bên trong thay đổi theo lịch lễ",
  },
  "Tháp Bà Ponagar": {
    category: "Di sản văn hóa Chăm",
    address: "2 Tháng 4, Vĩnh Phước, Nha Trang, Khánh Hòa",
    rating: 4.3,
    reviewCount: 4842,
    hours: "06:00–17:30",
    phone: "+84 58 382 4525",
    website: "vanhoacham.khanhhoa.gov.vn",
  },
  "Dinh Độc Lập": {
    category: "Di tích lịch sử quốc gia đặc biệt",
    address: "135 Nam Kỳ Khởi Nghĩa, phường Bến Thành, TP. Hồ Chí Minh",
    rating: 4.5,
    hours: "07:00–18:00",
    phone: "+84 28 3822 3652",
    website: "dinhdoclap.gov.vn",
    price: "80.000đ người lớn; 40.000đ sinh viên/người cao tuổi; 20.000đ trẻ em 6–17 tuổi",
  },
  "Núi Bà Đen": {
    category: "Núi / Khu du lịch tâm linh",
    address: "Khu phố Ninh Phú, phường Bình Minh, tỉnh Tây Ninh",
    hours: "Thứ 2–6: 06:00–20:00; Thứ 7, CN & lễ: 05:30–21:00",
    phone: "1800 1000",
    website: "sunworld.vn/vi/ba-den",
  },
  "Chợ nổi Cái Răng": {
    category: "Chợ nổi / Di sản văn hóa phi vật thể",
    address: "Sông Cái Răng, Cần Thơ",
    hours: "Khung giờ nhộn nhịp nhất khoảng 05:00–07:30; chợ hoạt động buổi sáng",
    phone: "+84 292 625 2527",
    website: "dulichthongminhcantho.com",
    price: "Giá thuyền/tour thay đổi theo loại tàu và số khách",
  },
  "Thác Datanla": {
    category: "Thác nước / Khu du lịch",
    address: "Đèo Prenn, phường 3, Đà Lạt, Lâm Đồng",
    hours: "07:00–17:00",
    phone: "+84 981 166 088",
    website: "dalat.vn",
    price: "Khoảng 30.000đ; dịch vụ vui chơi có giá riêng",
  },
  "Miếu ông Trường (con)": {
    category: "Miếu / Điểm tín ngưỡng địa phương",
    address: "Miếu ông Trường (con), Hải Phòng",
    hours: "Mở cửa theo thời gian sinh hoạt tại địa phương",
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

function ensureGpsMarkerStyles(): void {
  if (typeof document === "undefined") return;
  const styleId = "travelquest-gps-marker-styles";
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @keyframes tq-radar-pulse {
      0% {
        transform: scale(0.85);
        opacity: 0.9;
      }
      70% {
        transform: scale(2.2);
        opacity: 0;
      }
      100% {
        transform: scale(2.4);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

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
  getLatestUserLocation,
  onClose,
}: {
  checkpoint: Checkpoint;
  details: CheckpointDetails;
  distanceText: string;
  mapInstance: mapboxgl.Map;
  userLocation: UserLocation | null;
  getLatestUserLocation?: () => UserLocation | null;
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

  const clearRouteFromMap = () => {
    const routeLayerId = "travelquest-route-line";
    const routeSourceId = "travelquest-route-source";

    if (!mapInstance || !mapInstance.isStyleLoaded()) return;

    if (mapInstance.getLayer(routeLayerId)) {
      mapInstance.removeLayer(routeLayerId);
    }

    if (mapInstance.getSource(routeSourceId)) {
      mapInstance.removeSource(routeSourceId);
    }
  };

  const formatRouteDistance = (meters: number) =>
    meters < 1000
      ? Math.round(meters) + " m"
      : (meters / 1000).toFixed(1) + " km";

  const formatRouteDuration = (seconds: number) => {
    const minutes = Math.max(1, Math.round(seconds / 60));
    if (minutes < 60) return minutes + " phút";
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining ? hours + " giờ " + remaining + " phút" : hours + " giờ";
  };

  const openDirectionsPanel = () => {
    const existing = document.querySelector("[data-travelquest-directions='true']");
    if (existing) existing.remove();

    const panel = document.createElement("div");
    panel.dataset.travelquestDirections = "true";
    panel.style.position = "fixed";
    panel.style.inset = "0";
    panel.style.zIndex = "10001";
    panel.style.background = "rgba(3,12,24,.58)";
    panel.style.backdropFilter = "blur(3px)";
    panel.style.display = "flex";
    panel.style.alignItems = "flex-start";
    panel.style.justifyContent = "center";
    panel.style.padding = "22px";

    const sheet = document.createElement("div");
    sheet.style.width = "min(560px, calc(100vw - 28px))";
    sheet.style.maxHeight = "calc(100vh - 44px)";
    sheet.style.overflow = "hidden";
    sheet.style.background = "#fff";
    sheet.style.borderRadius = "22px";
    sheet.style.boxShadow = "0 24px 80px rgba(0,0,0,.45)";
    sheet.style.display = "flex";
    sheet.style.flexDirection = "column";
    sheet.style.fontFamily = "system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";

    const head = document.createElement("div");
    head.style.padding = "18px 20px 14px";
    head.style.borderBottom = "1px solid #e5e7eb";
    head.innerHTML =
      "<div style='font-size:11px;color:#8a9199;font-weight:800;text-transform:uppercase'>Chỉ đường</div>" +
      "<div style='margin-top:4px;font-size:19px;font-weight:850;color:#111827'>" +
      escapeHtml(checkpoint.name) +
      "</div>" +
      "<div style='margin-top:4px;font-size:12px;color:#667085'>Từ vị trí hiện tại của bạn → địa danh</div>";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Đóng chỉ đường");
    closeButton.style.position = "absolute";
    closeButton.style.right = "30px";
    closeButton.style.top = "28px";
    closeButton.style.width = "38px";
    closeButton.style.height = "38px";
    closeButton.style.border = "0";
    closeButton.style.borderRadius = "50%";
    closeButton.style.background = "#f3f4f6";
    closeButton.style.fontSize = "24px";
    closeButton.style.cursor = "pointer";

    const modes = document.createElement("div");
    modes.style.display = "grid";
    modes.style.gridTemplateColumns = "repeat(3,1fr)";
    modes.style.gap = "8px";
    modes.style.padding = "12px 16px";
    modes.style.borderBottom = "1px solid #e5e7eb";

    const result = document.createElement("div");
    result.style.overflowY = "auto";
    result.style.padding = "16px";

    const modeConfig = [
      { key: "walking", label: "🚶 Đi bộ", profile: "walking", note: "Ưu tiên đường đi bộ" },
      { key: "motorcycle", label: "🏍️ Xe máy", profile: "driving", note: "Tuyến đường xe máy theo mạng đường bộ" },
      { key: "car", label: "🚗 Ô tô", profile: "driving-traffic", note: "Tuyến ô tô có thể dùng dữ liệu giao thông" },
    ] as const;

    let activeMode: (typeof modeConfig)[number]["key"] = "motorcycle";
    let routeRequestId = 0;

    type CachedRoute = {
      origin: UserLocation;
      route: {
        distance: number;
        duration: number;
        geometry?: {
          type: "LineString";
          coordinates: [number, number][];
        };
        legs?: Array<{
          steps?: Array<{
            distance: number;
            duration: number;
            name?: string;
            maneuver?: { instruction?: string };
          }>;
        }>;
      };
    };

    const routeCache = new globalThis.Map<
      (typeof modeConfig)[number]["key"],
      CachedRoute
    >();

    const sameOrigin = (
      a: UserLocation,
      b: UserLocation
    ) =>
      Math.abs(a.latitude - b.latitude) < 0.0005 &&
      Math.abs(a.longitude - b.longitude) < 0.0005;

    const googleMapsButton = document.createElement("button");
    googleMapsButton.type = "button";
    googleMapsButton.textContent = "Mở chỉ đường Google Maps";
    googleMapsButton.style.width = "100%";
    googleMapsButton.style.marginTop = "12px";
    googleMapsButton.style.padding = "12px 14px";
    googleMapsButton.style.border = "1px solid #dbe3ea";
    googleMapsButton.style.borderRadius = "12px";
    googleMapsButton.style.background = "#fff";
    googleMapsButton.style.color = "#174e57";
    googleMapsButton.style.fontWeight = "800";
    googleMapsButton.style.cursor = "pointer";

    let closePanel = () => {
      routeRequestId += 1;
      stopNavigationTracking();
      removeNavigationControl();
      removeNavigationHud();
      panel.remove();
      clearRouteFromMap();
    };

    const getOrigin = async (): Promise<UserLocation> => {
      const liveLocation = getLatestUserLocation?.() ?? userLocation;

      if (
        liveLocation &&
        isValidCoordinate(
          liveLocation.latitude,
          liveLocation.longitude
        )
      ) {
        return liveLocation;
      }

      if (userLocation && isValidCoordinate(userLocation.latitude, userLocation.longitude)) {
        return userLocation;
      }

      if (!navigator.geolocation) {
        throw new Error("Thiết bị không hỗ trợ GPS.");
      }

      return await new Promise<UserLocation>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
          () => reject(new Error("Không lấy được vị trí hiện tại. Hãy cho phép GPS để xem đường đi.")),
          {
            enableHighAccuracy: false,
            timeout: 4000,
            maximumAge: 30000,
          }
        );
      });
    };

    let navigationWatchId: number | null = null;
    let lastRerouteLocation: UserLocation | null = null;
    let lastRerouteAt = 0;
    let latestOrigin: UserLocation | null = null;
    let isInitialRoute = true;
    let navigationControl: HTMLDivElement | null = null;
    let navigationHud: HTMLDivElement | null = null;
    let navigationHudInstruction = "";
    let navigationHudMode = "";

    const getNavigationInstruction = (route: {
      legs?: Array<{
        steps?: Array<{
          name?: string;
          maneuver?: { instruction?: string };
        }>;
      }>;
    }) => {
      const firstStep = route.legs?.[0]?.steps?.find(
        (step) => step.maneuver?.instruction || step.name
      );
      return (
        firstStep?.maneuver?.instruction ||
        (firstStep?.name
          ? "Đi theo " + firstStep.name
          : "Tiếp tục theo tuyến đường")
      );
    };

    const getArrivalTime = (seconds: number) => {
      const arrival = new Date(Date.now() + Math.max(0, seconds) * 1000);
      return arrival.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    const removeNavigationHud = () => {
      navigationHud?.remove();
      navigationHud = null;
      navigationHudInstruction = "";
      navigationHudMode = "";
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };

    const showNavigationHud = (
      route: {
        distance: number;
        duration: number;
        legs?: Array<{
          steps?: Array<{
            name?: string;
            maneuver?: { instruction?: string };
          }>;
        }>;
      },
      mode: (typeof modeConfig)[number]
    ) => {
      const instruction = getNavigationInstruction(route);
      navigationHudInstruction = instruction;
      navigationHudMode = mode.label;

      if (navigationHud) {
        const topInstruction = navigationHud.querySelector(
          "[data-tq-nav-instruction]"
        ) as HTMLElement | null;
        const modeLabel = navigationHud.querySelector(
          "[data-tq-nav-mode]"
        ) as HTMLElement | null;
        const summary = navigationHud.querySelector(
          "[data-tq-nav-summary]"
        ) as HTMLElement | null;
        const eta = navigationHud.querySelector(
          "[data-tq-nav-eta]"
        ) as HTMLElement | null;

        if (topInstruction) topInstruction.textContent = instruction;
        if (modeLabel) modeLabel.textContent = mode.label + " · đang chỉ đường";
        if (summary) {
          summary.textContent =
            formatRouteDuration(route.duration) +
            " · " +
            formatRouteDistance(route.distance);
        }
        if (eta) {
          eta.textContent = "Dự kiến đến " + getArrivalTime(route.duration);
        }
        return;
      }

      const hud = document.createElement("div");
      hud.dataset.travelquestNavigationHud = "true";
      hud.style.position = "fixed";
      hud.style.inset = "0";
      hud.style.zIndex = "10000";
      hud.style.pointerEvents = "none";
      hud.style.fontFamily =
        "system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";

      const top = document.createElement("div");
      top.style.position = "absolute";
      top.style.top = "max(18px, env(safe-area-inset-top))";
      top.style.left = "12px";
      top.style.right = "12px";
      top.style.padding = "14px 16px";
      top.style.borderRadius = "18px";
      top.style.background = "linear-gradient(135deg,#0b6b57,#087f67)";
      top.style.border = "3px solid rgba(255,255,255,.96)";
      top.style.boxShadow = "0 12px 32px rgba(0,0,0,.35)";
      top.style.color = "#fff";
      top.style.pointerEvents = "auto";

      const modeLabel = document.createElement("div");
      modeLabel.dataset.tqNavMode = "true";
      modeLabel.textContent = mode.label + " · đang chỉ đường";
      modeLabel.style.fontSize = "11px";
      modeLabel.style.fontWeight = "800";
      modeLabel.style.opacity = ".88";
      modeLabel.style.marginBottom = "4px";

      const instructionRow = document.createElement("div");
      instructionRow.style.display = "flex";
      instructionRow.style.alignItems = "center";
      instructionRow.style.gap = "10px";

      const arrow = document.createElement("div");
      arrow.textContent = "↑";
      arrow.style.fontSize = "32px";
      arrow.style.fontWeight = "900";
      arrow.style.lineHeight = "1";

      const instructionText = document.createElement("div");
      instructionText.dataset.tqNavInstruction = "true";
      instructionText.textContent = instruction;
      instructionText.style.fontSize = "20px";
      instructionText.style.fontWeight = "900";
      instructionText.style.lineHeight = "1.15";
      instructionText.style.flex = "1";

      instructionRow.appendChild(arrow);
      instructionRow.appendChild(instructionText);

      const after = document.createElement("div");
      after.textContent = "Tiếp tục theo tuyến đường";
      after.style.marginTop = "8px";
      after.style.padding = "7px 10px";
      after.style.width = "fit-content";
      after.style.borderRadius = "10px";
      after.style.background = "rgba(0,0,0,.18)";
      after.style.fontSize = "12px";
      after.style.fontWeight = "800";

      top.appendChild(modeLabel);
      top.appendChild(instructionRow);
      top.appendChild(after);

      const speaker = document.createElement("button");
      speaker.type = "button";
      speaker.textContent = "🔊";
      speaker.title = "Đọc hướng dẫn";
      speaker.setAttribute("aria-label", "Đọc hướng dẫn");
      speaker.style.position = "absolute";
      speaker.style.right = "18px";
      speaker.style.top = "132px";
      speaker.style.width = "48px";
      speaker.style.height = "48px";
      speaker.style.border = "1px solid rgba(255,255,255,.65)";
      speaker.style.borderRadius = "50%";
      speaker.style.background = "rgba(15,23,42,.78)";
      speaker.style.color = "#fff";
      speaker.style.fontSize = "20px";
      speaker.style.cursor = "pointer";
      speaker.style.pointerEvents = "auto";
      speaker.onclick = () => {
        if (!("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(
          navigationHudInstruction
        );
        utterance.lang = "vi-VN";
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      };

      const recenter = document.createElement("button");
      recenter.type = "button";
      recenter.textContent = "⌾  Về giữa";
      recenter.style.position = "absolute";
      recenter.style.left = "16px";
      recenter.style.bottom = "112px";
      recenter.style.padding = "11px 14px";
      recenter.style.border = "1px solid rgba(255,255,255,.28)";
      recenter.style.borderRadius = "999px";
      recenter.style.background = "rgba(15,23,42,.82)";
      recenter.style.color = "#fff";
      recenter.style.fontWeight = "800";
      recenter.style.fontSize = "12px";
      recenter.style.cursor = "pointer";
      recenter.style.pointerEvents = "auto";
      recenter.onclick = () => {
        const origin = latestOrigin ?? getLatestUserLocation?.() ?? userLocation;
        if (!origin) return;
        mapInstance.flyTo({
          center: [origin.longitude, origin.latitude],
          zoom: 16,
          duration: 700,
          essential: true,
        });
      };

      const bottom = document.createElement("div");
      bottom.style.position = "absolute";
      bottom.style.left = "12px";
      bottom.style.right = "12px";
      bottom.style.bottom = "max(12px, env(safe-area-inset-bottom))";
      bottom.style.padding = "16px";
      bottom.style.borderRadius = "22px";
      bottom.style.background = "rgba(255,255,255,.96)";
      bottom.style.boxShadow = "0 14px 40px rgba(0,0,0,.35)";
      bottom.style.display = "flex";
      bottom.style.alignItems = "center";
      bottom.style.gap = "12px";
      bottom.style.pointerEvents = "auto";

      const stats = document.createElement("div");
      stats.style.minWidth = "0";
      stats.style.flex = "1";

      const big = document.createElement("div");
      big.dataset.tqNavSummary = "true";
      big.textContent =
        formatRouteDuration(route.duration) +
        " · " +
        formatRouteDistance(route.distance);
      big.style.fontSize = "22px";
      big.style.fontWeight = "900";
      big.style.color = "#111827";

      const eta = document.createElement("div");
      eta.dataset.tqNavEta = "true";
      eta.textContent = "Dự kiến đến " + getArrivalTime(route.duration);
      eta.style.marginTop = "4px";
      eta.style.fontSize = "13px";
      eta.style.color = "#667085";

      stats.appendChild(big);
      stats.appendChild(eta);

      const stop = document.createElement("button");
      stop.type = "button";
      stop.textContent = "STOP";
      stop.style.width = "64px";
      stop.style.height = "64px";
      stop.style.flex = "0 0 64px";
      stop.style.border = "4px solid rgba(255,255,255,.72)";
      stop.style.borderRadius = "50%";
      stop.style.background = "#ef4444";
      stop.style.color = "#fff";
      stop.style.fontSize = "13px";
      stop.style.fontWeight = "950";
      stop.style.cursor = "pointer";
      stop.style.boxShadow = "0 5px 14px rgba(239,68,68,.4)";
      stop.onclick = () => {
        routeRequestId += 1;
        stopNavigationTracking();
        removeNavigationControl();
        removeNavigationHud();
        clearRouteFromMap();
        panel.remove();
      };

      bottom.appendChild(stats);
      bottom.appendChild(stop);

      hud.appendChild(top);
      hud.appendChild(speaker);
      hud.appendChild(recenter);
      hud.appendChild(bottom);
      document.body.appendChild(hud);
      navigationHud = hud;
    };

    const stopNavigationTracking = () => {
      if (navigationWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(navigationWatchId);
        navigationWatchId = null;
      }

      lastRerouteLocation = null;
      lastRerouteAt = 0;
    };

    const removeNavigationControl = () => {
      if (navigationControl) {
        navigationControl.remove();
        navigationControl = null;
      }
    };

    const showNavigationControl = (
      mode: (typeof modeConfig)[number]
    ) => {
      removeNavigationControl();

      const control = document.createElement("div");
      control.dataset.travelquestNavigationControl = "true";
      control.style.position = "fixed";
      control.style.left = "16px";
      control.style.top = "76px";
      control.style.zIndex = "9000";
      control.style.display = "flex";
      control.style.alignItems = "center";
      control.style.gap = "8px";
      control.style.padding = "8px 10px 8px 12px";
      control.style.borderRadius = "999px";
      control.style.background = "rgba(255,255,255,.96)";
      control.style.boxShadow = "0 8px 28px rgba(0,0,0,.22)";
      control.style.border = "1px solid rgba(15,23,42,.08)";
      control.style.fontFamily = "system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";

      const status = document.createElement("div");
      status.textContent = "📍 " + mode.label + " · đang chỉ đường";
      status.style.color = "#174e57";
      status.style.fontSize = "12px";
      status.style.fontWeight = "800";

      const stopButton = document.createElement("button");
      stopButton.type = "button";
      stopButton.textContent = "Dừng";
      stopButton.style.border = "0";
      stopButton.style.borderRadius = "999px";
      stopButton.style.padding = "7px 10px";
      stopButton.style.background = "#eef2f4";
      stopButton.style.color = "#344054";
      stopButton.style.fontSize = "12px";
      stopButton.style.fontWeight = "800";
      stopButton.style.cursor = "pointer";

      stopButton.addEventListener("click", () => {
        stopNavigationTracking();
        routeRequestId += 1;
        clearRouteFromMap();
        removeNavigationControl();
        removeNavigationHud();
      });

      control.appendChild(status);
      control.appendChild(stopButton);
      document.body.appendChild(control);
      navigationControl = control;
    };

    const renderRouteResult = (
      route: {
        distance: number;
        duration: number;
        geometry?: {
          type: "LineString";
          coordinates: [number, number][];
        };
        legs?: Array<{
          steps?: Array<{
            distance: number;
            duration: number;
            name?: string;
            maneuver?: { instruction?: string };
          }>;
        }>;
      },
      mode: (typeof modeConfig)[number],
      isLiveUpdate: boolean
    ) => {
      if (!route.geometry?.coordinates?.length) {
        throw new Error("Không tìm thấy tuyến đường phù hợp.");
      }

      clearRouteFromMap();

      showNavigationHud(route, mode);

      mapInstance.addSource("travelquest-route-source", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: route.geometry,
        },
      });

      mapInstance.addLayer({
        id: "travelquest-route-line",
        type: "line",
        source: "travelquest-route-source",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#1da1f2",
          "line-width": 7,
          "line-opacity": 0.92,
        },
      });

      if (!isLiveUpdate || isInitialRoute) {
        const bounds = new mapboxgl.LngLatBounds();

        route.geometry.coordinates.forEach(([lng, lat]) => {
          bounds.extend([lng, lat]);
        });

        mapInstance.fitBounds(bounds, {
          padding: 100,
          maxZoom: 16,
          duration: 900,
        });

        isInitialRoute = false;
      }

      const steps =
        route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];

      const stepHtml = steps
        .slice(0, 12)
        .map(
          (step, index) =>
            "<div style='display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #eef0f2'>" +
            "<div style='width:24px;height:24px;border-radius:50%;background:#e0f5f5;color:#007c91;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800'>" +
            (index + 1) +
            "</div><div style='flex:1;font-size:12px;line-height:1.45;color:#374151'>" +
            escapeHtml(
              step.maneuver?.instruction ??
                (step.name || "Tiếp tục theo tuyến đường")
            ) +
            "<div style='margin-top:2px;color:#8a9199'>" +
            formatRouteDistance(step.distance) +
            " · " +
            formatRouteDuration(step.duration) +
            "</div></div></div>"
        )
        .join("");

      const liveText = isLiveUpdate
        ? " · GPS đã cập nhật"
        : "";

      result.innerHTML =
        "<div style='display:flex;gap:8px;align-items:center;flex-wrap:wrap'>" +
        "<div style='font-size:22px;font-weight:900;color:#111827'>" +
        formatRouteDuration(route.duration) +
        "</div>" +
        "<div style='color:#667085;font-size:13px'>· " +
        formatRouteDistance(route.distance) +
        liveText +
        "</div></div>" +
        "<div style='margin-top:6px;color:#667085;font-size:12px'>" +
        escapeHtml(mode.note) +
        "</div>" +
        "<div style='margin-top:10px;padding:9px 11px;border-radius:10px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:700'>" +
        "📍 Đang chỉ đường trực tiếp trên bản đồ TravelQuest" +
        "</div>" +
        "<div style='margin-top:14px;font-size:13px;font-weight:800;color:#111827'>Các bước chỉ đường</div>" +
        (stepHtml ||
          "<div style='margin-top:8px;color:#667085'>Không có hướng dẫn chi tiết.</div>");

      const googleTravelMode =
        mode.key === "walking"
          ? "walking"
          : mode.key === "motorcycle"
            ? "two-wheeler"
            : "driving";

      googleMapsButton.onclick = () => {
        if (!latestOrigin) return;

        const url =
          "https://www.google.com/maps/dir/?api=1&origin=" +
          encodeURIComponent(
            latestOrigin.latitude + "," + latestOrigin.longitude
          ) +
          "&destination=" +
          encodeURIComponent(
            checkpoint.latitude + "," + checkpoint.longitude
          ) +
          "&travelmode=" +
          googleTravelMode;

        window.open(url, "_blank", "noopener,noreferrer");
      };
    };

    const fetchAndDrawRoute = async (
      mode: (typeof modeConfig)[number],
      origin: UserLocation,
      requestId: number,
      isLiveUpdate: boolean
    ) => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

      if (!token) {
        throw new Error("Thiếu NEXT_PUBLIC_MAPBOX_TOKEN.");
      }

      const coordinates =
        origin.longitude +
        "," +
        origin.latitude +
        ";" +
        checkpoint.longitude +
        "," +
        checkpoint.latitude;

      const response = await fetch(
        "https://api.mapbox.com/directions/v5/mapbox/" +
          mode.profile +
          "/" +
          coordinates +
          "?alternatives=false&overview=full&geometries=geojson&steps=true&language=vi&access_token=" +
          encodeURIComponent(token)
      );

      if (!response.ok) {
        throw new Error("Không thể lấy tuyến đường từ Mapbox.");
      }

      const data = (await response.json()) as {
        code?: string;
        routes?: Array<{
          distance: number;
          duration: number;
          geometry?: {
            type: "LineString";
            coordinates: [number, number][];
          };
          legs?: Array<{
            steps?: Array<{
              distance: number;
              duration: number;
              name?: string;
              maneuver?: { instruction?: string };
            }>;
          }>;
        }>;
      };

      if (requestId !== routeRequestId) {
        return;
      }

      const route = data.routes?.[0];

      if (!route) {
        throw new Error("Không tìm thấy tuyến đường phù hợp.");
      }

      latestOrigin = origin;
      routeCache.set(mode.key, {
        origin,
        route,
      });
      renderRouteResult(route, mode, isLiveUpdate);
    };

    const startNavigationTracking = (
      mode: (typeof modeConfig)[number]
    ) => {
      stopNavigationTracking();

      if (!navigator.geolocation) {
        return;
      }

      navigationWatchId = navigator.geolocation.watchPosition(
        (position) => {
          const nextLocation: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          if (
            !isValidCoordinate(
              nextLocation.latitude,
              nextLocation.longitude
            )
          ) {
            return;
          }

          latestOrigin = nextLocation;

          const movedDistance =
            lastRerouteLocation === null
              ? Infinity
              : calculateDistance(
                  lastRerouteLocation.latitude,
                  lastRerouteLocation.longitude,
                  nextLocation.latitude,
                  nextLocation.longitude
                ) ?? Infinity;

          const now = Date.now();
          const enoughMovement = movedDistance >= 75;
          const enoughTime = now - lastRerouteAt >= 15000;

          if (!enoughMovement && !enoughTime) {
            return;
          }

          lastRerouteLocation = nextLocation;
          lastRerouteAt = now;

          const requestId = ++routeRequestId;

          result.innerHTML =
            "<div style='padding:20px 4px;text-align:center;color:#667085'>📍 GPS đang cập nhật tuyến đường…</div>";

          void fetchAndDrawRoute(
            mode,
            nextLocation,
            requestId,
            true
          ).catch((error) => {
            if (requestId !== routeRequestId) return;

            result.innerHTML =
              "<div style='padding:10px 0;color:#b42318;font-size:13px'>" +
              escapeHtml(
                error instanceof Error
                  ? error.message
                  : "Không thể cập nhật tuyến đường."
              ) +
              "</div>";
          });
        },
        () => {
          // GPS có thể mất tín hiệu tạm thời; tuyến hiện tại vẫn được giữ.
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 5000,
        }
      );
    };

    const drawRoute = async (
      mode: (typeof modeConfig)[number]
    ) => {
      const requestId = ++routeRequestId;

      stopNavigationTracking();
      isInitialRoute = true;

      result.innerHTML =
        "<div style='padding:20px 4px;text-align:center;color:#667085'>Đang tìm tuyến đường…</div>";

      // Giữ tuyến hiện tại trên bản đồ trong lúc tính tuyến mới.
      // Khi tuyến mới trả về, renderRouteResult sẽ thay thế tuyến cũ.
      // Điều này tránh việc đường xanh biến mất giữa lúc panel đóng và Mapbox trả kết quả.

      try {
        const origin = await getOrigin();

        if (requestId !== routeRequestId) {
          return;
        }

        latestOrigin = origin;
        lastRerouteLocation = origin;
        lastRerouteAt = Date.now();

        const cached = routeCache.get(mode.key);

        if (cached && sameOrigin(cached.origin, origin)) {
          // Tuyến đã được tải trước: vẽ ngay lập tức.
          renderRouteResult(cached.route, mode, false);
        } else {
          routeCache.delete(mode.key);

          await fetchAndDrawRoute(
            mode,
            origin,
            requestId,
            false
          );
        }

        if (requestId !== routeRequestId) {
          return;
        }

        startNavigationTracking(mode);

        // Tải trước 2 chế độ còn lại để lần chọn tiếp theo hiện gần như tức thì.
        void Promise.all(
          modeConfig
            .filter((candidate) => candidate.key !== mode.key)
            .map(async (candidate) => {
              const existing = routeCache.get(candidate.key);

              if (existing && sameOrigin(existing.origin, origin)) {
                return;
              }

              try {
                await fetchAndDrawRoute(
                  candidate,
                  origin,
                  requestId,
                  false
                );
              } catch {
                // Không làm ảnh hưởng tuyến người dùng đang xem.
              }
            })
        );
      } catch (error) {
        if (requestId !== routeRequestId) {
          return;
        }

        result.innerHTML =
          "<div style='padding:10px 0;color:#b42318;font-size:13px'>" +
          escapeHtml(
            error instanceof Error
              ? error.message
              : "Không thể tìm đường."
          ) +
          "</div>" +
          "<div style='margin-top:8px;color:#667085;font-size:12px'>" +
          "Hãy kiểm tra quyền GPS và kết nối mạng rồi thử lại." +
          "</div>";
      }
    };

    modeConfig.forEach((mode) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = mode.label;
      button.style.padding = "10px 6px";
      button.style.borderRadius = "12px";
      button.style.border = mode.key === activeMode ? "2px solid #00897b" : "1px solid #dbe3ea";
      button.style.background = mode.key === activeMode ? "#e0f5f5" : "#fff";
      button.style.color = "#174e57";
      button.style.fontWeight = "800";
      button.style.cursor = "pointer";
      button.addEventListener("click", () => {
        activeMode = mode.key;

        modeConfig.forEach((config, index) => {
          const other = modes.children[index] as HTMLButtonElement;
          other.style.border =
            config.key === activeMode
              ? "2px solid #00897b"
              : "1px solid #dbe3ea";
          other.style.background =
            config.key === activeMode
              ? "#e0f5f5"
              : "#fff";
        });

        // Đổi phương tiện: xóa tuyến cũ ngay lập tức.
        // Tuyến mới sẽ lấy từ cache nếu đã được tải trước.
        clearRouteFromMap();
        document.removeEventListener("keydown", onRouteKeyDown);
        panel.remove();
        showNavigationControl(mode);

        void drawRoute(mode).catch(() => {
          // drawRoute tự hiển thị lỗi nếu GPS/Mapbox không lấy được tuyến.
        });
      });
      modes.appendChild(button);
    });

    sheet.style.position = "relative";
    sheet.appendChild(head);
    sheet.appendChild(closeButton);
    sheet.appendChild(modes);
    sheet.appendChild(result);
    sheet.appendChild(googleMapsButton);
    panel.appendChild(sheet);
    document.body.appendChild(panel);

    closeButton.addEventListener("click", closePanel);
    panel.addEventListener("click", (event) => {
      if (event.target === panel) closePanel();
    });

    const onRouteKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };

    closePanel = () => {
      routeRequestId += 1;
      stopNavigationTracking();
      removeNavigationControl();
      removeNavigationHud();
      document.removeEventListener("keydown", onRouteKeyDown);
      panel.remove();
      clearRouteFromMap();
    };

    document.addEventListener("keydown", onRouteKeyDown);

    void drawRoute(modeConfig.find((mode) => mode.key === activeMode) ?? modeConfig[1]);
  };

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
      overlay.remove();
      openDirectionsPanel();
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
    const routePanel = document.querySelector("[data-travelquest-directions='true']");
    if (routePanel) routePanel.remove();

    // Nếu đang chỉ đường, khi đóng popup địa danh vẫn phải giữ
    // tuyến xanh + GPS tracking trên bản đồ.
    const navigationIsActive = Boolean(
      document.querySelector("[data-travelquest-navigation-control='true']")
    );

    if (!navigationIsActive) {
      clearRouteFromMap();
    }

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
  avatarUrl = null,
  avatarEmoji = "🧭",
  friendLocations = [],
  showCheckpoints = true,
  onFriendMarkerClick,
}: MapProps) {
  const mapContainer =
    useRef<HTMLDivElement | null>(null);

  const map =
    useRef<mapboxgl.Map | null>(null);

  const userMarker =
    useRef<mapboxgl.Marker | null>(null);

  const latestUserLocation =
    useRef<UserLocation | null>(null);

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
      icon.style.overflow = "hidden";
      const cityImage = document.createElement("img");
      cityImage.alt = city.name;
      cityImage.style.width = "100%";
      cityImage.style.height = "100%";
      cityImage.style.objectFit = "cover";
      cityImage.style.display = "none";
      const cityFallback = document.createElement("span");
      cityFallback.textContent = "🏙️";
      icon.appendChild(cityImage);
      icon.appendChild(cityFallback);
      void (async () => {
        try {
          const query = encodeURIComponent(CITY_IMAGE_QUERIES[city.key] ?? (city.name + " Vietnam"));
          const response = await fetch("https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=" + query + "&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=300&format=json&origin=*");
          if (!response.ok) return;
          const data = await response.json() as { query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> } };
          const page = data.query?.pages ? Object.values(data.query.pages)[0] : undefined;
          const imageUrl = page?.imageinfo?.[0]?.thumburl ?? page?.imageinfo?.[0]?.url;
          if (imageUrl) {
            cityImage.src = imageUrl;
            cityImage.onload = () => { cityImage.style.display = "block"; cityFallback.style.display = "none"; };
          }
        } catch {}
      })();

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
      markerIcon.style.overflow = "hidden";

      const checkpointImage = CHECKPOINT_LOCAL_IMAGES[checkpoint.name]?.[0];
      if (checkpointImage) {
        const image = document.createElement("img");
        image.src = checkpointImage;
        image.alt = checkpoint.name;
        image.style.width = "100%";
        image.style.height = "100%";
        image.style.objectFit = "cover";
        image.style.display = "block";
        markerIcon.appendChild(image);
      } else {
        markerIcon.textContent =
          checkpoint.icon?.trim() || "📍";
      }

      markerElement.appendChild(markerIcon);
      markerElement.title = checkpoint.name;
      markerElement.dataset.travelquestCheckpointId = String(checkpoint.id);

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
          userLocation: latestUserLocation.current,
          getLatestUserLocation: () => latestUserLocation.current,
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
      if (!showCheckpoints) {
        clearCityMarkers();
        clearCheckpointMarkers();
        currentMapMode.current = "hidden";
        return;
      }

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
  }, [checkpoints, showCheckpoints]);

  // ========================================
  // FRIEND LOCATIONS
  // ========================================

  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance) return;

    const markers: mapboxgl.Marker[] = [];

    const renderFriendMarkers = () => {
      markers.forEach((marker) => marker.remove());
      markers.length = 0;

      friendLocations
        .filter((friend) =>
          isValidCoordinate(friend.latitude, friend.longitude)
        )
        .forEach((friend) => {
          const wrapper = document.createElement("div");
          wrapper.style.width = "48px";
          wrapper.style.height = "56px";
          wrapper.style.cursor = "pointer";
          wrapper.style.display = "flex";
          wrapper.style.flexDirection = "column";
          wrapper.style.alignItems = "center";
          wrapper.title = friend.display_name;

          const avatar = document.createElement("div");
          avatar.style.width = "42px";
          avatar.style.height = "42px";
          avatar.style.borderRadius = "50%";
          avatar.style.border = "3px solid #fff";
          avatar.style.background = "#172554";
          avatar.style.display = "flex";
          avatar.style.alignItems = "center";
          avatar.style.justifyContent = "center";
          avatar.style.overflow = "hidden";
          avatar.style.boxShadow = "0 4px 16px rgba(0,0,0,.35), 0 0 0 2px #60a5fa";
          avatar.style.fontSize = "19px";

          if (friend.avatar_url?.startsWith("data:image/")) {
            const avatarImage = document.createElement("img");
            avatarImage.src = friend.avatar_url;
            avatarImage.alt = friend.display_name;
            avatarImage.draggable = false;
            avatarImage.style.width = "100%";
            avatarImage.style.height = "100%";
            avatarImage.style.objectFit = "cover";
            avatar.appendChild(avatarImage);
          } else {
            avatar.textContent = "👤";
          }

          const name = document.createElement("div");
          name.style.marginTop = "-1px";
          name.style.maxWidth = "120px";
          name.style.padding = "2px 7px";
          name.style.borderRadius = "999px";
          name.style.background = "rgba(7,24,42,.92)";
          name.style.color = "#fff";
          name.style.font = "700 10px system-ui, sans-serif";
          name.style.whiteSpace = "nowrap";
          name.style.overflow = "hidden";
          name.style.textOverflow = "ellipsis";
          name.textContent = friend.display_name;

          wrapper.appendChild(avatar);
          wrapper.appendChild(name);

          wrapper.addEventListener("click", () => {
            onFriendMarkerClick?.(friend.user_id);
          });

          markers.push(
            new mapboxgl.Marker({
              element: wrapper,
              anchor: "bottom",
            })
              .setLngLat([friend.longitude, friend.latitude])
              .addTo(mapInstance)
          );
        });
    };

    if (mapInstance.isStyleLoaded()) {
      renderFriendMarkers();
    } else {
      mapInstance.once("load", renderFriendMarkers);
    }

    return () => {
      mapInstance.off("load", renderFriendMarkers);
      markers.forEach((marker) => marker.remove());
    };
  }, [friendLocations, onFriendMarkerClick]);

  // ========================================
  // CHECK-IN ZONES
  // Ẩn hoàn toàn vùng tròn màu xanh trên map.
  // Khi zoom xa chỉ hiển thị marker ảnh đại diện thành phố.
  // ========================================

  // ========================================
  // GPS MARKER
  // ========================================

  useEffect(() => {
    latestUserLocation.current = userLocation;

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

    ensureGpsMarkerStyles();

    const markerWrapper = document.createElement("div");
    markerWrapper.style.position = "relative";
    markerWrapper.style.width = "48px";
    markerWrapper.style.height = "56px";
    markerWrapper.style.display = "flex";
    markerWrapper.style.flexDirection = "column";
    markerWrapper.style.alignItems = "center";
    markerWrapper.style.cursor = "pointer";
    markerWrapper.title = "Vị trí của bạn";

    // Vòng sóng radar tỏa ra từ GPS
    const pulseRing = document.createElement("div");
    pulseRing.style.position = "absolute";
    pulseRing.style.top = "0px";
    pulseRing.style.width = "44px";
    pulseRing.style.height = "44px";
    pulseRing.style.borderRadius = "50%";
    pulseRing.style.background = "rgba(37, 99, 235, 0.35)";
    pulseRing.style.animation = "tq-radar-pulse 2.2s infinite ease-out";
    pulseRing.style.pointerEvents = "none";
    pulseRing.style.zIndex = "1";
    markerWrapper.appendChild(pulseRing);

    // Khung tròn chứa avatar
    const avatarBadge = document.createElement("div");
    avatarBadge.style.position = "relative";
    avatarBadge.style.zIndex = "2";
    avatarBadge.style.width = "44px";
    avatarBadge.style.height = "44px";
    avatarBadge.style.borderRadius = "50%";
    avatarBadge.style.border = "3px solid #ffffff";
    avatarBadge.style.boxShadow =
      "0 4px 14px rgba(0, 0, 0, 0.4), 0 0 0 2px #2563eb";
    avatarBadge.style.background =
      "linear-gradient(135deg, #1d4ed8, #0284c7)";
    avatarBadge.style.overflow = "hidden";
    avatarBadge.style.display = "flex";
    avatarBadge.style.alignItems = "center";
    avatarBadge.style.justifyContent = "center";
    avatarBadge.style.transition = "transform 0.15s ease";

    const renderEmojiAvatar = () => {
      avatarBadge.innerHTML = "";
      const emojiSpan = document.createElement("span");
      emojiSpan.style.fontSize = "22px";
      emojiSpan.style.lineHeight = "1";
      emojiSpan.style.userSelect = "none";
      emojiSpan.textContent = avatarEmoji || "🧭";
      avatarBadge.appendChild(emojiSpan);
    };

    if (avatarUrl) {
      const avatarImg = document.createElement("img");
      avatarImg.src = avatarUrl;
      avatarImg.alt = "Vị trí của bạn";
      avatarImg.style.width = "100%";
      avatarImg.style.height = "100%";
      avatarImg.style.objectFit = "cover";
      avatarImg.style.display = "block";
      avatarImg.onerror = () => {
        renderEmojiAvatar();
      };
      avatarBadge.appendChild(avatarImg);
    } else {
      renderEmojiAvatar();
    }

    markerWrapper.appendChild(avatarBadge);

    // Mũi nhọn ghim định vị chỉ đúng tọa độ GPS
    const pinTip = document.createElement("div");
    pinTip.style.position = "relative";
    pinTip.style.zIndex = "3";
    pinTip.style.marginTop = "-6px";
    pinTip.style.width = "12px";
    pinTip.style.height = "12px";
    pinTip.style.background = "#2563eb";
    pinTip.style.transform = "rotate(45deg)";
    pinTip.style.borderRight = "2.5px solid white";
    pinTip.style.borderBottom = "2.5px solid white";
    pinTip.style.borderRadius = "2px";
    pinTip.style.boxShadow = "2px 2px 4px rgba(0, 0, 0, 0.25)";
    markerWrapper.appendChild(pinTip);

    // Điểm neo nhỏ ở đầu kim
    const anchorDot = document.createElement("div");
    anchorDot.style.position = "absolute";
    anchorDot.style.bottom = "0";
    anchorDot.style.width = "4px";
    anchorDot.style.height = "4px";
    anchorDot.style.borderRadius = "50%";
    anchorDot.style.background = "#1d4ed8";
    markerWrapper.appendChild(anchorDot);

    // Hiệu ứng hover
    markerWrapper.addEventListener("mouseenter", () => {
      avatarBadge.style.transform = "scale(1.12)";
    });
    markerWrapper.addEventListener("mouseleave", () => {
      avatarBadge.style.transform = "scale(1)";
    });

    // Popup tương tác khi bấm vào marker
    const userPopup = new mapboxgl.Popup({
      offset: [0, -56],
      closeButton: true,
      closeOnClick: false,
      maxWidth: "260px",
    }).setHTML(`
      <div style="padding: 10px 12px; font-family: system-ui, -apple-system, sans-serif; text-align: center; color: #0f172a;">
        <div style="font-weight: 800; font-size: 13px; margin-bottom: 3px; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span>${escapeHtml(avatarEmoji || "🧭")}</span>
          <span>Vị trí hiện tại của bạn</span>
        </div>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
          ${latitude.toFixed(5)}, ${longitude.toFixed(5)}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 999px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; font-size: 10px; font-weight: 700;">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: #2563eb; display: inline-block;"></span>
          GPS đang hoạt động
        </div>
      </div>
    `);

    userMarker.current = new mapboxgl.Marker({
      element: markerWrapper,
      anchor: "bottom",
    })
      .setLngLat([
        longitude,
        latitude,
      ])
      .setPopup(userPopup)
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
    avatarUrl,
    avatarEmoji,
  ]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
    />
  );
}