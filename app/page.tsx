"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import Map from "../components/Map";

import { supabase } from "../lib/supabase";

import {
  calculateDistance,
  getCurrentLocation,
  watchCurrentLocation,
  stopWatchingLocation,
} from "../lib/gps";

import type { GPSLocation } from "../lib/gps";
import type { User } from "@supabase/supabase-js";

type Checkpoint = {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  badge: string | null;
  longitude: number;
  latitude: number;
};

// Các checkpoint nổi tiếng bổ sung.
// Tọa độ được chọn theo đúng tỉnh/thành hiện hành của địa danh.
// Hà Nội giữ nguyên 4 checkpoint cũ trong Supabase.


type Checkin = {
  checkpoint_id: number;
  user_id: string | null;
  created_at?: string | null;
};

type CheckpointReview = {
  id: number;
  checkpoint_id: number;
  user_id: string;
  rating: number;
  review: string;
  created_at: string;
  updated_at: string;
  display_name: string;
};

type Post = {
  id: number;
  device_id: string;
  user_id: string | null;
  checkpoint_id: number | null;
  content: string;
  likes: number;
  created_at: string;
  image_url: string | null;
  checkpoint: Checkpoint | null;
};

type PostQueryRow = Omit<Post, "checkpoint" | "likes"> & {
  likes: number | null;
  checkpoint: Checkpoint | Checkpoint[] | null;
};

type PostComment = {
  id: number;
  post_id: number;
  user_id: string;
  content: string;
  created_at: string;
};

type LeaderboardEntry = {
  user_id: string;
  display_name: string;
  checkpoint_count: number;
  xp: number;
  level: number;
};

type PublicProfile = {
  user_id: string;
  display_name: string;
  checkpoint_count: number;
  post_count: number;
  follower_count: number;
  following_count: number;
  xp: number;
  level: number;
  avatar_url?: string | null;
};

type FriendLocation = {
  user_id: string;
  latitude: number;
  longitude: number;
  display_name: string;
  level: number;
  xp: number;
  avatar_url?: string | null;
  updated_at: string;
};

type Notification = {
  id: number;
  recipient_id: string;
  actor_id: string | null;
  type: "follow" | "like" | "comment";
  post_id: number | null;
  message: string;
  is_read: boolean;
  created_at: string;
};

type ReportTargetType = "post" | "comment";

type ReportReason =
  | "spam"
  | "harassment"
  | "inappropriate"
  | "misleading"
  | "other";

type JourneyRecord = {
  id: string;
  name: string;
  checkpointIds: number[];
  started: boolean;
  startDate: string;
  endDate: string;
};

type ChatMessage = {
  id: string;
  text: string;
  sender: string;
  createdAt: string;
};

type WeatherData = {
  current: {
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
  };
  daily: Array<{
    date: string;
    weatherCode: number;
    temperatureMax: number;
    temperatureMin: number;
  }>;
};

const DEVICE_KEY = "travelquest-device-id";

const CHECKIN_RADIUS = 150;

const GEOFENCE_EXIT_RADIUS = 200;

const GPS_DISTANCE_UNAVAILABLE =
  "📍 GPS chưa xác định được khoảng cách.";

function getValidGpsDistance(
  location: GPSLocation,
  checkpoint: Pick<Checkpoint, "latitude" | "longitude">
): number | null {
  const {
    latitude: userLatitude,
    longitude: userLongitude,
  } = location;

  const {
    latitude: checkpointLatitude,
    longitude: checkpointLongitude,
  } = checkpoint;

  const coordinates = [
    userLatitude,
    userLongitude,
    checkpointLatitude,
    checkpointLongitude,
  ];

  if (
    !coordinates.every(Number.isFinite) ||
    userLatitude < -90 ||
    userLatitude > 90 ||
    checkpointLatitude < -90 ||
    checkpointLatitude > 90 ||
    userLongitude < -180 ||
    userLongitude > 180 ||
    checkpointLongitude < -180 ||
    checkpointLongitude > 180
  ) {
    return null;
  }

  const distance = calculateDistance(
    userLatitude,
    userLongitude,
    checkpointLatitude,
    checkpointLongitude
  );

  return Number.isFinite(distance) && distance >= 0
    ? distance
    : null;
}

function getDeviceId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existingId =
    window.localStorage.getItem(DEVICE_KEY);

  if (existingId) {
    return existingId;
  }

  const newId =
    typeof crypto !== "undefined" &&
    crypto.randomUUID
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

  window.localStorage.setItem(
    DEVICE_KEY,
    newId
  );

  return newId;
}

function formatPostTime(
  createdAt: string
) {
  const createdDate =
    new Date(createdAt);

  const now = new Date();

  const diff =
    now.getTime() -
    createdDate.getTime();

  const minutes =
    Math.floor(diff / 60000);

  const hours =
    Math.floor(diff / 3600000);

  const days =
    Math.floor(diff / 86400000);

  if (minutes < 1) {
    return "Vừa xong";
  }

  if (minutes < 60) {
    return `${minutes} phút trước`;
  }

  if (hours < 24) {
    return `${hours} giờ trước`;
  }

  if (days < 7) {
    return `${days} ngày trước`;
  }

  return createdDate.toLocaleDateString(
    "vi-VN"
  );
}

async function prepareAvatarImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Vui lòng chọn một file ảnh.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ảnh avatar tối đa 5MB.");
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Không thể đọc ảnh này."));
      image.src = sourceUrl;
    });

    const maxSize = 256;
    const scale = Math.min(
      1,
      maxSize / Math.max(image.naturalWidth, image.naturalHeight)
    );

    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
    }

    context.drawImage(image, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/webp", 0.84);

    if (!dataUrl.startsWith("data:image/")) {
      throw new Error("Không thể tạo ảnh avatar.");
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export default function Home() {
  const [activeTab, setActiveTab] =
    useState("map");

  const [checkpoints, setCheckpoints] =
    useState<Checkpoint[]>([]);

  const [checkins, setCheckins] =
    useState<Checkin[]>([]);

  const [
    selectedCheckpoint,
    setSelectedCheckpoint,
  ] = useState<Checkpoint | null>(
    null
  );

  const [showCheckpointCard, setShowCheckpointCard] = useState(true);
  const [checkpointCardOffset, setCheckpointCardOffset] = useState({ x: 0, y: 0 });
  const checkpointCardDragRef = useRef<{ active: boolean; startX: number; startY: number; originX: number; originY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  const checkpointRevealSwipeRef = useRef<{ startX: number; startY: number } | null>(null);

  useEffect(() => {
    setShowCheckpointCard(selectedCheckpoint !== null);
    setCheckpointCardOffset({ x: 0, y: 0 });
  }, [selectedCheckpoint]);

  const handleCheckpointCardPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) return;

    checkpointCardDragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: checkpointCardOffset.x,
      originY: checkpointCardOffset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCheckpointCardPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = checkpointCardDragRef.current;
    if (!drag.active) return;

    const maxX = Math.max(0, window.innerWidth / 2 - 24);
    const maxY = Math.max(0, window.innerHeight / 2 - 80);

    setCheckpointCardOffset({
      x: Math.max(-maxX, Math.min(maxX, drag.originX + event.clientX - drag.startX)),
      y: Math.max(-maxY, Math.min(maxY, drag.originY + event.clientY - drag.startY)),
    });
  };

  const handleCheckpointCardPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = checkpointCardDragRef.current;
    checkpointCardDragRef.current.active = false;

    const currentX = checkpointCardOffset.x;
    const currentY = checkpointCardOffset.y;
    const snapX = Math.abs(currentX) < 90 ? 0 : currentX > 0 ? Math.min(180, window.innerWidth * 0.22) : Math.max(-180, -window.innerWidth * 0.22);
    const snapY = Math.abs(currentY) < 90 ? 0 : currentY > 0 ? Math.min(260, window.innerHeight * 0.28) : Math.max(-260, -window.innerHeight * 0.28);

    setCheckpointCardOffset({
      x: snapX,
      y: snapY,
    });

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore pointer capture cleanup errors.
    }
  };

  // ============================================
  // ACCOUNT SETTINGS
  // ============================================

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [settingsMessage, setSettingsMessage] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const notifications = window.localStorage.getItem("travelquest-notifications-enabled");
        const gps = window.localStorage.getItem("travelquest-gps-enabled");

        if (notifications !== null) {
          setNotificationsEnabled(notifications !== "false");
        }

        if (gps !== null) {
          setGpsEnabled(gps !== "false");
        }
      } catch {
        // Ignore invalid local settings.
      }
    });
  }, []);

  const handleToggleNotifications = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    setSettingsMessage(next ? "🔔 Đã bật thông báo." : "🔕 Đã tắt thông báo.");

    try {
      window.localStorage.setItem(
        "travelquest-notifications-enabled",
        String(next)
      );
    } catch {
      // Ignore localStorage errors.
    }
  };

  const handleToggleGps = () => {
    const next = !gpsEnabled;
    setGpsEnabled(next);
    setSettingsMessage(next ? "📍 Đã bật GPS." : "📍 Đã tắt GPS.");

    if (!next && gpsWatchId.current !== null) {
      stopWatchingLocation(gpsWatchId.current);
      gpsWatchId.current = null;
      setLocationLoading(false);
    }

    try {
      window.localStorage.setItem(
        "travelquest-gps-enabled",
        String(next)
      );
    } catch {
      // Ignore localStorage errors.
    }
  };

  const handleClearLocalData = () => {
    try {
      if (user?.id) {
        window.localStorage.removeItem(
          `travelquest-saved-places:${user.id}`
        );
        window.localStorage.removeItem(
          `travelquest-journey:${user.id}`
        );
        window.localStorage.removeItem(
          `travelquest-avatar-image:${user.id}`
        );
      }
    } catch {
      // Ignore localStorage errors.
    }

    setSavedPlaceIds([]);
    setJourneyCheckpointIds([]);
    setJourneyStarted(false);
    setSettingsMessage("🧹 Đã xóa dữ liệu cục bộ trên thiết bị. Dữ liệu tài khoản Supabase không bị xóa.");
  };

  // ============================================
  // SAVED PLACES
  // ============================================

  // Auth state must be initialized before effects that depend on user.
  const [user, setUser] =
    useState<User | null>(null);

  const [authReady, setAuthReady] =
    useState(false);

  const authUserIdRef = useRef<string | null>(null);

  const [savedPlaceIds, setSavedPlaceIds] =
    useState<number[]>([]);

  const [showSavedPlaces, setShowSavedPlaces] =
    useState(false);

  const [showAllMapCheckpoints, setShowAllMapCheckpoints] =
    useState(false);

  const [showMapCheckpoints, setShowMapCheckpoints] =
    useState(true);

  const [showExplorePanel, setShowExplorePanel] =
    useState(false);

  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [mapSearchActive, setMapSearchActive] = useState(false);
  const [mapFilter, setMapFilter] = useState<"none" | "all" | "nearby" | "unvisited" | "saved">("none");

  const [headerMenuOpen, setHeaderMenuOpen] =
    useState(false);

  const [showAllDailyMissions, setShowAllDailyMissions] =
    useState(false);

  // ============================================
  // JOURNEY / TRIP
  // ============================================

  const [journeyOpen, setJourneyOpen] = useState(false);
  const [journeyName, setJourneyName] = useState("Hành trình Hà Nội");
  const [journeyCheckpointIds, setJourneyCheckpointIds] = useState<number[]>([]);
  const [journeyStarted, setJourneyStarted] = useState(false);
  const [journeys, setJourneys] = useState<JourneyRecord[]>([]);
  const [journeyStartDate, setJourneyStartDate] = useState("");
  const [journeyEndDate, setJourneyEndDate] = useState("");
  const [routeShareMessage, setRouteShareMessage] = useState("");

  // ============================================
  // CHECKPOINT DETAIL
  // ============================================

  const [checkpointDetailOpen, setCheckpointDetailOpen] =
    useState(false);

  // ============================================
  // CHECKPOINT REVIEWS
  // ============================================

  const [checkpointReviews, setCheckpointReviews] =
    useState<CheckpointReview[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  const reviewAverage =
    checkpointReviews.length > 0
      ? checkpointReviews.reduce((sum, item) => sum + item.rating, 0) /
        checkpointReviews.length
      : 0;

  // ============================================
  // WEATHER
  // ============================================

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");


  const [loading, setLoading] =
    useState(true);

  const [checkingIn, setCheckingIn] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [distance, setDistance] =
    useState<number | null>(null);

  const [
    locationLoading,
    setLocationLoading,
  ] = useState(false);

  const [userLocation, setUserLocation] =
    useState<GPSLocation | null>(null);

  const [friendLocations, setFriendLocations] =
    useState<FriendLocation[]>([]);

  const lastPublishedLocationAt = useRef(0);

  useEffect(() => {
    if (!user?.id) {
      setSavedPlaceIds([]);
      return;
    }

    try {
      const raw = window.localStorage.getItem(
        `travelquest-saved-places:${user.id}`
      );
      if (!raw) {
        setSavedPlaceIds([]);
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedPlaceIds(
          parsed.filter((id): id is number => typeof id === "number")
        );
      }
    } catch {
      setSavedPlaceIds([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    try {
      window.localStorage.setItem(
        `travelquest-saved-places:${user.id}`,
        JSON.stringify(savedPlaceIds)
      );
    } catch {
      // Ignore localStorage failures.
    }
  }, [savedPlaceIds, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setJourneyName("Hành trình Hà Nội");
      setJourneyCheckpointIds([]);
      setJourneyStarted(false);
      return;
    }

    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(
          `travelquest-journey:${user.id}`
        );
        if (!raw) {
          setJourneyName("Hành trình Hà Nội");
          setJourneyCheckpointIds([]);
          setJourneyStarted(false);
          return;
        }
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return;
        const data = parsed as {
          name?: unknown;
          checkpointIds?: unknown;
          started?: unknown;
        };
        if (typeof data.name === "string" && data.name.trim()) {
          setJourneyName(data.name);
        }
        if (Array.isArray(data.checkpointIds)) {
          setJourneyCheckpointIds(
            data.checkpointIds.filter((id): id is number => typeof id === "number")
          );
        }
        if (typeof data.started === "boolean") {
          setJourneyStarted(data.started);
        }
      } catch {
        // Ignore invalid local journey data.
      }
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    try {
      window.localStorage.setItem(
        `travelquest-journey:${user.id}`,
        JSON.stringify({
          name: journeyName,
          checkpointIds: journeyCheckpointIds,
          started: journeyStarted,
        })
      );
    } catch {
      // Ignore localStorage failures.
    }
  }, [journeyName, journeyCheckpointIds, journeyStarted, user?.id]);

  // ============================================
  // AUTH
  // ============================================

  const ownCheckpointReview = user?.id
    ? checkpointReviews.find((item) => item.user_id === user.id) ?? null
    : null;

  const [authOpen, setAuthOpen] =
    useState(false);

  const [authMode, setAuthMode] =
    useState<"login" | "signup">(
      "login"
    );

  const [authEmail, setAuthEmail] =
    useState("");

  const [authPassword, setAuthPassword] =
    useState("");

  const [authLoading, setAuthLoading] =
    useState(false);

  const [authMessage, setAuthMessage] =
    useState("");

  // ============================================
  // PROFILE
  // ============================================

  const [profileName, setProfileName] =
    useState("Traveller");

  const [
    profileNameInput,
    setProfileNameInput,
  ] = useState("");

  const [profileLoading, setProfileLoading] =
    useState(false);

  const [profileMessage, setProfileMessage] =
    useState("");

  // ============================================
  // LEADERBOARD
  // ============================================

  const [leaderboard, setLeaderboard] =
    useState<LeaderboardEntry[]>([]);

  const [leaderboardLoading, setLeaderboardLoading] =
    useState(false);

  const [leaderboardMessage, setLeaderboardMessage] =
    useState("");

  // ============================================
  // PUBLIC PROFILE + FOLLOW
  // ============================================

  const [publicProfileOpen, setPublicProfileOpen] =
    useState(false);

  const [publicProfile, setPublicProfile] =
    useState<PublicProfile | null>(null);

  const [publicProfileLoading, setPublicProfileLoading] =
    useState(false);

  const [publicProfileMessage, setPublicProfileMessage] =
    useState("");

  const [followingUserIds, setFollowingUserIds] =
    useState<string[]>([]);

  const [followLoading, setFollowLoading] =
    useState<Record<string, boolean>>({});

  // ============================================
  // NOTIFICATIONS
  // ============================================

  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [notificationsLoading, setNotificationsLoading] =
    useState(false);

  // ============================================
  // SEARCH TRAVELLER
  // ============================================

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [searchResults, setSearchResults] =
    useState<PublicProfile[]>([]);

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [searchMessage, setSearchMessage] =
    useState("");

  // ============================================
  // REPORT / MODERATION
  // ============================================

  const [reportOpen, setReportOpen] =
    useState(false);

  const [reportTargetType, setReportTargetType] =
    useState<ReportTargetType>("post");

  const [reportTargetId, setReportTargetId] =
    useState<string>("");

  const [reportTargetLabel, setReportTargetLabel] =
    useState("");

  const [reportReason, setReportReason] =
    useState<ReportReason>("spam");

  const [reportDetails, setReportDetails] =
    useState("");

  const [reportLoading, setReportLoading] =
    useState(false);

  const [reportMessage, setReportMessage] =
    useState("");

  // ============================================
  // UGC
  // ============================================

  const [posts, setPosts] =
    useState<Post[]>([]);

  const [postsLoading, setPostsLoading] =
    useState(false);

  const [feedMode, setFeedMode] =
    useState<"all" | "following">("all");
  const [feedCheckpointId, setFeedCheckpointId] = useState<number | null>(null);

  const [postContent, setPostContent] =
    useState("");

  const [
    selectedPostCheckpoint,
    setSelectedPostCheckpoint,
  ] = useState<number | null>(null);

  const [posting, setPosting] =
    useState(false);

  const [postMessage, setPostMessage] =
    useState("");

  // ============================================
  // UGC COMMENTS
  // ============================================

  const [comments, setComments] =
    useState<PostComment[]>([]);

  const [commentInputs, setCommentInputs] =
    useState<Record<number, string>>({});

  const [commentLoading, setCommentLoading] =
    useState<Record<number, boolean>>({});

  const [, setCommentsLoading] =
    useState(false);

  // ============================================
  // UGC LIKES
  // ============================================

  const [likedPostIds, setLikedPostIds] =
    useState<number[]>([]);

  const [likeLoading, setLikeLoading] =
    useState<Record<number, boolean>>({});

  // ============================================
  // UGC IMAGE
  // ============================================

  const [selectedImage, setSelectedImage] =
    useState<File | null>(null);

  // ============================================
  // EXTRA TRAVEL / SOCIAL FEATURES
  // ============================================

  const [editPostId, setEditPostId] = useState<number | null>(null);
  const [editPostContent, setEditPostContent] = useState("");
  const [hashtagFilter, setHashtagFilter] = useState("");
  const [savedPostIds, setSavedPostIds] = useState<number[]>([]);
  const [avatarEmoji, setAvatarEmoji] = useState("🧭");
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [dailyMissionClaims, setDailyMissionClaims] = useState<Record<string, string>>({});
  const [missionBonusXP, setMissionBonusXP] = useState(0);
  const [routePlannerOpen, setRoutePlannerOpen] = useState(false);
  const [smartTravelOpen, setSmartTravelOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantReply, setAssistantReply] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setSavedPostIds([]);
      setAvatarEmoji("🧭");
      setAvatarImageUrl(null);
      return;
    }

    queueMicrotask(() => {
      try {
        const savedPosts = window.localStorage.getItem("travelquest-saved-posts");
        if (savedPosts) {
          const parsed: unknown = JSON.parse(savedPosts);
          if (Array.isArray(parsed)) setSavedPostIds(parsed.filter((id): id is number => typeof id === "number"));
        } else {
          setSavedPostIds([]);
        }

        const avatar = window.localStorage.getItem(
          `travelquest-avatar:${user.id}`
        );
        setAvatarEmoji(avatar || "🧭");

        const avatarImage = window.localStorage.getItem(
          `travelquest-avatar-image:${user.id}`
        );
        setAvatarImageUrl(
          avatarImage?.startsWith("data:image/")
            ? avatarImage
            : null
        );

        const missionData = window.localStorage.getItem("travelquest-daily-missions");
        if (missionData) {
          const parsed = JSON.parse(missionData) as { claims?: unknown; bonusXP?: unknown };
          if (parsed.claims && typeof parsed.claims === "object") setDailyMissionClaims(parsed.claims as Record<string, string>);
          if (typeof parsed.bonusXP === "number") setMissionBonusXP(parsed.bonusXP);
        }
        const journeysRaw = window.localStorage.getItem("travelquest-journeys");
        if (journeysRaw) {
          const parsed: unknown = JSON.parse(journeysRaw);
          if (Array.isArray(parsed)) setJourneys(parsed as JourneyRecord[]);
        }
        const chatRaw = window.localStorage.getItem("travelquest-chat");
        if (chatRaw) {
          const parsed: unknown = JSON.parse(chatRaw);
          if (Array.isArray(parsed)) setChatMessages(parsed as ChatMessage[]);
        }
      } catch {
        // Ignore invalid local feature data.
      }
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    try {
      window.localStorage.setItem("travelquest-saved-posts", JSON.stringify(savedPostIds));
      window.localStorage.setItem(
        `travelquest-avatar:${user.id}`,
        avatarEmoji
      );
      window.localStorage.setItem("travelquest-daily-missions", JSON.stringify({ claims: dailyMissionClaims, bonusXP: missionBonusXP }));
      window.localStorage.setItem("travelquest-journeys", JSON.stringify(journeys));
      window.localStorage.setItem("travelquest-chat", JSON.stringify(chatMessages.slice(-100)));
    } catch {
      // Ignore localStorage failures.
    }
  }, [user?.id, savedPostIds, avatarEmoji, dailyMissionClaims, missionBonusXP, journeys, chatMessages]);

  useEffect(() => {
    if (!chatOpen) return;
    const channel = supabase.channel("travelquest-traveller-chat", { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "message" }, ({ payload }) => {
      if (!payload || typeof payload !== "object") return;
      const data = payload as Partial<ChatMessage>;
      if (typeof data.id !== "string" || typeof data.text !== "string" || typeof data.sender !== "string") return;
      setChatMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data as ChatMessage].slice(-100));
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [chatOpen]);

  const [imagePreview, setImagePreview] =
    useState<string | null>(null);

  const imageInputRef =
    useRef<HTMLInputElement | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPreviewOpen, setCameraPreviewOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("environment");
  const [cameraError, setCameraError] = useState("");
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // ============================================
  // BADGE UNLOCK ANIMATION
  // ============================================

  const [unlockedBadge, setUnlockedBadge] =
    useState<Checkpoint | null>(null);

  const previousCheckins =
    useRef<number[]>([]);

  const badgePopupTimer =
    useRef<
      ReturnType<typeof setTimeout> | null
    >(null);

  const gpsWatchId =
    useRef<number | null>(null);

  const geofenceCheckpointId =
    useRef<number | null>(null);

  const autoCheckinInProgress =
    useRef<Set<number>>(
      new Set()
    );

  // ============================================
  // FIX STALE STATE CHO GPS
  // ============================================

  const checkpointsRef =
    useRef<Checkpoint[]>([]);

  const checkinsRef =
    useRef<Checkin[]>([]);

  const selectedCheckpointRef =
    useRef<Checkpoint | null>(null);

  useEffect(() => {
    checkpointsRef.current =
      checkpoints;
  }, [checkpoints]);

  useEffect(() => {
    checkinsRef.current =
      checkins;
  }, [checkins]);

  useEffect(() => {
    selectedCheckpointRef.current =
      selectedCheckpoint;
  }, [selectedCheckpoint]);

  // ============================================
  // AUTH - LOAD SESSION
  // ============================================

  useEffect(() => {
    let mounted = true;

    const loadAuth = async () => {
      const {
        data,
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error(
          "Lỗi lấy phiên đăng nhập:",
          error
        );
      }

      if (mounted) {
        const sessionUser = data.session?.user ?? null;
        authUserIdRef.current = sessionUser?.id ?? null;

        setUser(sessionUser);

        setAuthReady(true);
      }
    };

    loadAuth();

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!mounted) {
            return;
          }

          const nextUser = session?.user ?? null;

          if (nextUser?.id !== authUserIdRef.current) {
            if (gpsWatchId.current !== null) {
              stopWatchingLocation(gpsWatchId.current);
              gpsWatchId.current = null;
            }

            lastPublishedLocationAt.current = 0;
            geofenceCheckpointId.current = null;
            autoCheckinInProgress.current.clear();

            setCheckins([]);
            setFollowingUserIds([]);
            setFriendLocations([]);
            setNotifications([]);
            setPublicProfile(null);
            setPublicProfileOpen(false);
            setSearchResults([]);
            setSearchQuery("");
            setSavedPlaceIds([]);
            setJourneyName("Hành trình Hà Nội");
            setJourneyCheckpointIds([]);
            setJourneyStarted(false);
            setUserLocation(null);
            setDistance(null);
            setSelectedCheckpoint(null);
            setPosts([]);
            setComments([]);
            setCommentInputs({});
            setLikedPostIds([]);
            setSavedPostIds([]);
            setAvatarImageUrl(null);
            setAvatarEmoji("🧭");
            setProfileName("Traveller");
            setProfileNameInput("");
          }

          authUserIdRef.current = nextUser?.id ?? null;
          setUser(nextUser);
        }
      );

    return () => {
      mounted = false;

      authListener.subscription.unsubscribe();
    };
  }, []);

  // ============================================
  // PROFILE - LOAD
  // ============================================

  const loadProfile = async (
    userId: string
  ) => {
    if (!userId) {
      return;
    }

    setProfileLoading(true);
    setProfileMessage("");

    try {
      const {
        data,
        error,
      } = await supabase
        .from("profiles")
        .select(
          "id, display_name"
        )
        .eq(
          "id",
          userId
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Lỗi lấy profile:",
          error
        );

        setProfileName(
          "Traveller"
        );

        setProfileNameInput(
          "Traveller"
        );

        setProfileMessage(
          "Không thể tải thông tin hồ sơ."
        );

        setProfileLoading(false);
        return;
      }

      const name =
        data?.display_name?.trim() ||
        "Traveller";

      setProfileName(
        name
      );

      setProfileNameInput(
        name
      );
    } catch (error) {
      console.error(
        "Lỗi load profile:",
        error
      );

      setProfileName(
        "Traveller"
      );

      setProfileNameInput(
        "Traveller"
      );

      setProfileMessage(
        "Không thể tải thông tin hồ sơ."
      );
    }

    setProfileLoading(false);
  };

  // ============================================
  // PROFILE - SAVE
  // ============================================

  const saveProfile = async () => {
    if (!user?.id) {
      return;
    }

    const name =
      profileNameInput.trim();

    if (!name) {
      setProfileMessage(
        "✍️ Vui lòng nhập tên hiển thị."
      );

      return;
    }

    if (name.length > 30) {
      setProfileMessage(
        "Tên hiển thị tối đa 30 ký tự."
      );

      return;
    }

    setProfileLoading(true);
    setProfileMessage("");

    try {
      const {
        error,
      } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            display_name: name,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: "id",
          }
        );

      if (error) {
        console.error(
          "Lỗi lưu profile:",
          error?.message,
          error?.details,
          error?.hint,
          error?.code
        );

        setProfileMessage(
          "❌ Không thể lưu tên. Hãy thử lại."
        );

        setProfileLoading(false);
        return;
      }

      setProfileName(
        name
      );

      setProfileNameInput(
        name
      );

      setProfileMessage(
        "✅ Đã lưu tên hiển thị."
      );

      loadLeaderboard();
    } catch (error) {
      console.error(
        "Lỗi save profile:",
        error
      );

      setProfileMessage(
        "❌ Có lỗi khi lưu hồ sơ."
      );
    }

    setProfileLoading(false);
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setAvatarUploading(true);
    setProfileMessage("");

    try {
      const dataUrl = await prepareAvatarImage(file);

      if (!user?.id) {
        throw new Error("Bạn cần đăng nhập để lưu avatar.");
      }

      window.localStorage.setItem(
        `travelquest-avatar-image:${user.id}`,
        dataUrl
      );

      const { error: avatarError } = await supabase
        .from("travelquest_profile_avatars")
        .upsert(
          {
            user_id: user.id,
            avatar_url: dataUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (avatarError) {
        console.error("Lỗi đồng bộ avatar:", avatarError);
        throw new Error(
          "Không thể đồng bộ avatar lên server. Hãy chạy SQL migration avatar rồi thử lại."
        );
      }

      setAvatarImageUrl(dataUrl);
      setProfileMessage(
        "✅ Đã cập nhật avatar và đồng bộ lên server."
      );
    } catch (error) {
      setProfileMessage(
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ Không thể cập nhật ảnh avatar."
      );
    } finally {
      setAvatarUploading(false);

      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  };

  const removeAvatarImage = () => {
    try {
      if (user?.id) {
        window.localStorage.removeItem(
          `travelquest-avatar-image:${user.id}`
        );
      }
    } catch {
      // Ignore localStorage failures.
    }

    setAvatarImageUrl(null);
    setProfileMessage("🧭 Đã chuyển về avatar mặc định.");
  };

  // ============================================
  // PROFILE - LOAD WHEN USER CHANGES
  // ============================================

  useEffect(() => {
    queueMicrotask(() => {
      if (!authReady) {
        return;
      }

      if (!user?.id) {
        setProfileName("Traveller");
        setProfileNameInput("");
        setProfileMessage("");
        return;
      }

      void loadProfile(user.id);
    });
  }, [
    authReady,
    user?.id,
  ]);

  // ============================================
  // AUTH - OPEN LOGIN
  // ============================================

  const openAuth = (
    mode: "login" | "signup"
  ) => {
    setAuthMode(mode);
    setAuthMessage("");
    setAuthPassword("");
    setAuthOpen(true);
  };

  // ============================================
  // AUTH - LOGIN / SIGNUP
  // ============================================

  const handleAuth = async () => {
    const email =
      authEmail.trim();

    const password =
      authPassword;

    if (!email) {
      setAuthMessage(
        "📧 Vui lòng nhập email."
      );

      return;
    }

    if (!password) {
      setAuthMessage(
        "🔑 Vui lòng nhập mật khẩu."
      );

      return;
    }

    if (password.length < 6) {
      setAuthMessage(
        "🔑 Mật khẩu cần ít nhất 6 ký tự."
      );

      return;
    }

    setAuthLoading(true);
    setAuthMessage("");

    try {
      if (authMode === "login") {
        const {
          data,
          error,
        } =
          await supabase.auth.signInWithPassword(
            {
              email,
              password,
            }
          );

        if (error) {
          console.error(
            "Lỗi đăng nhập:",
            error
          );

          if (
            error.message
              .toLowerCase()
              .includes("invalid login")
          ) {
            setAuthMessage(
              "❌ Email hoặc mật khẩu không đúng."
            );
          } else {
            setAuthMessage(
              `❌ ${error.message}`
            );
          }

          setAuthLoading(false);
          return;
        }

        setUser(
          data.user
        );

        if (data.user?.id) {
          await loadProfile(
            data.user.id
          );
        }

        setAuthMessage(
          "🎉 Đăng nhập thành công!"
        );

        setAuthPassword("");

        setTimeout(() => {
          setAuthOpen(false);
          setAuthMessage("");
        }, 700);
      } else {
        const {
          data,
          error,
        } =
          await supabase.auth.signUp(
            {
              email,
              password,
            }
          );

        if (error) {
          console.error(
            "Lỗi đăng ký:",
            error
          );

          setAuthMessage(
            `❌ ${error.message}`
          );

          setAuthLoading(false);
          return;
        }

        if (data.session) {
          setUser(
            data.user
          );

          if (data.user?.id) {
            await loadProfile(
              data.user.id
            );
          }

          setAuthMessage(
            "🎉 Tạo tài khoản thành công!"
          );

          setAuthPassword("");

          setTimeout(() => {
            setAuthOpen(false);
            setAuthMessage("");
          }, 700);
        } else {
          setAuthMessage(
            "📧 Đăng ký thành công! Hãy kiểm tra email để xác nhận tài khoản."
          );

          setAuthPassword("");
        }
      }
    } catch (error) {
      console.error(
        "Lỗi Auth:",
        error
      );

      setAuthMessage(
        "❌ Có lỗi xảy ra. Hãy thử lại."
      );
    }

    setAuthLoading(false);
  };

  // ============================================
  // AUTH - LOGOUT
  // ============================================

  const handleLogout = async () => {
    setAuthLoading(true);
    setAuthMessage("");

    const {
      error,
    } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "Lỗi đăng xuất:",
        error
      );

      setAuthMessage(
        "❌ Không thể đăng xuất. Hãy thử lại."
      );

      setAuthLoading(false);
      return;
    }

    // Clear all account-scoped UI state before ending the session.
    if (gpsWatchId.current !== null) {
      stopWatchingLocation(gpsWatchId.current);
      gpsWatchId.current = null;
    }

    lastPublishedLocationAt.current = 0;
    geofenceCheckpointId.current = null;
    autoCheckinInProgress.current.clear();
    previousCheckins.current = [];

    setUser(null);
    setCheckins([]);
    setFollowingUserIds([]);
    setFriendLocations([]);
    setNotifications([]);
    setPublicProfile(null);
    setPublicProfileOpen(false);
    setPublicProfileMessage("");
    setSearchResults([]);
    setSearchQuery("");
    setSearchMessage("");
    setSavedPlaceIds([]);
    setJourneyName("Hành trình Hà Nội");
    setJourneyCheckpointIds([]);
    setJourneyStarted(false);
    setJourneys([]);
    setJourneyStartDate("");
    setJourneyEndDate("");
    setRouteShareMessage("");
    setUserLocation(null);
    setDistance(null);
    setLocationLoading(false);
    setSelectedCheckpoint(null);
    setCheckpointReviews([]);
    setReviewText("");
    setReviewRating(5);
    setReviewMessage("");
    setPosts([]);
    setComments([]);
    setCommentInputs({});
    setLikedPostIds([]);
    setSavedPostIds([]);
    setAvatarImageUrl(null);
    setAvatarEmoji("🧭");
    setProfileName("Traveller");
    setProfileNameInput("");
    setProfileMessage("");
    setMessage("");
    setAuthOpen(false);
    setAuthEmail("");
    setAuthPassword("");
    setAuthMessage("");
    setAuthLoading(false);
  };

  // ============================================
  // SEARCH TRAVELLER
  // ============================================

  const searchTravellers = async (value: string) => {
    const query = value.trim();

    setSearchQuery(value);
    setSearchMessage("");

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);

    try {
      const { data, error } = await supabase
        .from("travelquest_public_profiles")
        .select(
          "user_id, display_name, checkpoint_count, post_count, follower_count, following_count, xp, level"
        )
        .ilike("display_name", `%${query}%`)
        .neq("user_id", user?.id ?? "")
        .order("xp", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Lỗi tìm Traveller:", error);
        setSearchResults([]);
        setSearchMessage("❌ Không thể tìm Traveller lúc này.");
        return;
      }

      setSearchResults((data ?? []) as PublicProfile[]);

      if ((data ?? []).length === 0) {
        setSearchMessage("Không tìm thấy Traveller phù hợp.");
      }
    } catch (error) {
      console.error("Lỗi search Traveller:", error);
      setSearchResults([]);
      setSearchMessage("❌ Có lỗi khi tìm kiếm.");
    } finally {
      setSearchLoading(false);
    }
  };

  const openSearch = () => {
    if (!user?.id) {
      setAuthOpen(true);
      setAuthMode("login");
      setAuthMessage("🔐 Hãy đăng nhập để tìm Traveller.");
      return;
    }

    setSearchOpen(true);
    setSearchMessage("");
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchMessage("");
    setSearchLoading(false);
  };

  // ============================================
  // NOTIFICATIONS - LOAD
  // ============================================

  const loadNotifications = async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    setNotificationsLoading(true);

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, recipient_id, actor_id, type, post_id, message, is_read, created_at"
        )
        .eq("recipient_id", user.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(50);

      if (error) {
        console.error(
          "Lỗi load notifications:",
          error
        );
        return;
      }

      setNotifications(
        (data ?? []) as Notification[]
      );
    } catch (error) {
      console.error(
        "Lỗi notifications:",
        error
      );
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markNotificationsRead = async () => {
    if (!user?.id) {
      return;
    }

    const unreadIds = notifications
      .filter((item) => !item.is_read)
      .map((item) => item.id);

    if (unreadIds.length === 0) {
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        unreadIds.includes(item.id)
          ? {
              ...item,
              is_read: true,
            }
          : item
      )
    );

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
      })
      .in("id", unreadIds)
      .eq("recipient_id", user.id);

    if (error) {
      console.error(
        "Lỗi mark notifications read:",
        error
      );
    }
  };

  const toggleNotifications = async () => {
    if (!user?.id) {
      setAuthOpen(true);
      setAuthMode("login");
      setAuthMessage(
        "🔐 Hãy đăng nhập để xem thông báo."
      );
      return;
    }

    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);

    if (nextOpen) {
      await loadNotifications();
      await markNotificationsRead();
    }
  };

  // ============================================
  // PUBLIC PROFILE - LOAD FOLLOWING
  // ============================================

  const loadFollowing = async () => {
    if (!user?.id) {
      setFollowingUserIds([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id);

      if (error) {
        console.error("Lỗi load following:", error);
        return;
      }

      setFollowingUserIds(
        (data ?? [])
          .map((item) => item.following_id)
          .filter(Boolean)
      );
    } catch (error) {
      console.error("Lỗi load following:", error);
    }
  };

  // ============================================
  // FRIEND LOCATIONS - MUTUAL FOLLOWS
  // ============================================

  const loadFriendLocations = async () => {
    if (!user?.id) {
      setFriendLocations([]);
      return;
    }

    try {
      const [{ data: following, error: followingError }, { data: followers, error: followersError }] = await Promise.all([
        supabase
          .from("user_follows")
          .select("following_id")
          .eq("follower_id", user.id),
        supabase
          .from("user_follows")
          .select("follower_id")
          .eq("following_id", user.id),
      ]);

      if (followingError || followersError) {
        console.warn("Không tải được quan hệ Follow để tìm bạn bè:", {
          followingError: followingError?.message,
          followersError: followersError?.message,
        });
        setFriendLocations([]);
        return;
      }

      const followingIds = new Set(
        (following ?? [])
          .map((row) => row.following_id)
          .filter((id): id is string => typeof id === "string")
      );

      const friendIds = (followers ?? [])
        .map((row) => row.follower_id)
        .filter(
          (id): id is string =>
            typeof id === "string" && followingIds.has(id)
        );

      if (!friendIds.length) {
        setFriendLocations([]);
        return;
      }

      const { data: locations, error: locationError } = await supabase
        .from("travelquest_friend_locations")
        .select("user_id, latitude, longitude, updated_at")
        .in("user_id", friendIds)
        .eq("sharing_enabled", true);

      if (locationError) {
        // The SQL table may not have been created yet; keep the map usable.
        console.warn("Friend locations chưa sẵn sàng:", locationError.message);
        setFriendLocations([]);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from("travelquest_public_profiles")
        .select("user_id, display_name, level, xp")
        .in("user_id", friendIds);

      if (profileError) {
        console.warn("Không tải được public profile bạn bè, vẫn hiển thị marker GPS:", profileError.message);
      }

      const { data: avatarRows, error: avatarError } = await supabase
        .from("travelquest_profile_avatars")
        .select("user_id, avatar_url")
        .in("user_id", friendIds);

      if (avatarError) {
        console.warn(
          "Không tải được avatar bạn bè, vẫn hiển thị marker GPS:",
          avatarError.message
        );
      }

      const profileMap = new globalThis.Map(
        (profiles ?? []).map((profile) => [
          profile.user_id,
          profile,
        ])
      );

      const avatarMap = new globalThis.Map(
        (avatarRows ?? []).map((row) => [
          row.user_id,
          row.avatar_url,
        ])
      );

      const nextFriendLocations = (locations ?? [])
        .map((location) => {
          const profile = profileMap.get(location.user_id);

          return {
            user_id: location.user_id,
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            display_name: profile?.display_name || "Traveller",
            level: Number(profile?.level ?? 1),
            xp: Number(profile?.xp ?? 0),
            avatar_url:
              typeof avatarMap.get(location.user_id) === "string" &&
              avatarMap.get(location.user_id).startsWith("data:image/")
                ? avatarMap.get(location.user_id)
                : null,
            updated_at: location.updated_at,
          } satisfies FriendLocation;
        })
        .filter(
          (item) =>
            Number.isFinite(item.latitude) &&
            Number.isFinite(item.longitude) &&
            item.latitude >= -90 &&
            item.latitude <= 90 &&
            item.longitude >= -180 &&
            item.longitude <= 180
        );

      console.info("TravelQuest Friend GPS:", {
        currentUserId: user.id,
        mutualFriendIds: friendIds,
        locationRows: locations?.length ?? 0,
        visibleFriendLocations: nextFriendLocations.length,
      });

      setFriendLocations(nextFriendLocations);
    } catch (error) {
      console.warn("Lỗi tải vị trí bạn bè:", error);
      setFriendLocations([]);
    }
  };

  const publishOwnLocation = async (location: GPSLocation) => {
    if (!user?.id) return;

    const now = Date.now();
    if (now - lastPublishedLocationAt.current < 15000) return;
    lastPublishedLocationAt.current = now;

    const { error } = await supabase
      .from("travelquest_friend_locations")
      .upsert(
        {
          user_id: user.id,
          latitude: location.latitude,
          longitude: location.longitude,
          sharing_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.warn("Chưa thể chia sẻ vị trí với bạn bè:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    } else {
      console.info("TravelQuest: đã publish GPS cho bạn bè.", {
        userId: user.id,
        latitude: location.latitude,
        longitude: location.longitude,
      });
    }
  };

  useEffect(() => {
    void loadFriendLocations();

    if (!user?.id) return;

    const intervalId = window.setInterval(() => {
      void loadFriendLocations();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [user?.id]);

  // ============================================
  // PUBLIC PROFILE - OPEN
  // ============================================

  const openPublicProfile = async (
    userId: string
  ) => {
    if (!user?.id) {
      setAuthOpen(true);
      setAuthMode("login");
      setAuthMessage(
        "🔐 Hãy đăng nhập để xem hồ sơ Traveller."
      );
      return;
    }

    setPublicProfileOpen(true);
    setPublicProfile(null);
    setPublicProfileMessage("");
    setPublicProfileLoading(true);

    try {
      const { data, error } = await supabase
        .from("travelquest_public_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error(
          "Lỗi load public profile:",
          error
        );

        setPublicProfileMessage(
          "❌ Không thể tải hồ sơ."
        );

        return;
      }

      if (!data) {
        setPublicProfileMessage(
          "Không tìm thấy hồ sơ Traveller."
        );

        return;
      }

      setPublicProfile(
        data as PublicProfile
      );
    } catch (error) {
      console.error(
        "Lỗi public profile:",
        error
      );

      setPublicProfileMessage(
        "❌ Có lỗi khi tải hồ sơ."
      );
    } finally {
      setPublicProfileLoading(false);
    }
  };

  // ============================================
  // PUBLIC PROFILE - FOLLOW / UNFOLLOW
  // ============================================

  const toggleFollow = async (
    targetUserId: string
  ) => {
    if (!user?.id) {
      setAuthOpen(true);
      setAuthMode("login");
      setAuthMessage(
        "🔐 Hãy đăng nhập để theo dõi Traveller."
      );
      return;
    }

    if (targetUserId === user.id) {
      return;
    }

    if (followLoading[targetUserId]) {
      return;
    }

    const isFollowing =
      followingUserIds.includes(targetUserId);

    setFollowLoading((current) => ({
      ...current,
      [targetUserId]: true,
    }));

    setFollowingUserIds((current) =>
      isFollowing
        ? current.filter(
            (id) => id !== targetUserId
          )
        : current.includes(targetUserId)
        ? current
        : [...current, targetUserId]
    );

    if (publicProfile?.user_id === targetUserId) {
      setPublicProfile((current) =>
        current
          ? {
              ...current,
              follower_count: Math.max(
                0,
                current.follower_count +
                  (isFollowing ? -1 : 1)
              ),
            }
          : current
      );
    }

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("user_follows")
          .insert({
            follower_id: user.id,
            following_id: targetUserId,
          });

        if (error) {
          throw error;
        }
      }
    } catch (error: unknown) {
      const errorInfo =
        error &&
        typeof error === "object"
          ? (error as {
              message?: string;
              details?: string;
              hint?: string;
              code?: string;
            })
          : {};

      console.error(
        "Lỗi follow/unfollow:",
        errorInfo.message,
        errorInfo.details,
        errorInfo.hint,
        errorInfo.code,
        error
      );

      setFollowingUserIds((current) =>
        isFollowing
          ? [...current, targetUserId]
          : current.filter(
              (id) => id !== targetUserId
            )
      );

      if (
        publicProfile?.user_id ===
        targetUserId
      ) {
        setPublicProfile((current) =>
          current
            ? {
                ...current,
                follower_count: Math.max(
                  0,
                  current.follower_count +
                    (isFollowing ? 1 : -1)
                ),
              }
            : current
        );
      }

      setPublicProfileMessage(
        "❌ Không thể cập nhật Follow. Hãy thử lại."
      );
    } finally {
      setFollowLoading((current) => ({
        ...current,
        [targetUserId]: false,
      }));
    }
  };

  // ============================================
  // PUBLIC PROFILE - LOAD WHEN USER CHANGES
  // ============================================

  useEffect(() => {
    queueMicrotask(() => {
      if (!authReady) {
        return;
      }

      void loadFollowing();
      void loadNotifications();
    });
  }, [authReady, user?.id]);

  // ============================================
  // LEADERBOARD - LOAD
  // ============================================

  const loadLeaderboard = async () => {
    if (!user?.id) {
      setLeaderboard([]);
      return;
    }

    setLeaderboardLoading(true);
    setLeaderboardMessage("");

    try {
      const {
        data,
        error,
      } = await supabase
        .from("travelquest_leaderboard")
        .select(
          "user_id, display_name, checkpoint_count, xp, level"
        )
        .order("xp", {
          ascending: false,
        })
        .order("checkpoint_count", {
          ascending: false,
        })
        .order("display_name", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Lỗi tải bảng xếp hạng:",
          error
        );

        setLeaderboard([]);
        setLeaderboardMessage(
          "Không thể tải bảng xếp hạng."
        );

        return;
      }

      setLeaderboard(
        (data ?? []) as LeaderboardEntry[]
      );
    } catch (error) {
      console.error(
        "Lỗi load leaderboard:",
        error
      );

      setLeaderboard([]);
      setLeaderboardMessage(
        "Không thể tải bảng xếp hạng."
      );
    } finally {
      setLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      if (!authReady || !user?.id) {
        setLeaderboard([]);
        return;
      }

      void loadLeaderboard();
    });
  }, [
    authReady,
    user?.id,
  ]);

  // ============================================
  // CLAIM DEVICE DATA FOR ACCOUNT
  // ============================================

  const claimDeviceDataForUser =
    async (
      userId: string
    ) => {
      const deviceId =
        getDeviceId();

      if (!deviceId || !userId) {
        return;
      }

      try {
        const {
          error: checkinClaimError,
        } = await supabase
          .from("checkins")
          .update({
            user_id: userId,
          })
          .eq(
            "device_id",
            deviceId
          )
          .is(
            "user_id",
            null
          );

        if (checkinClaimError) {
          console.error(
            "Lỗi gắn check-in vào tài khoản:",
            checkinClaimError
          );
        }

        const {
          error: postClaimError,
        } = await supabase
          .from("posts")
          .update({
            user_id: userId,
          })
          .eq(
            "device_id",
            deviceId
          )
          .is(
            "user_id",
            null
          );

        if (postClaimError) {
          console.error(
            "Lỗi gắn bài viết vào tài khoản:",
            postClaimError
          );
        }
      } catch (error) {
        console.error(
          "Lỗi claim dữ liệu:",
          error
        );
      }
    };

  // ============================================
  // LOAD DATA FROM SUPABASE
  // ============================================

  useEffect(() => {
    if (!authReady) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setMessage("");

      try {
        const deviceId =
          getDeviceId();

        const currentUserId =
          user?.id ?? null;

        if (currentUserId) {
          await claimDeviceDataForUser(
            currentUserId
          );
        }

        const {
          data: checkpointData,
          error: checkpointError,
        } = await supabase
          .from("checkpoints")
          .select(
            "id, name, description, icon, badge, longitude, latitude"
          )
          .order("id", {
            ascending: true,
          });

        if (checkpointError) {
          console.error(
            "Lỗi lấy checkpoints:",
            checkpointError
          );

          setMessage(
            "Không thể tải checkpoint từ Supabase."
          );

          setLoading(false);
          return;
        }

        const loadedCheckpoints = checkpointData ?? [];

        // Checkpoints được quản lý bằng master SQL.
        // Client chỉ đọc dữ liệu, không tự INSERT để tránh vi phạm RLS.
        setCheckpoints(
          loadedCheckpoints
        );

        checkpointsRef.current =
          loadedCheckpoints;

        let checkinQuery =
          supabase
            .from("checkins")
            .select(
              "checkpoint_id, user_id, created_at"
            );

        if (currentUserId) {
          checkinQuery =
            checkinQuery.eq(
              "user_id",
              currentUserId
            );
        } else {
          checkinQuery =
            checkinQuery
              .eq(
                "device_id",
                deviceId
              )
              .is(
                "user_id",
                null
              );
        }

        const {
          data: checkinData,
          error: checkinError,
        } = await checkinQuery;

        if (checkinError) {
          console.error(
            "Lỗi lấy checkins:",
            checkinError
          );

          setMessage(
            "Checkpoint đã tải, nhưng chưa thể tải tiến độ check-in."
          );
        } else {
          const loadedCheckins =
            checkinData ?? [];

          setCheckins(
            loadedCheckins
          );

          checkinsRef.current =
            loadedCheckins;

          previousCheckins.current =
            loadedCheckins.map(
              (item) =>
                item.checkpoint_id
            );
        }
      } catch (error) {
        console.error(
          "Lỗi kết nối Supabase:",
          error
        );

        setMessage(
          "Có lỗi khi kết nối với Supabase."
        );
      }

      setLoading(false);
    };

    loadData();
  }, [
    authReady,
    user?.id,
  ]);

  // ============================================
  // LOAD UGC POSTS
  // ============================================

  const loadPosts = async () => {
    setPostsLoading(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("posts")
        .select(
          `
            id,
            device_id,
            user_id,
            checkpoint_id,
            content,
            likes,
            created_at,
            image_url,
            checkpoint:checkpoints (
              id,
              name,
              description,
              icon,
              badge,
              longitude,
              latitude
            )
          `
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (error) {
        console.error(
          "Lỗi lấy bài viết:",
          error
        );

        setPostMessage(
          "Không thể tải bài viết từ Supabase."
        );

        setPostsLoading(false);
        return;
      }

      const normalizedPosts: Post[] =
        (data ?? []).map(
          (item: PostQueryRow) => {
            let checkpoint =
              item.checkpoint ??
              null;

            if (
              Array.isArray(
                checkpoint
              )
            ) {
              checkpoint =
                checkpoint[0] ??
                null;
            }

            return {
              id: item.id,
              device_id:
                item.device_id,
              user_id:
                item.user_id ??
                null,
              checkpoint_id:
                item.checkpoint_id,
              content:
                item.content,
              likes:
                item.likes ?? 0,
              created_at:
                item.created_at,
              image_url:
                item.image_url ??
                null,
              checkpoint,
            };
          }
        );

      setPosts(
        normalizedPosts
      );
    } catch (error) {
      console.error(
        "Lỗi load UGC:",
        error
      );

      setPostMessage(
        "Không thể tải cộng đồng TravelQuest."
      );
    }

    setPostsLoading(false);
  };

  useEffect(() => {
    queueMicrotask(() => {
      if (!authReady) {
        return;
      }

      void loadPosts();
    });
  }, [
    authReady,
    user?.id,
  ]);

  // ============================================
  // LOAD UGC COMMENTS
  // ============================================

  const loadComments = async () => {
    if (!user?.id) {
      setComments([]);
      return;
    }

    setCommentsLoading(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("post_comments")
        .select(
          "id, post_id, user_id, content, created_at"
        )
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Lỗi lấy bình luận:",
          error
        );

        setComments([]);
        return;
      }

      setComments(
        (data ?? []) as PostComment[]
      );
    } catch (error) {
      console.error(
        "Lỗi load bình luận:",
        error
      );

      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      if (!authReady || !user?.id) {
        setComments([]);
        return;
      }

      void loadComments();
    });
  }, [
    authReady,
    user?.id,
  ]);

  // ============================================
  // LOAD UGC LIKES
  // ============================================

  const loadLikedPosts = async () => {
    if (!user?.id) {
      setLikedPostIds([]);
      return;
    }

    try {
      const {
        data,
        error,
      } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", user.id);

      if (error) {
        console.error(
          "Lỗi lấy trạng thái like:",
          error
        );

        setLikedPostIds([]);
        return;
      }

      setLikedPostIds(
        (data ?? []).map(
          (item) => Number(item.post_id)
        )
      );
    } catch (error) {
      console.error(
        "Lỗi load trạng thái like:",
        error
      );

      setLikedPostIds([]);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      if (!authReady || !user?.id) {
        setLikedPostIds([]);
        return;
      }

      void loadLikedPosts();
    });
  }, [
    authReady,
    user?.id,
  ]);

  // ============================================
  // CREATE UGC COMMENT
  // ============================================

  const handleCreateComment = async (
    postId: number
  ) => {
    if (!user?.id) {
      setAuthOpen(true);
      setAuthMode("login");
      setAuthMessage(
        "🔐 Hãy đăng nhập để bình luận."
      );
      return;
    }

    const content =
      (commentInputs[postId] ?? "").trim();

    if (!content) {
      return;
    }

    if (content.length > 300) {
      setPostMessage(
        "Bình luận tối đa 300 ký tự."
      );
      return;
    }

    setCommentLoading((current) => ({
      ...current,
      [postId]: true,
    }));

    try {
      const {
        data,
        error,
      } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          content,
        })
        .select(
          "id, post_id, user_id, content, created_at"
        )
        .single();

      if (error) {
        console.error(
          "Lỗi tạo bình luận:",
          error
        );

        setPostMessage(
          "❌ Không thể đăng bình luận. Hãy thử lại."
        );
        return;
      }

      if (data) {
        setComments((current) => [
          ...current,
          data as PostComment,
        ]);
      }

      setCommentInputs((current) => ({
        ...current,
        [postId]: "",
      }));
    } catch (error) {
      console.error(
        "Lỗi comment:",
        error
      );

      setPostMessage(
        "❌ Có lỗi khi đăng bình luận."
      );
    } finally {
      setCommentLoading((current) => ({
        ...current,
        [postId]: false,
      }));
    }
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
    setCameraError("");
  };

  const openCamera = async () => {
    if (!user?.id) {
      setAuthOpen(true);
      setAuthMode("login");
      setAuthMessage("🔐 Hãy đăng nhập để chụp và đăng moment.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Trình duyệt này không hỗ trợ camera. Cậu có thể chọn ảnh từ máy.");
      return;
    }

    stopCamera();
    setCameraError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          void cameraVideoRef.current.play();
        }
      });
    } catch (error) {
      console.error("Lỗi mở camera:", error);
      setCameraError("Không mở được camera. Hãy cấp quyền camera cho trình duyệt rồi thử lại.");
    }
  };

  const switchCamera = async () => {
    const nextFacing = cameraFacing === "user" ? "environment" : "user";
    setCameraFacing(nextFacing);

    if (!cameraOpen) return;

    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play();
      }
    } catch (error) {
      console.error("Lỗi đổi camera:", error);
      setCameraError("Không thể đổi camera.");
    }
  };

  const captureCameraPhoto = () => {
    const video = cameraVideoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      setCameraError("Camera chưa sẵn sàng, thử lại sau một chút.");
      return;
    }

    const canvas = document.createElement("canvas");
    const maxWidth = 1440;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Không thể chụp ảnh trên thiết bị này.");
      return;
    }

    if (cameraFacing === "user") {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError("Không tạo được ảnh. Thử lại nhé.");
        return;
      }

      const file = new File([blob], `travelquest-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      setPostMessage("");
      closeCamera();
      setCameraPreviewOpen(true);
    }, "image/jpeg", 0.9);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  // ============================================
  // IMAGE PREVIEW CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }
    };
  }, [imagePreview]);

  // ============================================
  // SELECT IMAGE
  // ============================================

  const handleSelectImage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setPostMessage(
        "⚠️ Vui lòng chọn một file ảnh."
      );

      event.target.value = "";
      return;
    }

    const maxSize =
      5 * 1024 * 1024;

    if (file.size > maxSize) {
      setPostMessage(
        "⚠️ Ảnh tối đa 5MB."
      );

      event.target.value = "";
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    const preview =
      URL.createObjectURL(
        file
      );

    setSelectedImage(file);
    setImagePreview(preview);
    setPostMessage("");
    if (cameraOpen) closeCamera();
    setCameraPreviewOpen(true);
  };

  // ============================================
  // REMOVE SELECTED IMAGE
  // ============================================

  const handleRemoveImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    setSelectedImage(null);
    setImagePreview(null);
    setCameraPreviewOpen(false);

    if (imageInputRef.current) {
      imageInputRef.current.value =
        "";
    }
  };

  // ============================================
  // SHOW BADGE WHEN NEW CHECK-IN IS ADDED
  // ============================================

  useEffect(() => {
    if (
      checkpoints.length === 0
    ) {
      return;
    }

    const currentIds =
      checkins.map(
        (item) =>
          item.checkpoint_id
      );

    const newCheckpointId =
      currentIds.find(
        (id) =>
          !previousCheckins.current.includes(
            id
          )
      );

    if (
      newCheckpointId !==
      undefined
    ) {
      const checkpoint =
        checkpoints.find(
          (item) =>
            item.id ===
            newCheckpointId
        );

      if (checkpoint) {
        setUnlockedBadge(
          checkpoint
        );

        if (
          badgePopupTimer.current
        ) {
          clearTimeout(
            badgePopupTimer.current
          );
        }

        badgePopupTimer.current =
          setTimeout(() => {
            setUnlockedBadge(
              null
            );
          }, 4500);
      }
    }

    previousCheckins.current =
      currentIds;
  }, [
    checkins,
    checkpoints,
  ]);

  // ============================================
  // CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      if (gpsWatchId.current !== null) {
        stopWatchingLocation(
          gpsWatchId.current
        );
      }

      gpsWatchId.current =
        null;

      if (
        badgePopupTimer.current
      ) {
        clearTimeout(
          badgePopupTimer.current
        );
      }

      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }
    };
  }, []);

  // ============================================
  // AUTO CHECK-IN / GEOFENCING
  // ============================================

  const autoCheckIn = async (
    location: GPSLocation
  ) => {
    const currentCheckpoints =
      checkpointsRef.current;

    const currentCheckins =
      checkinsRef.current;

    if (
      currentCheckpoints.length ===
      0
    ) {
      return;
    }

    let nearestCheckpoint:
      | Checkpoint
      | null = null;

    let nearestDistance =
      Infinity;

    for (
      const checkpoint of
        currentCheckpoints
    ) {
      const currentDistance =
        getValidGpsDistance(
          location,
          checkpoint
        );

      if (currentDistance === null) {
        continue;
      }

      if (
        currentDistance <
        nearestDistance
      ) {
        nearestDistance =
          currentDistance;

        nearestCheckpoint =
          checkpoint;
      }
    }

    if (
      !nearestCheckpoint ||
      !Number.isFinite(nearestDistance)
    ) {
      setDistance(null);
      setMessage(GPS_DISTANCE_UNAVAILABLE);
      return;
    }

    const roundedDistance =
      Math.round(
        nearestDistance
      );

    if (
      nearestDistance <=
      CHECKIN_RADIUS
    ) {
      if (
        geofenceCheckpointId.current !==
        nearestCheckpoint.id
      ) {
        geofenceCheckpointId.current =
          nearestCheckpoint.id;

        setDistance(
          roundedDistance
        );

        setMessage(
          `📍 Bạn đã vào vùng ${nearestCheckpoint.name}!`
        );
      }

      const alreadyCheckedIn =
        currentCheckins.some(
          (item) =>
            item.checkpoint_id ===
            nearestCheckpoint!.id
        );

      if (
        alreadyCheckedIn
      ) {
        if (
          selectedCheckpointRef.current
            ?.id ===
          nearestCheckpoint.id
        ) {
          setMessage(
            `🏆 Bạn đã chinh phục ${nearestCheckpoint.name}!`
          );
        }

        return;
      }

      if (
        autoCheckinInProgress.current.has(
          nearestCheckpoint.id
        )
      ) {
        return;
      }

      autoCheckinInProgress.current.add(
        nearestCheckpoint.id
      );

      const deviceId =
        getDeviceId();

      const currentUserId =
        user?.id ?? null;

      setMessage(
        `🎉 Đang tự động check-in tại ${nearestCheckpoint.name}...`
      );

      try {
        const {
          data,
          error,
        } = await supabase
          .from("checkins")
          .insert({
            device_id:
              deviceId,
            user_id:
              currentUserId,
            checkpoint_id:
              nearestCheckpoint.id,
          })
          .select(
            "checkpoint_id, user_id"
          )
          .single();

        if (error) {
          console.error(
            "Lỗi Auto Check-in:",
            error
          );

          if (
            error.code ===
            "23505"
          ) {
            setCheckins(
              (current) => {
                if (
                  current.some(
                    (item) =>
                      item.checkpoint_id ===
                      nearestCheckpoint!.id
                  )
                ) {
                  return current;
                }

                const updated = [
                  ...current,
                  {
                    checkpoint_id:
                      nearestCheckpoint!.id,
                    user_id:
                      currentUserId,
                  },
                ];

                checkinsRef.current =
                  updated;

                return updated;
              }
            );

            setMessage(
              `🏆 Bạn đã chinh phục ${nearestCheckpoint.name}!`
            );
          } else {
            setMessage(
              "⚠️ Không thể tự động check-in. Hãy thử lại."
            );
          }

          return;
        }

        if (data) {
          setCheckins(
            (current) => {
              if (
                current.some(
                  (item) =>
                    item.checkpoint_id ===
                    data.checkpoint_id
                )
              ) {
                return current;
              }

              const updated = [
                ...current,
                data,
              ];

              checkinsRef.current =
                updated;

              return updated;
            }
          );
        }

        setSelectedCheckpoint(
          nearestCheckpoint
        );

        selectedCheckpointRef.current =
          nearestCheckpoint;

        setDistance(
          roundedDistance
        );

        setMessage(
          `🏆 Auto Check-in thành công tại ${nearestCheckpoint.name}!`
        );
      } catch (error) {
        console.error(
          "Lỗi Auto Check-in:",
          error
        );

        setMessage(
          "⚠️ Có lỗi khi tự động check-in."
        );
      } finally {
        autoCheckinInProgress.current.delete(
          nearestCheckpoint.id
        );
      }

      return;
    }

    if (
      geofenceCheckpointId.current !==
        null &&
      nearestDistance >
        GEOFENCE_EXIT_RADIUS
    ) {
      const previousCheckpoint =
        currentCheckpoints.find(
          (checkpoint) =>
            checkpoint.id ===
            geofenceCheckpointId.current
        );

      geofenceCheckpointId.current =
        null;

      setMessage(
        previousCheckpoint
          ? `📍 Bạn đã rời khỏi vùng ${previousCheckpoint.name}.`
          : "📍 Bạn đã rời khỏi vùng checkpoint."
      );
    }

    if (
      selectedCheckpointRef.current
        ?.id ===
      nearestCheckpoint.id
    ) {
      setDistance(
        roundedDistance
      );
    }
  };

  // ============================================
  // GET GPS LOCATION
  // ============================================

  const updateLocation =
    async () => {
      setLocationLoading(true);
      setMessage("");

      try {
        const location =
          await getCurrentLocation();

        setUserLocation(
          location
        );

        void publishOwnLocation(location);

        await autoCheckIn(
          location
        );

        const currentSelected =
          selectedCheckpointRef.current;

        if (
          currentSelected
        ) {
          const currentDistance =
            getValidGpsDistance(
              location,
              currentSelected
            );

          if (currentDistance === null) {
            setDistance(null);
            setMessage(GPS_DISTANCE_UNAVAILABLE);
            return;
          }

          const roundedDistance =
            Math.round(
              currentDistance
            );

          setDistance(
            roundedDistance
          );

          if (
            currentDistance <=
            CHECKIN_RADIUS
          ) {
            setMessage(
              `✅ Bạn đang ở trong vùng check-in của ${currentSelected.name}!`
            );
          } else if (
            currentDistance <=
            GEOFENCE_EXIT_RADIUS
          ) {
            setMessage(
              `📍 Bạn đang ở gần ${currentSelected.name} — còn ${roundedDistance}m.`
            );
          } else {
            setMessage(
              `📍 Bạn đang cách checkpoint khoảng ${roundedDistance}m.`
            );
          }
        }
      } catch (error) {
        console.error(
          "Lỗi GPS:",
          error
        );

        if (
          error instanceof Error
        ) {
          setMessage(
            error.message
          );
        } else {
          setMessage(
            "Không thể lấy vị trí hiện tại."
          );
        }
      }

      setLocationLoading(false);
    };

  // ============================================
  // START WATCHING GPS
  // ============================================

  const startWatchingGPS =
    () => {
      if (
        gpsWatchId.current !==
        null
      ) {
        return;
      }

      setLocationLoading(true);

      setMessage(
        "📡 TravelQuest đang theo dõi vị trí..."
      );

      const watchId =
        watchCurrentLocation(
          async (location) => {
            setUserLocation(
              location
            );

            void publishOwnLocation(location);

            setLocationLoading(
              false
            );

            await autoCheckIn(
              location
            );

            const currentSelected =
              selectedCheckpointRef.current;

            if (
              currentSelected
            ) {
              const currentDistance =
                getValidGpsDistance(
                  location,
                  currentSelected
                );

              if (currentDistance === null) {
                setDistance(null);
                setMessage(GPS_DISTANCE_UNAVAILABLE);
                return;
              }

              const roundedDistance =
                Math.round(
                  currentDistance
                );

              setDistance(
                roundedDistance
              );

              if (
                currentDistance <=
                CHECKIN_RADIUS
              ) {
                setMessage(
                  `✅ Bạn đang ở trong vùng check-in của ${currentSelected.name}!`
                );
              } else if (
                currentDistance <=
                GEOFENCE_EXIT_RADIUS
              ) {
                setMessage(
                  `📍 Bạn đang gần ${currentSelected.name} — còn ${roundedDistance}m.`
                );
              } else {
                setMessage(
                  `📍 Bạn đang cách checkpoint khoảng ${roundedDistance}m.`
                );
              }
            }
          },
          (error) => {
            console.error(
              "Lỗi theo dõi GPS:",
              error
            );

            setLocationLoading(
              false
            );

            setMessage(
              error.message
            );
          }
        );

      gpsWatchId.current =
        watchId;
    };

  // ============================================
  // AUTO START GPS WHEN APP OPENS
  // ============================================

  useEffect(() => {
    if (!gpsEnabled || !authReady) return;

    let cancelled = false;

    const startGpsOnAppOpen = async () => {
      try {
        // Lấy vị trí ngay khi app mở. Nếu quyền đã được cấp,
        // trình duyệt sẽ không hỏi lại và GPS tự chạy.
        await updateLocation();

        if (!cancelled) {
          startWatchingGPS();
        }
      } catch (error) {
        console.error("Không thể tự khởi động GPS:", error);
      }
    };

    void startGpsOnAppOpen();

    return () => {
      cancelled = true;

      if (gpsWatchId.current !== null) {
        stopWatchingLocation(gpsWatchId.current);
        gpsWatchId.current = null;
      }
    };
    // Restart when authentication becomes ready or changes user.
    // This ensures the current user's location is published after login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsEnabled, authReady, user?.id]);

  // ============================================
  // SELECT CHECKPOINT
  // ============================================

  const toggleSavedPlace = (checkpointId: number) => {
    setSavedPlaceIds((current) =>
      current.includes(checkpointId)
        ? current.filter((id) => id !== checkpointId)
        : [...current, checkpointId]
    );
  };

  const isSavedPlace = (checkpointId: number) =>
    savedPlaceIds.includes(checkpointId);

  const savedCheckpoints = checkpoints.filter((checkpoint) =>
    isSavedPlace(checkpoint.id)
  );

  // ============================================
  // HELPERS
  // ============================================

  const isCheckedIn = (
    checkpointId: number
  ) => {
    return checkins.some(
      (item) =>
        item.checkpoint_id ===
        checkpointId
    );
  };

  const journeyCheckpoints = checkpoints.filter((checkpoint) =>
    journeyCheckpointIds.includes(checkpoint.id)
  );

  const mapSearchResults = checkpoints
    .filter((checkpoint) => {
      const query = mapSearchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        checkpoint.name.toLowerCase().includes(query) ||
        (checkpoint.description ?? "").toLowerCase().includes(query);

      if (!matchesQuery) return false;

      if (mapFilter === "unvisited") {
        return !isCheckedIn(checkpoint.id);
      }

      if (mapFilter === "saved") {
        return isSavedPlace(checkpoint.id);
      }

      if (mapFilter === "nearby") {
        if (!userLocation) return false;
        const checkpointDistance = getValidGpsDistance(userLocation, checkpoint);
        return checkpointDistance !== null && checkpointDistance <= 50000;
      }

      return true;
    })
    .slice(0, 6);

  const journeyCompletedCount = journeyCheckpoints.filter((checkpoint) =>
    isCheckedIn(checkpoint.id)
  ).length;

  const journeyProgress =
    journeyCheckpoints.length > 0
      ? Math.round(
          (journeyCompletedCount / journeyCheckpoints.length) * 100
        )
      : 0;

  const toggleJourneyCheckpoint = (checkpointId: number) => {
    setJourneyCheckpointIds((current) =>
      current.includes(checkpointId)
        ? current.filter((id) => id !== checkpointId)
        : [...current, checkpointId]
    );
  };

  const startJourney = () => {
    if (journeyCheckpointIds.length === 0) return;
    setJourneyStarted(true);
    setJourneyOpen(false);
    setMessage(`🧭 Đã bắt đầu ${journeyName.trim() || "hành trình của bạn"}.`);
  };

  const finishJourney = () => {
    setJourneyStarted(false);
    setMessage("🏁 Hành trình đã kết thúc. Dữ liệu checkpoint vẫn được giữ lại.");
  };

  const clearJourney = () => {
    setJourneyStarted(false);
    setJourneyCheckpointIds([]);
    setJourneyName("Hành trình Hà Nội");
  };

  const selectCheckpoint = (
    checkpoint: Checkpoint
  ) => {
    setSelectedCheckpoint(
      checkpoint
    );

    selectedCheckpointRef.current =
      checkpoint;

    setDistance(null);
    setMessage("");

    startWatchingGPS();
  };

  const loadCheckpointWeather = async (checkpoint: Checkpoint) => {
    setWeatherLoading(true);
    setWeatherError("");

    try {
      const params = new URLSearchParams({
        latitude: String(checkpoint.latitude),
        longitude: String(checkpoint.longitude),
        current: [
          "temperature_2m",
          "apparent_temperature",
          "relative_humidity_2m",
          "wind_speed_10m",
          "weather_code",
        ].join(","),
        daily: [
          "weather_code",
          "temperature_2m_max",
          "temperature_2m_min",
        ].join(","),
        timezone: "auto",
        forecast_days: "5",
      });

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Không thể lấy dữ liệu thời tiết.");
      }

      const data = await response.json();

      const current = data.current;
      const daily = data.daily;

      if (!current || !daily) {
        throw new Error("Dữ liệu thời tiết không hợp lệ.");
      }

      setWeather({
        current: {
          temperature: Number(current.temperature_2m),
          apparentTemperature: Number(current.apparent_temperature),
          humidity: Number(current.relative_humidity_2m),
          windSpeed: Number(current.wind_speed_10m),
          weatherCode: Number(current.weather_code),
        },
        daily: (daily.time ?? []).map((date: string, index: number) => ({
          date,
          weatherCode: Number(daily.weather_code?.[index] ?? 0),
          temperatureMax: Number(daily.temperature_2m_max?.[index] ?? 0),
          temperatureMin: Number(daily.temperature_2m_min?.[index] ?? 0),
        })),
      });
    } catch (error: unknown) {
      const details =
        typeof error === "object" && error !== null
          ? (error as { message?: string }).message
          : undefined;

      setWeatherError(details || "Không thể tải thời tiết lúc này.");
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  const weatherDescription = (code: number) => {
    if (code === 0) return { icon: "☀️", label: "Trời quang" };
    if ([1, 2].includes(code)) return { icon: "🌤️", label: "Có mây nhẹ" };
    if (code === 3) return { icon: "☁️", label: "Nhiều mây" };
    if ([45, 48].includes(code)) return { icon: "🌫️", label: "Sương mù" };
    if ([51, 53, 55, 56, 57].includes(code)) return { icon: "🌦️", label: "Mưa phùn" };
    if ([61, 63, 65, 66, 67].includes(code)) return { icon: "🌧️", label: "Mưa" };
    if ([71, 73, 75, 77].includes(code)) return { icon: "🌨️", label: "Tuyết" };
    if ([80, 81, 82].includes(code)) return { icon: "🌦️", label: "Mưa rào" };
    if ([85, 86].includes(code)) return { icon: "🌨️", label: "Mưa tuyết" };
    if ([95, 96, 99].includes(code)) return { icon: "⛈️", label: "Dông" };
    return { icon: "🌤️", label: "Thời tiết" };
  };

  const bookingSearchQuery = selectedCheckpoint
    ? encodeURIComponent(`${selectedCheckpoint.name}, Hanoi, Vietnam`)
    : "";

  const bookingOptions = selectedCheckpoint
    ? [
        {
          icon: "🏨",
          title: "Lưu trú",
          description: "Tìm khách sạn, homestay và nơi ở gần checkpoint.",
          links: [
            { label: "Booking.com", url: `https://www.booking.com/searchresults.html?ss=${bookingSearchQuery}` },
            { label: "Google Maps", url: `https://www.google.com/maps/search/?api=1&query=${bookingSearchQuery}+hotel` },
          ],
        },
        {
          icon: "🍜",
          title: "Ăn uống",
          description: "Khám phá nhà hàng và quán ăn quanh địa điểm.",
          links: [
            { label: "Google Maps", url: `https://www.google.com/maps/search/?api=1&query=${bookingSearchQuery}+restaurant` },
          ],
        },
        {
          icon: "🎟️",
          title: "Vé & trải nghiệm",
          description: "Tìm tour, vé tham quan và hoạt động gần đây.",
          links: [
            { label: "GetYourGuide", url: `https://www.getyourguide.com/s/?q=${bookingSearchQuery}` },
            { label: "Google Maps", url: `https://www.google.com/maps/search/?api=1&query=${bookingSearchQuery}+tour` },
          ],
        },
      ]
    : [];

  const formatWeatherDate = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString("vi-VN", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });

  const loadCheckpointReviews = async (checkpointId: number) => {
    setReviewLoading(true);
    setReviewMessage("");

    try {
      const { data, error } = await supabase
        .from("checkpoint_reviews")
        .select(
          "id, checkpoint_id, user_id, rating, review, created_at, updated_at"
        )
        .eq("checkpoint_id", checkpointId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Lỗi tải đánh giá checkpoint:", error);
        setCheckpointReviews([]);
        setReviewMessage("❌ Không thể tải đánh giá lúc này.");
        return;
      }

      const rows = (data ?? []) as Array<{
        id: number;
        checkpoint_id: number;
        user_id: string;
        rating: number;
        review: string;
        created_at: string;
        updated_at: string;
      }>;

      const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
      let profileMap = new globalThis.Map<string, string>();

      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);

        if (!profileError) {
          profileMap = new globalThis.Map(
            (profiles ?? []).map((profile) => [
              profile.id as string,
              (profile.display_name as string) || "Traveller",
            ])
          );
        }
      }

      setCheckpointReviews(
        rows.map((row) => ({
          ...row,
          display_name: profileMap.get(row.user_id) || "Traveller",
        }))
      );

      if (user?.id) {
        const ownReview = rows.find((row) => row.user_id === user.id);
        setReviewRating(ownReview?.rating ?? 5);
        setReviewText(ownReview?.review ?? "");
      }
    } catch (error) {
      console.error("Lỗi load đánh giá checkpoint:", error);
      setCheckpointReviews([]);
      setReviewMessage("❌ Có lỗi khi tải đánh giá.");
    } finally {
      setReviewLoading(false);
    }
  };

  const submitCheckpointReview = async () => {
    if (!selectedCheckpoint) return;

    if (!user?.id) {
      setReviewMessage("🔐 Hãy đăng nhập để đánh giá checkpoint.");
      return;
    }

    const trimmedReview = reviewText.trim();

    if (!trimmedReview) {
      setReviewMessage("✍️ Hãy viết vài dòng đánh giá.");
      return;
    }

    if (trimmedReview.length > 500) {
      setReviewMessage("✍️ Đánh giá tối đa 500 ký tự.");
      return;
    }

    if (!Number.isInteger(reviewRating) || reviewRating < 1 || reviewRating > 5) {
      setReviewMessage("⭐ Số sao phải từ 1 đến 5.");
      return;
    }

    setReviewSubmitting(true);
    setReviewMessage("");

    try {
      const { error } = await supabase.from("checkpoint_reviews").upsert(
        {
          checkpoint_id: selectedCheckpoint.id,
          user_id: user.id,
          rating: reviewRating,
          review: trimmedReview,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "checkpoint_id,user_id" }
      );

      if (error) {
        console.error("Lỗi lưu đánh giá checkpoint:", error);
        setReviewMessage(
          "❌ Không thể lưu đánh giá. Kiểm tra database/RLS."
        );
        return;
      }

      setReviewMessage("✅ Đã lưu đánh giá của bạn.");
      await loadCheckpointReviews(selectedCheckpoint.id);
    } catch (error) {
      console.error("Lỗi submit đánh giá checkpoint:", error);
      setReviewMessage("❌ Có lỗi khi lưu đánh giá.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const deleteCheckpointReview = async () => {
    if (!selectedCheckpoint || !user?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Bạn có chắc muốn xóa đánh giá của mình tại checkpoint này?"
    );

    if (!confirmed) {
      return;
    }

    setReviewSubmitting(true);
    setReviewMessage("");

    try {
      const { error } = await supabase
        .from("checkpoint_reviews")
        .delete()
        .eq("checkpoint_id", selectedCheckpoint.id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Lỗi xóa đánh giá checkpoint:", error);
        setReviewMessage("❌ Không thể xóa đánh giá. Hãy thử lại.");
        return;
      }

      setReviewRating(5);
      setReviewText("");
      setReviewMessage("🗑️ Đã xóa đánh giá của bạn.");
      await loadCheckpointReviews(selectedCheckpoint.id);
    } catch (error) {
      console.error("Lỗi delete review checkpoint:", error);
      setReviewMessage("❌ Có lỗi khi xóa đánh giá.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openCheckpointDetail = () => {
    if (!selectedCheckpoint) return;
    setCheckpointDetailOpen(true);
    setReviewMessage("");
    void loadCheckpointWeather(selectedCheckpoint);
    void loadCheckpointReviews(selectedCheckpoint.id);
  };


  // ============================================
  // MANUAL CHECK-IN WITH GPS
  // ============================================

  const handleCheckIn =
    async () => {
      if (!user?.id) {
        setAuthOpen(true);
        setAuthMode("login");
        setAuthMessage("🔐 Hãy đăng nhập để check-in checkpoint.");
        return;
      }

      const currentSelected =
        selectedCheckpointRef.current;

      if (
        !currentSelected ||
        checkingIn
      ) {
        return;
      }

      const alreadyCheckedIn =
        checkinsRef.current.some(
          (item) =>
            item.checkpoint_id ===
            currentSelected.id
        );

      if (
        alreadyCheckedIn
      ) {
        setMessage(
          `Bạn đã check-in ${currentSelected.name} rồi!`
        );

        return;
      }

      setCheckingIn(true);
      setMessage("");
      setDistance(null);

      try {
        const location =
          await getCurrentLocation();

        setUserLocation(
          location
        );

        const currentDistance =
          getValidGpsDistance(
            location,
            currentSelected
          );

        if (currentDistance === null) {
          setDistance(null);
          setMessage(GPS_DISTANCE_UNAVAILABLE);
          setCheckingIn(false);
          return;
        }

        const roundedDistance =
          Math.round(
            currentDistance
          );

        setDistance(
          roundedDistance
        );

        if (
          currentDistance >
          CHECKIN_RADIUS
        ) {
          setMessage(
            `🔒 Bạn đang cách checkpoint ${roundedDistance}m. Hãy đến gần hơn ${CHECKIN_RADIUS}m để check-in.`
          );

          setCheckingIn(false);
          return;
        }

        const deviceId =
          getDeviceId();

        const currentUserId =
          user?.id ?? null;

        const {
          data,
          error,
        } = await supabase
          .from("checkins")
          .insert({
            device_id:
              deviceId,
            user_id:
              currentUserId,
            checkpoint_id:
              currentSelected.id,
          })
          .select(
            "checkpoint_id, user_id"
          )
          .single();

        if (error) {
          console.error(
            "Lỗi check-in:",
            error
          );

          if (
            error.code ===
            "23505"
          ) {
            setMessage(
              "🏆 Bạn đã check-in checkpoint này rồi!"
            );

            setCheckins(
              (current) => {
                if (
                  current.some(
                    (item) =>
                      item.checkpoint_id ===
                      currentSelected.id
                  )
                ) {
                  return current;
                }

                const updated = [
                  ...current,
                  {
                    checkpoint_id:
                      currentSelected.id,
                    user_id:
                      currentUserId,
                  },
                ];

                checkinsRef.current =
                  updated;

                return updated;
              }
            );
          } else {
            setMessage(
              "Check-in thất bại. Hãy thử lại."
            );
          }

          setCheckingIn(false);
          return;
        }

        if (data) {
          setCheckins(
            (current) => {
              if (
                current.some(
                  (item) =>
                    item.checkpoint_id ===
                    data.checkpoint_id
                )
              ) {
                return current;
              }

              const updated = [
                ...current,
                data,
              ];

              checkinsRef.current =
                updated;

              return updated;
            }
          );
        }

        geofenceCheckpointId.current =
          currentSelected.id;

        setMessage(
          `🎉 Check-in thành công tại ${currentSelected.name}!`
        );
      } catch (error) {
        console.error(
          "Lỗi check-in GPS:",
          error
        );

        if (
          error instanceof Error
        ) {
          setMessage(
            error.message
          );
        } else {
          setMessage(
            "Có lỗi xảy ra khi check-in."
          );
        }
      }

      setCheckingIn(false);
    };

  // ============================================
  // CREATE UGC POST
  // ============================================

  const handleCreatePost =
    async () => {
      if (!user?.id) {
        setAuthOpen(true);
        setAuthMode("login");
        setAuthMessage("🔐 Hãy đăng nhập để đăng UGC.");
        return;
      }

      const content =
        postContent.trim();

      if (!content && !selectedImage) {
        setPostMessage(
          "📸 Chụp ảnh hoặc viết một moment trước khi đăng."
        );
        return;
      }

      if (
        content &&
        content.length < 3
      ) {
        setPostMessage(
          "Bài viết cần ít nhất 3 ký tự."
        );
        return;
      }

      if (
        content.length > 1000
      ) {
        setPostMessage(
          "Bài viết tối đa 1000 ký tự."
        );

        return;
      }

      setPosting(true);
      setPostMessage("");

      try {
        const deviceId =
          getDeviceId();

        const currentUserId =
          user?.id ?? null;

        let imageUrl:
          | string
          | null = null;

        // ============================================
        // UPLOAD IMAGE TO SUPABASE STORAGE
        // ============================================

        if (selectedImage) {
          const originalName =
            selectedImage.name;

          const extension =
            originalName.includes(".")
              ? originalName
                  .split(".")
                  .pop()
                  ?.toLowerCase() ??
                "jpg"
              : "jpg";

          const safeExtension =
            [
              "jpg",
              "jpeg",
              "png",
              "webp",
              "gif",
            ].includes(
              extension
            )
              ? extension
              : "jpg";

          const filePath =
            `posts/${deviceId}-${Date.now()}.${safeExtension}`;

          const {
            error:
              uploadError,
          } = await supabase.storage
            .from(
              "post-images"
            )
            .upload(
              filePath,
              selectedImage,
              {
                cacheControl:
                  "3600",
                upsert: false,
                contentType:
                  selectedImage.type,
              }
            );

          if (
            uploadError
          ) {
            console.error(
              "Lỗi upload ảnh:",
              uploadError
            );

            setPostMessage(
              "⚠️ Không thể tải ảnh lên. Hãy kiểm tra bucket post-images."
            );

            setPosting(false);
            return;
          }

          const {
            data:
              publicUrlData,
          } =
            supabase.storage
              .from(
                "post-images"
              )
              .getPublicUrl(
                filePath
              );

          imageUrl =
            publicUrlData.publicUrl;
        }

        // ============================================
        // INSERT POST
        // ============================================

        const {
          error,
        } = await supabase
          .from("posts")
          .insert({
            device_id:
              deviceId,
            user_id:
              currentUserId,
            checkpoint_id:
              selectedPostCheckpoint,
            content: content || "📸 Khoảnh khắc của tôi",
            likes: 0,
            image_url:
              imageUrl,
          });

        if (error) {
          console.error(
            "Lỗi đăng bài:",
            error
          );

          setPostMessage(
            "Không thể đăng bài. Hãy kiểm tra Supabase."
          );

          setPosting(false);
          return;
        }

        setPostContent("");

        setSelectedPostCheckpoint(
          null
        );

        handleRemoveImage();

        setPostMessage(
          "🎉 Đăng bài thành công!"
        );
        setCameraPreviewOpen(false);

        await loadPosts();
      } catch (error) {
        console.error(
          "Lỗi tạo bài viết:",
          error
        );

        setPostMessage(
          "Có lỗi khi đăng bài."
        );
      }

      setPosting(false);
    };

  // ============================================
  // REPORT / MODERATION
  // ============================================

  const openReport = (
    targetType: ReportTargetType,
    targetId: string | number,
    label: string
  ) => {
    if (!user?.id) {
      setAuthOpen(true);
      setAuthMode("login");
      setAuthMessage(
        "🔐 Hãy đăng nhập để báo cáo nội dung."
      );
      return;
    }

    setReportTargetType(targetType);
    setReportTargetId(String(targetId));
    setReportTargetLabel(label);
    setReportReason("spam");
    setReportDetails("");
    setReportMessage("");
    setReportOpen(true);
  };

  const closeReport = () => {
    if (reportLoading) {
      return;
    }

    setReportOpen(false);
    setReportMessage("");
  };

  const handleSubmitReport = async () => {
    if (!user?.id) {
      setReportOpen(false);
      setAuthOpen(true);
      setAuthMode("login");
      setAuthMessage(
        "🔐 Hãy đăng nhập để báo cáo nội dung."
      );
      return;
    }

    if (!reportTargetId) {
      setReportMessage("Không xác định được nội dung cần báo cáo.");
      return;
    }

    setReportLoading(true);
    setReportMessage("");

    try {
      const { error } = await supabase
        .from("content_reports")
        .insert({
          reporter_id: user.id,
          post_id: reportTargetType === "post" ? Number(reportTargetId) : null,
          comment_id: reportTargetType === "comment" ? Number(reportTargetId) : null,
          reason: reportReason,
          description: reportDetails.trim() || null,
        });

      if (error) {
        console.error("Lỗi gửi báo cáo:", error);

        setReportMessage(
          "❌ Chưa thể gửi báo cáo. Hãy thử lại sau."
        );
        return;
      }

      setReportMessage(
        "✅ Đã gửi báo cáo. TravelQuest sẽ xem xét nội dung này."
      );
      setReportDetails("");

      window.setTimeout(() => {
        setReportOpen(false);
        setReportMessage("");
      }, 900);
    } catch (error) {
      console.error("Lỗi report:", error);
      setReportMessage("❌ Có lỗi khi gửi báo cáo.");
    } finally {
      setReportLoading(false);
    }
  };

  // ============================================
  // LIKE / UNLIKE UGC
  // ============================================

  const handleLike = async (
    post: Post
  ) => {
    if (!user?.id) {
      setAuthOpen(true);
      setAuthMode("login");
      setAuthMessage(
        "🔐 Hãy đăng nhập để thích bài viết."
      );
      return;
    }

    if (likeLoading[post.id]) {
      return;
    }

    const wasLiked =
      likedPostIds.includes(post.id);

    const optimisticLikes =
      Math.max(
        0,
        post.likes +
          (wasLiked ? -1 : 1)
      );

    setLikeLoading((current) => ({
      ...current,
      [post.id]: true,
    }));

    setLikedPostIds((current) =>
      wasLiked
        ? current.filter(
            (id) => id !== post.id
          )
        : current.includes(post.id)
        ? current
        : [...current, post.id]
    );

    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              likes: optimisticLikes,
            }
          : item
      )
    );

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        "toggle_post_like",
        {
          p_post_id: post.id,
        }
      );

      if (error) {
        throw error;
      }

      const result =
        Array.isArray(data)
          ? data[0]
          : data;

      const serverLiked =
        Boolean(result?.liked);

      const serverLikes =
        Number(result?.likes);

      setLikedPostIds((current) =>
        serverLiked
          ? current.includes(post.id)
            ? current
            : [...current, post.id]
          : current.filter(
              (id) => id !== post.id
            )
      );

      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                likes:
                  Number.isFinite(
                    serverLikes
                  )
                    ? serverLikes
                    : optimisticLikes,
              }
            : item
        )
      );
    } catch (error: unknown) {
      const errorInfo =
        error &&
        typeof error === "object"
          ? (error as {
              message?: string;
              details?: string;
              hint?: string;
              code?: string;
            })
          : {};

      console.error(
        "Lỗi like/unlike:",
        errorInfo.message,
        errorInfo.details,
        errorInfo.hint,
        errorInfo.code,
        error
      );

      setLikedPostIds((current) =>
        wasLiked
          ? current.includes(post.id)
            ? current
            : [...current, post.id]
          : current.filter(
              (id) => id !== post.id
            )
      );

      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                likes: post.likes,
              }
            : item
        )
      );

      setPostMessage(
        "❌ Không thể cập nhật lượt thích. Hãy thử lại."
      );
    } finally {
      setLikeLoading((current) => ({
        ...current,
        [post.id]: false,
      }));
    }
  };

  // ============================================
  // RESET
  // ============================================

  const resetProgress =
    async () => {
      const confirmed =
        window.confirm(
          user
            ? "Bạn có chắc muốn xóa toàn bộ check-in của tài khoản này?"
            : "Bạn có chắc muốn xóa toàn bộ check-in trên thiết bị này?"
        );

      if (!confirmed) {
        return;
      }

      const deviceId =
        getDeviceId();

      let deleteQuery =
        supabase
          .from("checkins")
          .delete();

      if (user?.id) {
        deleteQuery =
          deleteQuery.eq(
            "user_id",
            user.id
          );
      } else {
        deleteQuery =
          deleteQuery
            .eq(
              "device_id",
              deviceId
            )
            .is(
              "user_id",
              null
            );
      }

      const {
        error,
      } = await deleteQuery;

      if (error) {
        console.error(
          "Lỗi xóa check-in:",
          error
        );

        setMessage(
          "Không thể xóa dữ liệu check-in."
        );

        return;
      }

      setCheckins([]);
      checkinsRef.current = [];

      setSelectedCheckpoint(
        null
      );

      selectedCheckpointRef.current =
        null;

      setDistance(null);

      geofenceCheckpointId.current =
        null;

      autoCheckinInProgress.current.clear();

      setMessage(
        "Đã reset tiến độ check-in."
      );
    };

  const progress =
    checkpoints.length > 0
      ? Math.round(
          (checkins.length /
            checkpoints.length) *
            100
        )
      : 0;

  // ============================================
  // GAMIFICATION - XP & LEVEL
  // ============================================

  const XP_PER_CHECKPOINT = 100;
  const XP_PER_LEVEL = 500;

  const totalXP =
    checkins.length *
    XP_PER_CHECKPOINT +
    missionBonusXP;

  const currentLevel =
    Math.floor(
      totalXP / XP_PER_LEVEL
    ) + 1;

  const currentLevelXP =
    totalXP % XP_PER_LEVEL;

  const nextLevelXP =
    XP_PER_LEVEL -
    currentLevelXP;

  const levelProgress =
    Math.round(
      (currentLevelXP /
        XP_PER_LEVEL) *
        100
    );

  const canCheckIn =
    distance !== null &&
    distance <= CHECKIN_RADIUS;

  const userPostCount =
    user?.id
      ? posts.filter(
          (post) =>
            post.user_id ===
            user.id
        ).length
      : 0;

  const visiblePosts =
    posts.filter((post) => {
      const followingMatch =
        feedMode === "all" ||
        (post.user_id !== null && followingUserIds.includes(post.user_id));
      const checkpointMatch =
        !feedCheckpointId || post.checkpoint_id === feedCheckpointId;
      const hashtagMatch =
        !hashtagFilter.trim() ||
        post.content.toLowerCase().includes(hashtagFilter.trim().toLowerCase());
      return followingMatch && checkpointMatch && hashtagMatch;
    });

  // ============================================
  // GAMIFICATION - STREAK
  // ============================================

  const getLocalDateKey = (
    value: string | Date
  ) => {
    const date =
      value instanceof Date
        ? value
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const getDateKeyOffset = (
    date: Date,
    offset: number
  ) => {
    const result =
      new Date(date);

    result.setDate(
      result.getDate() + offset
    );

    return getLocalDateKey(result);
  };

  const checkinDateKeys = Array.from(
    new Set(
      checkins
        .map(
          (checkin) =>
            checkin.created_at
              ? getLocalDateKey(
                  checkin.created_at
                )
              : null
        )
        .filter(
          (
            dateKey
          ): dateKey is string =>
            Boolean(dateKey)
        )
    )
  ).sort();

  const checkinDateSet =
    new Set(checkinDateKeys);

  const calculateCurrentStreak =
    () => {
      if (
        checkinDateKeys.length ===
        0
      ) {
        return 0;
      }

      const today =
        new Date();

      const todayKey =
        getLocalDateKey(today);

      const yesterdayKey =
        getDateKeyOffset(
          today,
          -1
        );

      let cursorKey =
        checkinDateSet.has(
          todayKey ?? ""
        )
          ? todayKey
          : checkinDateSet.has(
              yesterdayKey ?? ""
            )
          ? yesterdayKey
          : null;

      if (!cursorKey) {
        return 0;
      }

      let streak = 0;

      while (
        cursorKey &&
        checkinDateSet.has(
          cursorKey
        )
      ) {
        streak += 1;

        const cursorDate =
          new Date(
            `${cursorKey}T12:00:00`
          );

        cursorKey =
          getDateKeyOffset(
            cursorDate,
            -1
          );
      }

      return streak;
    };

  const calculateBestStreak =
    () => {
      if (
        checkinDateKeys.length ===
        0
      ) {
        return 0;
      }

      let best = 1;
      let current = 1;

      for (
        let index = 1;
        index <
        checkinDateKeys.length;
        index += 1
      ) {
        const previousDate =
          new Date(
            `${checkinDateKeys[index - 1]}T12:00:00`
          );

        const expectedNext =
          getDateKeyOffset(
            previousDate,
            1
          );

        if (
          expectedNext ===
          checkinDateKeys[index]
        ) {
          current += 1;
          best = Math.max(
            best,
            current
          );
        } else {
          current = 1;
        }
      }

      return best;
    };

  const currentStreak =
    calculateCurrentStreak();

  const bestStreak =
    calculateBestStreak();

  const streakAchievementUnlocked =
    bestStreak >= 3;

  // ============================================
  // GAMIFICATION - ACHIEVEMENTS
  // ============================================

  const achievements = [
    {
      id: "first-checkpoint",
      icon: "🌱",
      name: "Khởi hành",
      description: "Chinh phục checkpoint đầu tiên.",
      unlocked: checkins.length >= 1,
    },
    {
      id: "three-day-streak",
      icon: "🔥",
      name: "Giữ lửa",
      description: "Chinh phục checkpoint trong 3 ngày liên tiếp.",
      unlocked: streakAchievementUnlocked,
    },
    {
      id: "two-checkpoints",
      icon: "🗺️",
      name: "Nhà khám phá",
      description: "Chinh phục ít nhất 2 checkpoint.",
      unlocked: checkins.length >= 2,
    },
    {
      id: "halfway",
      icon: "🔥",
      name: "Đang tăng tốc",
      description: "Hoàn thành ít nhất 50% checkpoint.",
      unlocked:
        checkpoints.length > 0 &&
        checkins.length >= Math.ceil(checkpoints.length / 2),
    },
    {
      id: "all-checkpoints",
      icon: "👑",
      name: "Hanoi Master",
      description: "Chinh phục toàn bộ checkpoint hiện có.",
      unlocked:
        checkpoints.length > 0 &&
        checkins.length >= checkpoints.length,
    },
    {
      id: "first-post",
      icon: "📸",
      name: "Người kể chuyện",
      description: "Đăng bài UGC đầu tiên.",
      unlocked: userPostCount >= 1,
    },
    {
      id: "five-posts",
      icon: "🎒",
      name: "Travel Creator",
      description: "Đăng ít nhất 5 bài UGC.",
      unlocked: userPostCount >= 5,
    },
  ];

  const unlockedAchievementCount =
    achievements.filter(
      (achievement) =>
        achievement.unlocked
    ).length;


  const regionalBadges = [
    { id: "old-quarter", icon: "🏮", name: "Phố cổ", description: "Chinh phục điểm khám phá khu phố cổ.", unlocked: checkins.length >= 1 },
    { id: "ba-dinh", icon: "🏛️", name: "Ba Đình", description: "Chinh phục điểm khám phá khu vực Ba Đình.", unlocked: checkins.some((item) => checkpoints.find((c) => c.id === item.checkpoint_id)?.name.includes("Lăng") || checkpoints.find((c) => c.id === item.checkpoint_id)?.name.includes("Hoàng thành")) },
    { id: "dong-da", icon: "🎓", name: "Đống Đa", description: "Chinh phục Văn Miếu - Quốc Tử Giám.", unlocked: checkins.some((item) => checkpoints.find((c) => c.id === item.checkpoint_id)?.name.includes("Văn Miếu")) },
  ];

  const dailyMissionKey = getLocalDateKey(new Date()) ?? "unknown";
  const dailyMissions = [
    { id: "checkin", icon: "📍", title: "Khám phá hôm nay", description: "Chinh phục 1 checkpoint hôm nay", reward: 50, done: checkins.some((item) => item.created_at && getLocalDateKey(item.created_at) === dailyMissionKey) },
    { id: "save", icon: "🔖", title: "Lên lịch khám phá", description: "Lưu 1 checkpoint mới", reward: 25, done: savedPlaceIds.length > 0 },
    { id: "ugc", icon: "📸", title: "Kể chuyện", description: "Đăng 1 bài UGC", reward: 50, done: userPostCount > 0 },
    { id: "follow", icon: "🤝", title: "Kết nối", description: "Theo dõi 1 Traveller", reward: 25, done: followingUserIds.length > 0 },
  ];

  const claimDailyMission = (missionId: string, reward: number, done: boolean) => {
    if (!done || dailyMissionClaims[missionId] === dailyMissionKey) return;
    setDailyMissionClaims((current) => ({ ...current, [missionId]: dailyMissionKey }));
    setMissionBonusXP((current) => current + reward);
    setMessage(`🎁 +${reward} XP từ nhiệm vụ hôm nay!`);
  };

  const missingAchievements = achievements.filter((achievement) => !achievement.unlocked);

  const advancedAchievements = [
    { id: "five-checkpoints", icon: "🧭", name: "Nhà thám hiểm", description: "Chinh phục 5 checkpoint.", unlocked: checkins.length >= 5 },
    { id: "seven-streak", icon: "🔥", name: "Bền bỉ", description: "Streak 7 ngày.", unlocked: bestStreak >= 7 },
    { id: "three-saved", icon: "🔖", name: "Người lập kế hoạch", description: "Lưu 3 checkpoint.", unlocked: savedPlaceIds.length >= 3 },
    { id: "ten-posts", icon: "📚", name: "Nhật ký hành trình", description: "Đăng 10 bài UGC.", unlocked: userPostCount >= 10 },
    { id: "five-following", icon: "🧑‍🤝‍🧑", name: "Kết nối cộng đồng", description: "Theo dõi 5 Traveller.", unlocked: followingUserIds.length >= 5 },
  ];

  const openRoutePlanner = () => setRoutePlannerOpen(true);

  const shareJourney = async () => {
    const ids = journeyCheckpointIds.join(",");
    const url = `${window.location.origin}${window.location.pathname}?journey=${encodeURIComponent(journeyName)}&checkpoints=${ids}`;
    try {
      await navigator.clipboard.writeText(url);
      setRouteShareMessage("🔗 Đã sao chép link chia sẻ hành trình.");
    } catch {
      setRouteShareMessage(url);
    }
  };

  const buildRouteUrl = () => {
    const selected = checkpoints.filter((checkpoint) => journeyCheckpointIds.includes(checkpoint.id));
    if (selected.length < 2) return "";
    const origin = selected[0];
    const destination = selected[selected.length - 1];
    const waypoints = selected.slice(1, -1).map((checkpoint) => `${checkpoint.latitude},${checkpoint.longitude}`).join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}`;
  };

  const startNewJourney = () => {
    const record: JourneyRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : `journey-${Date.now()}`,
      name: journeyName.trim() || `Hành trình ${journeys.length + 1}`,
      checkpointIds: journeyCheckpointIds,
      started: journeyStarted,
      startDate: journeyStartDate,
      endDate: journeyEndDate,
    };
    setJourneys((current) => [record, ...current]);
    setMessage(`🧭 Đã lưu ${record.name}.`);
  };

  const savePost = (postId: number) => {
    setSavedPostIds((current) => current.includes(postId) ? current.filter((id) => id !== postId) : [...current, postId]);
  };

  const startEditPost = (post: Post) => {
    setEditPostId(post.id);
    setEditPostContent(post.content);
  };

  const saveEditedPost = async () => {
    if (!editPostId || !user?.id) return;
    const content = editPostContent.trim();
    if (content.length < 3 || content.length > 1000) {
      setPostMessage("Bài viết cần từ 3 đến 1000 ký tự.");
      return;
    }
    const { error } = await supabase.from("posts").update({ content }).eq("id", editPostId).eq("user_id", user.id);
    if (error) {
      setPostMessage("❌ Không thể sửa bài viết.");
      return;
    }
    setPosts((current) => current.map((post) => post.id === editPostId ? { ...post, content } : post));
    setEditPostId(null);
    setEditPostContent("");
    setPostMessage("✅ Đã cập nhật bài viết.");
  };

  const deletePost = async (postId: number) => {
    if (!user?.id || !window.confirm("Xóa bài viết này?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id);
    if (error) {
      setPostMessage("❌ Không thể xóa bài viết.");
      return;
    }
    setPosts((current) => current.filter((post) => post.id !== postId));
    setSavedPostIds((current) => current.filter((id) => id !== postId));
    setPostMessage("🗑️ Đã xóa bài viết.");
  };

  const askTravelAssistant = () => {
    const question = assistantInput.trim().toLowerCase();
    if (!question) return;
    const nearest = checkpoints
      .map((checkpoint) => ({ checkpoint, distance: userLocation ? getValidGpsDistance(userLocation, checkpoint) : null }))
      .filter((item) => item.distance !== null)
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))[0];
    if (question.includes("thời tiết") || question.includes("weather")) {
      setAssistantReply(weather ? `${weatherDescription(weather.current.weatherCode).icon} ${weatherDescription(weather.current.weatherCode).label}, ${weather.current.temperature}°C tại checkpoint đang chọn.` : "Hãy mở một checkpoint để tớ tải thời tiết trước nhé.");
    } else if (question.includes("tiếp theo") || question.includes("gần")) {
      setAssistantReply(nearest ? `📍 Tớ gợi ý ${nearest.checkpoint.name}, cách vị trí hiện tại khoảng ${Math.round(nearest.distance ?? 0)}m.` : "Bật GPS để tớ tìm checkpoint gần bạn.");
    } else if (question.includes("huy hiệu")) {
      setAssistantReply(missingAchievements.length ? `🏆 Bạn còn ${missingAchievements.length} huy hiệu cơ bản chưa mở. Gần nhất: ${missingAchievements[0].name}.` : "👑 Bạn đã mở hết huy hiệu cơ bản!");
    } else {
      setAssistantReply(`🧭 Bạn đã chinh phục ${checkins.length}/${checkpoints.length} checkpoint, streak hiện tại ${currentStreak} ngày và level Traveller ${currentLevel}.`);
    }
  };

  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    const message: ChatMessage = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text, sender: profileName, createdAt: new Date().toISOString() };
    setChatMessages((current) => [...current, message].slice(-100));
    void supabase.channel("travelquest-traveller-chat").send({ type: "broadcast", event: "message", payload: message });
    setChatInput("");
  };

  // ============================================
  // UI
  // ============================================

  return (
    <main className={`min-h-screen overflow-x-hidden bg-[#06111f] text-white ${activeTab === "map" ? "pb-0 overflow-y-hidden" : "pb-20"}`}>

      {/* ============================================
          AUTH MODAL
      ============================================ */}

      {authOpen && !user && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-5">

          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => {
              if (!authLoading) {
                setAuthOpen(false);
                setAuthMessage("");
              }
            }}
          />

          <div className="relative w-full max-w-sm">

            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#07182a] p-6 shadow-2xl">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-blue-300 text-xs font-bold tracking-[0.2em]">
                    TRAVELQUEST
                  </p>

                  <h2 className="text-2xl font-black mt-2">
                    {authMode === "login"
                      ? "Đăng nhập"
                      : "Tạo tài khoản"}
                  </h2>

                  <p className="text-sm text-white/45 mt-1">
                    {authMode === "login"
                      ? "Tiếp tục hành trình của bạn."
                      : "Tham gia cộng đồng TravelQuest."}
                  </p>

                </div>

                <button
                  onClick={() => {
                    if (!authLoading) {
                      setAuthOpen(false);
                      setAuthMessage("");
                    }
                  }}
                  className="w-9 h-9 rounded-full bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition"
                >
                  ✕
                </button>

              </div>

              <div className="mt-6">

                <label className="block text-xs text-white/50 mb-2">
                  Email
                </label>

                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) =>
                    setAuthEmail(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      handleAuth();
                    }
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full rounded-xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-400/50 transition"
                />

              </div>

              <div className="mt-4">

                <label className="block text-xs text-white/50 mb-2">
                  Mật khẩu
                </label>

                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) =>
                    setAuthPassword(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      handleAuth();
                    }
                  }}
                  placeholder="Ít nhất 6 ký tự"
                  autoComplete={
                    authMode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  className="w-full rounded-xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-400/50 transition"
                />

              </div>

              {authMessage && (
                <div className="mt-4 rounded-xl bg-blue-500/10 border border-blue-400/10 px-4 py-3">

                  <p className="text-sm text-blue-300 leading-relaxed">
                    {authMessage}
                  </p>

                </div>
              )}

              <button
                onClick={
                  handleAuth
                }
                disabled={
                  authLoading
                }
                className="w-full mt-5 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-50 font-bold transition"
              >
                {authLoading
                  ? "📡 Đang xử lý..."
                  : authMode ===
                    "login"
                  ? "Đăng nhập 🔑"
                  : "Tạo tài khoản ✨"}
              </button>

              <button
                onClick={() => {
                  setAuthMode(
                    authMode ===
                      "login"
                      ? "signup"
                      : "login"
                  );

                  setAuthMessage("");
                  setAuthPassword("");
                }}
                disabled={
                  authLoading
                }
                className="w-full mt-3 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold transition"
              >
                {authMode ===
                "login"
                  ? "Chưa có tài khoản? Đăng ký"
                  : "Đã có tài khoản? Đăng nhập"}
              </button>

            </div>

          </div>

        </div>
      )}

      {/* BADGE UNLOCK POPUP */}

      {unlockedBadge && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-5">

          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() =>
              setUnlockedBadge(null)
            }
          />

          <div className="relative w-full max-w-sm">

            <div className="relative overflow-hidden rounded-[2rem] border border-blue-300/30 bg-[#07182a] p-7 text-center shadow-2xl">

              <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-blue-500/30 blur-3xl" />

              <div className="absolute top-5 left-8 text-xl animate-bounce">
                ✨
              </div>

              <div className="absolute top-10 right-10 text-lg animate-pulse">
                ⭐
              </div>

              <div className="absolute bottom-16 left-8 text-lg animate-pulse">
                ✨
              </div>

              <div className="absolute bottom-10 right-8 text-xl animate-bounce">
                🎉
              </div>

              <p className="relative text-blue-300 text-xs font-bold tracking-[0.25em]">
                ACHIEVEMENT UNLOCKED
              </p>

              <div className="relative mt-5 mx-auto w-28 h-28 rounded-full bg-white/10 border border-white/15 flex items-center justify-center shadow-xl">

                <span className="text-6xl animate-bounce">
                  {unlockedBadge.icon ??
                    "🏆"}
                </span>

              </div>

              <h2 className="relative text-2xl font-black mt-6">
                Huy hiệu đã mở khóa!
              </h2>

              <p className="relative text-white/50 text-sm mt-2">
                {unlockedBadge.name}
              </p>

              <p className="relative text-blue-300 font-bold text-sm mt-3">
                {unlockedBadge.badge ??
                  "🏆 Huy hiệu TravelQuest"}
              </p>

              <button
                onClick={() =>
                  setUnlockedBadge(
                    null
                  )
                }
                className="relative w-full mt-7 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 font-bold transition"
              >
                Tuyệt! 🎉
              </button>

            </div>

          </div>

        </div>
      )}

      {/* MAP TOOLBAR */}
      {activeTab === "map" && (
      <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none px-2 pt-2 sm:px-3">
        <div className="pointer-events-auto mx-auto max-w-[1600px]">
          <div className={`flex items-center gap-2 rounded-2xl border border-white/10 bg-[#07182a]/55 px-2 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:px-3 ${mapSearchActive ? "w-full" : ""}`}>
            <div className="relative min-w-0 flex-1">
              <div className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white px-2.5 text-slate-900 shadow-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base">⌕</span>
                <input
                  value={mapSearchQuery}
                  onChange={(event) => setMapSearchQuery(event.target.value)}
                  onFocus={() => setMapSearchActive(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setMapSearchActive(false);
                  }}
                  placeholder="Tìm địa điểm, checkpoint..."
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
                  aria-label="Tìm địa điểm trên bản đồ"
                />
                {mapSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMapSearchQuery("")}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                    aria-label="Xóa tìm kiếm"
                  >
                    ×
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    updateLocation();
                    startWatchingGPS();
                  }}
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 text-xs font-bold text-white transition hover:bg-slate-700"
                  title="Định vị tôi"
                >
                  <span>⌖</span>
                  <span className="hidden sm:inline">Vị trí</span>
                </button>
              </div>

              {(mapSearchQuery.trim() || mapFilter !== "none") && (
                <div className="fixed right-3 top-[104px] z-[90] w-[min(320px,calc(100vw-24px))] max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-[0_18px_50px_rgba(0,0,0,0.25)] sm:top-[68px] sm:right-4">
                  {mapSearchResults.length === 0 ? (
                    <div className="px-4 py-5 text-center text-xs text-slate-500">
                      Chưa tìm thấy checkpoint phù hợp.
                    </div>
                  ) : (
                    mapSearchResults.map((checkpoint) => (
                      <button
                        key={checkpoint.id}
                        type="button"
                        onClick={() => {
                          selectCheckpoint(checkpoint);
                          setShowExplorePanel(false);
                          setMapSearchQuery("");
                          setMapFilter("none");
                        }}
                        className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-100"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                          {checkpoint.icon ?? "📍"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-800">{checkpoint.name}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                            {isCheckedIn(checkpoint.id) ? "✓ Đã chinh phục" : "Chưa chinh phục"}
                          </span>
                        </span>
                        <span className="text-slate-400 transition group-hover:translate-x-0.5">›</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className={`shrink-0 items-center gap-1.5 ${mapSearchActive ? "hidden" : "hidden lg:flex"}`}>
              {[
                ["all", "✨ Tất cả"],
                ["nearby", "📍 Gần tôi"],
                ["unvisited", "🎯 Chưa check-in"],
                ["saved", "🔖 Đã lưu"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMapFilter((current) => current === value ? "none" : value as "all" | "nearby" | "unvisited" | "saved")}
                  className={`tq-map-chip ${mapFilter === value ? "tq-map-chip-active" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={`shrink-0 items-center gap-1.5 ${mapSearchActive ? "hidden" : "flex"}`}>
              {authReady && user && (
                <button
                  type="button"
                  onClick={openSearch}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/8 text-base transition hover:bg-white/14"
                  title="Tìm Traveller"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="9" cy="8" r="3.2" />
                    <path d="M3.8 19.2c.7-3 2.6-4.7 5.2-4.7s4.5 1.7 5.2 4.7" />
                    <circle cx="17.2" cy="16.8" r="3.1" />
                    <path d="m19.5 19.1 2 2" />
                  </svg>
                </button>
              )}

              {authReady && user && (
                <button
                  type="button"
                  onClick={toggleNotifications}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/8 text-base transition hover:bg-white/14"
                  title="Thông báo"
                >
                  🔔
                  {notifications.some((item) => !item.is_read) && (
                    <span className="absolute right-1 top-1 h-2.5 min-w-2.5 rounded-full border-2 border-[#070b11] bg-red-400" />
                  )}
                </button>
              )}

              {authReady && (
                <button
                  onClick={() => {
                    if (user) {
                      setAuthMessage("");
                      setAuthOpen(true);
                    } else {
                      openAuth("login");
                    }
                  }}
                  className="flex h-10 items-center gap-2 rounded-xl bg-white/8 px-2.5 transition hover:bg-white/14"
                  title={user ? "Tài khoản" : "Đăng nhập"}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
                    {user && avatarImageUrl ? (
                      <img src={avatarImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm">{user ? avatarEmoji : "🔐"}</span>
                    )}
                  </span>
                  <span className="hidden xl:block max-w-[110px] truncate text-xs font-semibold">
                    {user ? profileName : "Đăng nhập"}
                  </span>
                </button>
              )}

              <div className="relative">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/8 text-lg transition hover:bg-white/14"
                  onClick={() => setHeaderMenuOpen((value) => !value)}
                  title="Công cụ"
                  aria-label="Công cụ"
                >
                  ⋯
                </button>

                {headerMenuOpen && (
                  <div className="absolute right-0 top-12 z-[90] w-48 rounded-2xl border border-white/10 bg-[#07182a]/98 p-2 shadow-2xl backdrop-blur-xl">
                    <button type="button" onClick={() => { setHeaderMenuOpen(false); updateLocation(); startWatchingGPS(); }} className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold text-white/75 transition hover:bg-white/8">📍 Cập nhật GPS</button>
                    <button type="button" onClick={() => { setHeaderMenuOpen(false); setSmartTravelOpen(true); }} className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold text-white/75 transition hover:bg-white/8">✨ Smart Travel</button>
                    <button type="button" onClick={() => { setHeaderMenuOpen(false); setChatOpen(true); }} className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold text-white/75 transition hover:bg-white/8">💬 Traveller Chat</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden [scrollbar-width:none]">
            {[
              ["all", "✨ Tất cả"],
              ["nearby", "📍 Gần tôi"],
              ["unvisited", "🎯 Chưa check-in"],
              ["saved", "🔖 Đã lưu"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMapFilter((current) => current === value ? "none" : value as "all" | "nearby" | "unvisited" | "saved")}
                className={`tq-map-chip shrink-0 ${mapFilter === value ? "tq-map-chip-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>
      )}
     <div className={activeTab === "map" ? "pb-0" : "pb-24"}>

        {/* ================= MAP ================= */}

        {activeTab === "map" && (
          <section className="relative h-[100dvh] min-h-0 overflow-hidden">

            <div className="absolute inset-0">
              <Map
                userLocation={
                  userLocation
                }
                checkpoints={
                  checkpoints
                }
                avatarUrl={
                  avatarImageUrl
                }
                avatarEmoji={
                  avatarEmoji
                }
                friendLocations={
                  friendLocations
                }
                showCheckpoints={
                  showMapCheckpoints
                }
                onFriendMarkerClick={
                  openPublicProfile
                }
              />
            </div>

            {/* MAP CONTROL PANEL / KHÁM PHÁ */}
            {showExplorePanel ? (
              <div className="fixed left-1/2 top-1/2 z-[80] w-[min(380px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="pointer-events-auto max-h-[min(60vh,540px)] overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-[#07182a]/96 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,.45)] [scrollbar-width:thin]">

                {/* SUMMARY */}
                <div className="sticky top-0 z-10 border-b border-white/10 bg-[#07182a]/95 px-4 py-3 backdrop-blur-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
                        Khám phá Hà Nội
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-sm font-black">Checkpoints</p>
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/45">
                          {checkins.length}/{checkpoints.length} đã chinh phục
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-black text-blue-300">{progress}%</p>
                      <p className="text-[9px] text-white/35">tiến độ</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowExplorePanel(false)}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold text-white/60 transition hover:bg-white/10 hover:text-white"
                  >
                    Ẩn phần khám phá ↑
                  </button>
                </div>

                {/* CHECKPOINTS — SHOW FEW BY DEFAULT */}
                <div className="p-2.5">
                  <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
                    <p className="text-xs font-bold text-white/70">📍 Điểm khám phá</p>
                    <div className="flex items-center gap-2">
                      {checkpoints.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowAllMapCheckpoints((value) => !value)}
                        className="text-[10px] font-bold text-blue-300 hover:text-blue-200"
                      >
                        {showAllMapCheckpoints ? "Thu gọn" : `Xem tất cả (${checkpoints.length})`}
                      </button>
                      )}
                    </div>
                  </div>

                  {loading ? (
                    <div className="rounded-2xl border border-white/5 bg-white/5 py-5 text-center text-xs text-white/40">
                      Đang tải checkpoint...
                    </div>
                  ) : checkpoints.length === 0 ? (
                    <div className="rounded-2xl border border-white/5 bg-white/5 py-5 text-center text-xs text-white/40">
                      Chưa có checkpoint.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {(showAllMapCheckpoints ? checkpoints : checkpoints.slice(0, 3)).map((checkpoint) => {
                        const checked = isCheckedIn(checkpoint.id);
                        const selected = selectedCheckpoint?.id === checkpoint.id;
                        return (
                          <button
                            key={checkpoint.id}
                            type="button"
                            onClick={() => selectCheckpoint(checkpoint)}
                            className={`flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition ${
                              selected
                                ? "border-blue-400/50 bg-blue-500/15"
                                : "border-white/5 bg-white/[0.035] hover:bg-white/[0.07]"
                            }`}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">
                              {checkpoint.icon ?? "📍"}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-bold">{checkpoint.name}</span>
                              <span className="mt-0.5 block truncate text-[10px] text-white/35">
                                {checked ? "✓ Đã chinh phục" : "Chưa chinh phục"}
                              </span>
                            </span>
                            <span className={`shrink-0 text-[10px] ${checked ? "text-emerald-300" : "text-white/25"}`}>
                              {checked ? "✓" : "›"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* SAVED PLACES */}
                <div className="border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowSavedPlaces((value) => !value)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="text-lg">🔖</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold">Địa điểm đã lưu</p>
                        <p className="text-[10px] text-white/35">{savedCheckpoints.length} điểm</p>
                      </div>
                    </div>
                    <span className="text-xs text-white/35">{showSavedPlaces ? "▲" : "▼"}</span>
                  </button>

                  {showSavedPlaces && (
                    <div className="border-t border-white/5 px-3 pb-3 pt-2">
                      {savedCheckpoints.length === 0 ? (
                        <p className="py-3 text-center text-[11px] text-white/35">Chưa lưu địa điểm nào.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {savedCheckpoints.slice(0, 5).map((checkpoint) => (
                            <div key={checkpoint.id} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.035] p-2">
                              <button
                                type="button"
                                onClick={() => { selectCheckpoint(checkpoint); setShowSavedPlaces(false); }}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              >
                                <span className="text-base">{checkpoint.icon ?? "📍"}</span>
                                <span className="min-w-0">
                                  <span className="block truncate text-[11px] font-semibold">{checkpoint.name}</span>
                                  <span className="block text-[9px] text-white/30">{isCheckedIn(checkpoint.id) ? "✓ Đã chinh phục" : "Chưa chinh phục"}</span>
                                </span>
                              </button>
                              <button type="button" onClick={() => toggleSavedPlace(checkpoint.id)} className="h-7 w-7 shrink-0 rounded-lg bg-white/5 text-xs hover:bg-white/10" title="Bỏ lưu">🔖</button>
                            </div>
                          ))}
                          {savedCheckpoints.length > 5 && <p className="pt-1 text-center text-[9px] text-white/25">+{savedCheckpoints.length - 5} điểm khác</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* JOURNEY */}
                <div className="border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setJourneyOpen(true)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="text-lg">🧭</span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">{journeyName}</p>
                        <p className="text-[10px] text-white/35">
                          {journeyCheckpoints.length === 0 ? "Chưa có checkpoint" : `${journeyCompletedCount}/${journeyCheckpoints.length} checkpoint · ${journeyProgress}%`}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 text-[9px] font-bold ${journeyStarted ? "text-emerald-300" : "text-white/30"}`}>
                      {journeyStarted ? "● ĐANG ĐI" : "MỞ"}
                    </span>
                  </button>
                </div>

                {/* DAILY MISSIONS — COMPACT */}
                <div className="border-t border-white/10">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-[9px] font-bold tracking-[0.12em] text-purple-300">DAILY MISSIONS</p>
                      <p className="text-xs font-black">Nhiệm vụ hôm nay</p>
                    </div>
                    <button type="button" onClick={() => setShowAllDailyMissions((value) => !value)} className="text-[10px] font-bold text-blue-300">
                      {showAllDailyMissions ? "Thu gọn" : "Chi tiết"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                    {(showAllDailyMissions ? dailyMissions : dailyMissions.slice(0, 2)).map((mission) => {
                      const claimed = dailyMissionClaims[mission.id] === dailyMissionKey;
                      return (
                        <button
                          key={mission.id}
                          type="button"
                          onClick={() => claimDailyMission(mission.id, mission.reward, mission.done)}
                          className={`rounded-xl border p-2.5 text-left transition ${claimed ? "border-emerald-400/20 bg-emerald-500/10" : "border-white/5 bg-white/[0.035] hover:bg-white/[0.07]"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm">{mission.icon}</span>
                            <span className="text-[9px] text-yellow-300">+{mission.reward} XP</span>
                          </div>
                          <p className="mt-1 truncate text-[10px] font-bold">{mission.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-[9px] text-white/35">{mission.description}</p>
                          {claimed && <p className="mt-1 text-[9px] font-bold text-emerald-300">✓ Đã nhận</p>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                </div>
              </div>
            ) : (
              <div className="fixed bottom-[92px] left-3 sm:bottom-24 sm:left-4 z-40 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowMapCheckpoints((value) => !value)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#07182a]/95 text-base text-white shadow-[0_10px_30px_rgba(0,0,0,.3)] backdrop-blur-xl transition hover:bg-[#0b223b]"
                  title={showMapCheckpoints ? "Ẩn checkpoint" : "Hiện checkpoint"}
                  aria-label={showMapCheckpoints ? "Ẩn checkpoint" : "Hiện checkpoint"}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-base ${showMapCheckpoints ? "bg-blue-500/15" : "bg-white/10"}`}>📍</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowExplorePanel(true)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#07182a]/95 text-base text-white shadow-[0_10px_30px_rgba(0,0,0,.3)] backdrop-blur-xl transition hover:bg-[#0b223b]"
                  title="Hiện khám phá"
                  aria-label="Hiện khám phá"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-base">🧭</span>
                </button>
              </div>
            )}

            {/* SELECTED CHECKPOINT */}

            {selectedCheckpoint && !showCheckpointCard && (
              <div className="absolute inset-0 z-40 pointer-events-none flex items-end justify-end px-3 pb-[calc(92px+env(safe-area-inset-bottom))] sm:px-4 sm:pb-5">
                <div
                  className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-[#07182a]/85 px-2 py-2 shadow-[0_12px_35px_rgba(0,0,0,.3)] backdrop-blur-xl touch-pan-y select-none"
                  onPointerDown={(event) => {
                    checkpointRevealSwipeRef.current = {
                      startX: event.clientX,
                      startY: event.clientY,
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerUp={(event) => {
                    const start = checkpointRevealSwipeRef.current;
                    checkpointRevealSwipeRef.current = null;
                    if (!start) return;
                    const dx = event.clientX - start.startX;
                    const dy = event.clientY - start.startY;
                    if (dx > 55 && Math.abs(dx) > Math.abs(dy)) {
                      setShowCheckpointCard(true);
                    }
                    try {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    } catch {
                      // Ignore pointer capture cleanup errors.
                    }
                  }}
                  aria-label="Vuốt sang phải để hiện checkpoint"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/65 text-lg">→</span>
                  <span className="pr-2 text-[10px] font-bold text-white/50">Vuốt sang</span>
                </div>
              </div>
            )}

            {selectedCheckpoint && showCheckpointCard && (
              <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center px-3 sm:px-4">
                <div
                  className="pointer-events-auto mx-auto w-full max-w-lg cursor-grab overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#07182a]/80 shadow-[0_20px_60px_rgba(0,0,0,.35)] backdrop-blur-2xl touch-none select-none active:cursor-grabbing"
                  style={{ transform: `translate3d(${checkpointCardOffset.x}px, ${checkpointCardOffset.y}px, 0)` }}
                  onPointerDown={handleCheckpointCardPointerDown}
                  onPointerMove={handleCheckpointCardPointerMove}
                  onPointerUp={handleCheckpointCardPointerUp}
                  onPointerCancel={handleCheckpointCardPointerUp}
                >

                  <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                    <div className="h-11 w-11 shrink-0 rounded-2xl bg-blue-500/15 border border-blue-400/15 flex items-center justify-center text-2xl">
                      {selectedCheckpoint.icon ?? "📍"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-base font-black">{selectedCheckpoint.name}</h2>
                        {isCheckedIn(selectedCheckpoint.id) && (
                          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                            ✓ ĐÃ ĐI
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-white/40">
                        {distance !== null
                          ? canCheckIn
                            ? `Bạn đang ở đây · ${distance}m`
                            : `${distance}m từ vị trí hiện tại`
                          : "Kiểm tra GPS để biết khoảng cách"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setShowCheckpointCard(false)}
                      className="h-8 rounded-full bg-white/5 px-3 text-[10px] font-bold text-white/55 transition hover:bg-white/10 hover:text-white"
                      aria-label="Ẩn checkpoint"
                    >
                      —
                    </button>

                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => {
                        setSelectedCheckpoint(null);
                        selectedCheckpointRef.current = null;
                        setDistance(null);
                        setMessage("");
                      }}
                      className="h-8 w-8 shrink-0 rounded-full bg-white/5 text-sm text-white/45 transition hover:bg-white/10 hover:text-white"
                      aria-label="Đóng checkpoint"
                    >
                      ✕
                    </button>
                  </div>

                  {message && (
                    <div className="mx-4 mb-2 rounded-xl bg-white/5 px-3 py-2 text-[10px] leading-relaxed text-white/55">
                      {message}
                    </div>
                  )}

                  <div className="grid grid-cols-[1fr_auto] gap-2 px-4 pb-4">
                    <button
                      type="button"
                      onClick={handleCheckIn}
                      disabled={checkingIn || isCheckedIn(selectedCheckpoint.id)}
                      className={`min-h-12 rounded-2xl px-4 text-sm font-black transition ${
                        isCheckedIn(selectedCheckpoint.id)
                          ? "border border-emerald-400/20 bg-emerald-500/15 text-emerald-300"
                          : canCheckIn
                          ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400"
                          : "bg-white/10 text-white/80 hover:bg-white/15"
                      }`}
                    >
                      {checkingIn
                        ? "📡 Đang xác nhận..."
                        : isCheckedIn(selectedCheckpoint.id)
                        ? "✓ Đã check-in"
                        : canCheckIn
                        ? "📍 Check-in ngay"
                        : "📍 Kiểm tra để check-in"}
                    </button>

                    <button
                      type="button"
                      onClick={updateLocation}
                      disabled={locationLoading}
                      className="h-12 w-12 rounded-2xl border border-white/10 bg-white/5 text-lg text-white/70 transition hover:bg-white/10 disabled:opacity-50"
                      title="Kiểm tra GPS"
                      aria-label="Kiểm tra GPS"
                    >
                      {locationLoading ? "📡" : "◎"}
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-1 border-t border-white/5 px-4 py-2">
                    <button
                      type="button"
                      onClick={openCheckpointDetail}
                      className="rounded-lg px-3 py-1.5 text-[10px] font-semibold text-white/40 transition hover:bg-white/5 hover:text-white/70"
                    >
                      📖 Chi tiết
                    </button>
                    <span className="text-white/10">•</span>
                    <button
                      type="button"
                      onClick={() => toggleSavedPlace(selectedCheckpoint.id)}
                      className="rounded-lg px-3 py-1.5 text-[10px] font-semibold text-white/40 transition hover:bg-white/5 hover:text-white/70"
                    >
                      {savedCheckpoints.some((item) => item.id === selectedCheckpoint.id) ? "🔖 Đã lưu" : "🔖 Lưu điểm"}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </section>
        )}

        {/* ================= JOURNEY / TRIP MODAL ================= */}

        {journeyOpen && (
          <div
            className="fixed inset-0 z-[115] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5"
            onClick={() => setJourneyOpen(false)}
          >
            <div
              className="w-full sm:max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-y-auto bg-[#07182a] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-blue-300 font-semibold uppercase tracking-wider">
                      Journey / Trip
                    </p>
                    <h2 className="text-2xl font-black mt-1">🧭 Lập hành trình</h2>
                    <p className="text-xs text-white/40 mt-2">
                      Chọn các checkpoint muốn đi. Tiến độ cập nhật theo check-in GPS thật.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setJourneyOpen(false)}
                    className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-5">
                  <label className="block text-xs text-white/50 mb-2">Tên hành trình</label>
                  <input
                    type="text"
                    value={journeyName}
                    maxLength={50}
                    onChange={(event) => setJourneyName(event.target.value)}
                    className="w-full rounded-xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-blue-400/50 transition"
                    placeholder="Ví dụ: Hà Nội cuối tuần"
                  />
                </div>

                <div className="mt-5 rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">Tiến độ</p>
                      <p className="text-[11px] text-white/40 mt-1">
                        {journeyCompletedCount}/{journeyCheckpoints.length} checkpoint đã chinh phục
                      </p>
                    </div>
                    <span className="text-lg font-black text-blue-300">{journeyProgress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-3">
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${journeyProgress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold">Checkpoint trong hành trình</p>
                    <p className="text-[10px] text-white/35">{journeyCheckpointIds.length} đã chọn</p>
                  </div>

                  <div className="space-y-2">
                    {checkpoints.map((checkpoint) => {
                      const selected = journeyCheckpointIds.includes(checkpoint.id);
                      const checked = isCheckedIn(checkpoint.id);
                      return (
                        <button
                          key={checkpoint.id}
                          type="button"
                          onClick={() => toggleJourneyCheckpoint(checkpoint.id)}
                          className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                            selected
                              ? "bg-blue-500/15 border-blue-400/30"
                              : "bg-white/5 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          <span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0">
                            {checkpoint.icon ?? "📍"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold truncate">{checkpoint.name}</span>
                            <span className="block text-[10px] text-white/35 mt-1">
                              {checked ? "✓ Đã chinh phục" : "Chưa chinh phục"}
                            </span>
                          </span>
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center border text-xs ${selected ? "bg-blue-500 border-blue-400" : "bg-white/5 border-white/10"}`}>
                            {selected ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-6">
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={() => setRoutePlannerOpen(true)} className="flex-1 rounded-xl bg-emerald-500/10 border border-emerald-400/15 px-3 py-2 text-xs font-bold">🗺️ Route planner</button>
                    {buildRouteUrl() && <a href={buildRouteUrl()} target="_blank" rel="noreferrer" className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs font-bold text-center">📍 Google Maps</a>}
                  </div>

                  {journeys.length > 0 && (
                    <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-3">
                      <p className="text-[10px] text-white/40 font-bold">JOURNEY ĐÃ LƯU</p>
                      <div className="space-y-2 mt-2">
                        {journeys.slice(0, 5).map((savedJourney) => <button key={savedJourney.id} type="button" onClick={() => { setJourneyName(savedJourney.name); setJourneyCheckpointIds(savedJourney.checkpointIds); setJourneyStarted(savedJourney.started); setJourneyStartDate(savedJourney.startDate); setJourneyEndDate(savedJourney.endDate); }} className="w-full text-left rounded-xl bg-black/10 border border-white/5 p-3"><p className="text-xs font-bold">{savedJourney.name}</p><p className="text-[10px] text-white/35 mt-1">{savedJourney.checkpointIds.length} checkpoint · {savedJourney.startDate || "chưa đặt ngày"}</p></button>)}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={clearJourney}
                    className="py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold transition"
                  >
                    🗑️ Xóa hành trình
                  </button>
                  {journeyStarted ? (
                    <button
                      type="button"
                      onClick={finishJourney}
                      className="py-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/20 text-emerald-300 text-xs font-bold transition"
                    >
                      🏁 Kết thúc chuyến đi
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startJourney}
                      disabled={journeyCheckpointIds.length === 0 || !journeyName.trim()}
                      className="py-3 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-40 text-white text-xs font-bold transition"
                    >
                      🧭 Bắt đầu hành trình
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= CHECKPOINT DETAIL ================= */}

        {checkpointDetailOpen && selectedCheckpoint && (
          <div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5"
            onClick={() => setCheckpointDetailOpen(false)}
          >
            <div
              className="w-full sm:max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-y-auto bg-[#07182a] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-4xl shrink-0">
                    {selectedCheckpoint.icon ?? "📍"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-blue-300 font-semibold uppercase tracking-wider">
                          Checkpoint
                        </p>
                        <h2 className="text-2xl font-black mt-1">
                          {selectedCheckpoint.name}
                        </h2>
                      </div>

                      <button
                        onClick={() => setCheckpointDetailOpen(false)}
                        className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition"
                      >
                        ✕
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleSavedPlace(selectedCheckpoint.id)}
                        className="shrink-0 h-9 px-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold transition"
                      >
                        {isSavedPlace(selectedCheckpoint.id) ? "🔖 Đã lưu" : "☆ Lưu"}
                      </button>
                    </div>

                    <p className="text-sm text-white/55 mt-3 leading-relaxed">
                      {selectedCheckpoint.description ||
                        "Một điểm đến trong hành trình TravelQuest của bạn."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <p className="text-[11px] text-white/40">Trạng thái</p>
                    <p className="text-sm font-bold mt-1">
                      {isCheckedIn(selectedCheckpoint.id)
                        ? "✓ Đã chinh phục"
                        : "🔒 Chưa chinh phục"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <p className="text-[11px] text-white/40">Khoảng cách</p>
                    <p className="text-sm font-bold mt-1">
                      {distance !== null
                        ? `${distance}m`
                        : "Chưa xác định"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-[11px] text-white/40">Huy hiệu nhận được</p>
                  <p className="text-base font-bold mt-1">
                    {selectedCheckpoint.badge ||
                      `${selectedCheckpoint.icon ?? "🏆"} Huy hiệu ${selectedCheckpoint.name}`}
                  </p>
                </div>

                <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-[11px] text-white/40">Tọa độ</p>
                  <p className="text-sm text-white/70 mt-1 font-mono">
                    {selectedCheckpoint.latitude.toFixed(5)}, {selectedCheckpoint.longitude.toFixed(5)}
                  </p>
                </div>

                {/* ================= REVIEWS ================= */}

                <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-white/40">
                        ĐÁNH GIÁ CHECKPOINT
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-2xl font-black">
                          {reviewAverage > 0 ? reviewAverage.toFixed(1) : "—"}
                        </span>
                        <span className="text-yellow-300">
                          {"★".repeat(Math.round(reviewAverage || 0))}
                          <span className="text-white/20">
                            {"★".repeat(Math.max(0, 5 - Math.round(reviewAverage || 0)))}
                          </span>
                        </span>
                        <span className="text-xs text-white/40">
                          {checkpointReviews.length} đánh giá
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        selectedCheckpoint &&
                        void loadCheckpointReviews(selectedCheckpoint.id)
                      }
                      disabled={reviewLoading}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold disabled:opacity-50 transition"
                    >
                      {reviewLoading ? "Đang tải..." : "↻ Làm mới"}
                    </button>
                  </div>

                  <div className="mt-4 rounded-xl bg-black/10 border border-white/5 p-4">
                    <p className="text-xs text-white/50 font-semibold">
                      {user ? "Đánh giá của bạn" : "Đăng nhập để đánh giá"}
                    </p>

                    {user ? (
                      <>
                        <div className="flex items-center gap-2 mt-3">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewRating(star)}
                              aria-label={`${star} sao`}
                              className={`text-3xl transition ${
                                star <= reviewRating
                                  ? "text-yellow-300"
                                  : "text-white/15 hover:text-white/30"
                              }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>

                        <textarea
                          value={reviewText}
                          onChange={(event) =>
                            setReviewText(event.target.value.slice(0, 500))
                          }
                          placeholder="Chia sẻ trải nghiệm của bạn tại checkpoint..."
                          rows={3}
                          className="w-full mt-3 rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-sm outline-none focus:border-blue-400/50 resize-none"
                        />

                        <div className="flex items-center justify-between gap-3 mt-2">
                          <span className="text-[10px] text-white/30">
                            {reviewText.length}/500
                          </span>

                          <div className="flex items-center gap-2">
                            {ownCheckpointReview && (
                              <button
                                type="button"
                                onClick={() => void deleteCheckpointReview()}
                                disabled={reviewSubmitting}
                                className="px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-400/10 text-red-200 text-xs font-bold disabled:opacity-50 transition"
                              >
                                Xóa
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => void submitCheckpointReview()}
                              disabled={reviewSubmitting}
                              className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold disabled:opacity-50 transition"
                            >
                              {reviewSubmitting
                                ? "Đang lưu..."
                                : ownCheckpointReview
                                  ? "✏️ Cập nhật"
                                  : "⭐ Gửi đánh giá"}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-white/40 mt-2">
                        Hãy đăng nhập để chấm sao và viết đánh giá.
                      </p>
                    )}

                    {reviewMessage && (
                      <p className="text-xs text-white/60 mt-3">{reviewMessage}</p>
                    )}
                  </div>

                  {checkpointReviews.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {checkpointReviews.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl bg-black/10 border border-white/5 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">
                                {item.display_name}
                              </p>
                              <p className="text-yellow-300 text-sm mt-1">
                                {"★".repeat(item.rating)}
                                <span className="text-white/15">
                                  {"★".repeat(5 - item.rating)}
                                </span>
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-white/25 block">
                                {new Date(item.created_at).toLocaleDateString("vi-VN")}
                              </span>
                              {item.updated_at !== item.created_at && (
                                <span className="text-[9px] text-white/20 block mt-0.5">
                                  Đã cập nhật
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-white/60 mt-2 leading-relaxed">
                            {item.review}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {!reviewLoading &&
                    checkpointReviews.length === 0 &&
                    !reviewMessage && (
                      <p className="text-xs text-white/30 mt-4 text-center">
                        Chưa có đánh giá. Hãy là người đầu tiên!
                      </p>
                    )}
                </div>

                {/* ================= WEATHER ================= */}

                <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-white/40">THỜI TIẾT TẠI CHECKPOINT</p>
                      <p className="text-sm font-bold mt-1">🌤️ Dự báo địa điểm</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void loadCheckpointWeather(selectedCheckpoint)}
                      disabled={weatherLoading}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold disabled:opacity-50 transition"
                    >
                      {weatherLoading ? "Đang tải..." : "↻ Làm mới"}
                    </button>
                  </div>

                  {weatherLoading && (
                    <div className="mt-4 rounded-xl bg-black/10 p-4 text-sm text-white/50">
                      🌤️ Đang lấy dữ liệu thời tiết...
                    </div>
                  )}

                  {!weatherLoading && weather && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                        <div className="rounded-xl bg-black/10 p-3">
                          <p className="text-[10px] text-white/40">Nhiệt độ</p>
                          <p className="text-lg font-black mt-1">{Math.round(weather.current.temperature)}°C</p>
                        </div>
                        <div className="rounded-xl bg-black/10 p-3">
                          <p className="text-[10px] text-white/40">Cảm nhận</p>
                          <p className="text-lg font-black mt-1">{Math.round(weather.current.apparentTemperature)}°C</p>
                        </div>
                        <div className="rounded-xl bg-black/10 p-3">
                          <p className="text-[10px] text-white/40">Độ ẩm</p>
                          <p className="text-lg font-black mt-1">{weather.current.humidity}%</p>
                        </div>
                        <div className="rounded-xl bg-black/10 p-3">
                          <p className="text-[10px] text-white/40">Gió</p>
                          <p className="text-lg font-black mt-1">{Math.round(weather.current.windSpeed)} km/h</p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl bg-black/10 p-3 flex items-center gap-3">
                        <span className="text-3xl">{weatherDescription(weather.current.weatherCode).icon}</span>
                        <div>
                          <p className="font-bold">{weatherDescription(weather.current.weatherCode).label}</p>
                          <p className="text-xs text-white/40">Điều kiện hiện tại tại checkpoint</p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-5 gap-2">
                        {weather.daily.map((day) => {
                          const description = weatherDescription(day.weatherCode);
                          return (
                            <div key={day.date} className="rounded-xl bg-black/10 p-2 text-center">
                              <p className="text-[10px] text-white/40">{formatWeatherDate(day.date)}</p>
                              <div className="text-xl my-2">{description.icon}</div>
                              <p className="text-xs font-bold">{Math.round(day.temperatureMax)}°</p>
                              <p className="text-[10px] text-white/40">{Math.round(day.temperatureMin)}°</p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {!weatherLoading && !weather && weatherError && (
                    <div className="mt-4 rounded-xl bg-red-500/10 border border-red-400/10 p-3 text-xs text-red-200">
                      {weatherError}
                    </div>
                  )}
                </div>

                {/* ================= BOOKING ================= */}

                <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div>
                    <p className="text-[11px] text-white/40">DỊCH VỤ QUANH CHECKPOINT</p>
                    <p className="text-sm font-bold mt-1">🏨 Đặt dịch vụ & trải nghiệm</p>
                    <p className="text-xs text-white/40 mt-1">
                      Mở nền tảng bên ngoài để xem lựa chọn và thực hiện đặt dịch vụ. TravelQuest không xử lý thanh toán trong MVP.
                    </p>
                  </div>

                  <div className="grid gap-3 mt-4">
                    {bookingOptions.map((option) => (
                      <div
                        key={option.title}
                        className="rounded-xl bg-black/10 border border-white/5 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl shrink-0">
                            {option.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm">{option.title}</p>
                            <p className="text-xs text-white/40 mt-1">{option.description}</p>

                            <div className="flex flex-wrap gap-2 mt-3">
                              {option.links.map((link) => (
                                <a
                                  key={link.url}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold transition"
                                >
                                  {link.label}
                                  <span className="text-white/40">↗</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => {
                      setCheckpointDetailOpen(false);
                      updateLocation();
                    }}
                    disabled={locationLoading}
                    className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 font-semibold transition disabled:opacity-50"
                  >
                    {locationLoading ? "📡 Đang lấy vị trí..." : "📍 Kiểm tra GPS"}
                  </button>

                  <button
                    onClick={() => {
                      setCheckpointDetailOpen(false);
                      handleCheckIn();
                    }}
                    disabled={
                      checkingIn ||
                      isCheckedIn(selectedCheckpoint.id)
                    }
                    className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:bg-emerald-500/20 disabled:text-emerald-300 text-white font-bold transition"
                  >
                    {isCheckedIn(selectedCheckpoint.id)
                      ? "✓ Đã check-in"
                      : checkingIn
                      ? "📡 Đang xác nhận..."
                      : "📍 Check-in"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= BADGES ================= */}

        {activeTab === "badges" && (
          <section className="pt-28 px-5 max-w-5xl mx-auto">

            <div className="mb-8">

              <p className="text-blue-300 text-sm font-semibold">
                YOUR COLLECTION
              </p>

              <h2 className="text-3xl font-black mt-1">
                Bộ sưu tập huy hiệu
              </h2>

              <p className="text-white/50 mt-2">
                Hoàn thành checkpoint để mở khóa huy hiệu.
              </p>

            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-6">

              <div className="flex items-center justify-between mb-3">

                <span className="text-sm text-white/60">
                  Tiến độ hành trình
                </span>

                <span className="font-bold">
                  {checkins.length}/
                  {checkpoints.length}
                </span>

              </div>

              <div className="h-3 bg-white/10 rounded-full overflow-hidden">

                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                  }}
                />

              </div>

              <p className="text-xs text-white/40 mt-3">
                {progress === 100
                  ? "🎉 Bạn đã hoàn thành tất cả checkpoint!"
                  : `Còn ${
                      checkpoints.length -
                      checkins.length
                    } checkpoint nữa.`}
              </p>

            </div>

            {/* ================= XP & LEVEL ================= */}

            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-6">

              <div className="flex items-center justify-between mb-3">

                <div>
                  <p className="text-xs text-blue-300 font-semibold">
                    LEVEL {currentLevel}
                  </p>

                  <p className="text-xl font-black mt-1">
                    {totalXP} XP
                  </p>
                </div>

                <div className="text-3xl">
                  🧭
                </div>

              </div>

              <div className="h-3 bg-white/10 rounded-full overflow-hidden">

                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${levelProgress}%`,
                  }}
                />

              </div>

              <div className="flex items-center justify-between mt-2">

                <p className="text-xs text-white/40">
                  {currentLevelXP}/{XP_PER_LEVEL} XP
                </p>

                <p className="text-xs text-white/40">
                  Còn {nextLevelXP} XP → Level {currentLevel + 1}
                </p>

              </div>

              <p className="text-xs text-white/40 mt-3">
                🏆 Mỗi checkpoint đã chinh phục nhận +{XP_PER_CHECKPOINT} XP.
              </p>

            </div>

            {/* ================= STREAK ================= */}

            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-6">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-xs text-orange-300 font-semibold">
                    TRAVEL STREAK
                  </p>

                  <h3 className="text-xl font-black mt-1">
                    Chuỗi chinh phục
                  </h3>

                  <p className="text-xs text-white/40 mt-2">
                    Chinh phục checkpoint mỗi ngày để giữ lửa hành trình.
                  </p>

                </div>

                <div className="text-4xl">
                  🔥
                </div>

              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">

                <div className="bg-black/10 border border-white/5 rounded-2xl p-4">

                  <p className="text-xs text-white/40">
                    Chuỗi hiện tại
                  </p>

                  <p className="text-3xl font-black mt-1">
                    {currentStreak}
                  </p>

                  <p className="text-[10px] text-white/30 mt-1">
                    ngày liên tiếp
                  </p>

                </div>

                <div className="bg-black/10 border border-white/5 rounded-2xl p-4">

                  <p className="text-xs text-white/40">
                    Kỷ lục
                  </p>

                  <p className="text-3xl font-black mt-1">
                    {bestStreak}
                  </p>

                  <p className="text-[10px] text-white/30 mt-1">
                    ngày liên tiếp
                  </p>

                </div>

              </div>

              <div className="mt-4 rounded-2xl bg-blue-500/10 border border-blue-400/15 p-4">

                <p className="text-xs text-blue-200">
                  {currentStreak > 0
                    ? `🔥 Bạn đang giữ chuỗi ${currentStreak} ngày.`
                    : "🧭 Chinh phục một checkpoint hôm nay để bắt đầu chuỗi."}
                </p>

              </div>

            </div>

            {/* ================= LEADERBOARD ================= */}

            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-6">

              <div className="flex items-center justify-between mb-4">

                <div>

                  <p className="text-xs text-yellow-300 font-semibold">
                    TRAVELQUEST RANKING
                  </p>

                  <h3 className="text-xl font-black mt-1">
                    Bảng xếp hạng
                  </h3>

                  <p className="text-xs text-white/40 mt-2">
                    Xếp hạng theo XP từ checkpoint đã chinh phục.
                  </p>

                </div>

                <div className="text-3xl">
                  🏆
                </div>

              </div>

              {leaderboardLoading ? (
                <div className="py-8 text-center text-sm text-white/40">
                  📡 Đang tải bảng xếp hạng...
                </div>
              ) : leaderboardMessage ? (
                <div className="py-6 text-center text-sm text-white/40">
                  {leaderboardMessage}
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="py-8 text-center text-sm text-white/40">
                  Chưa có dữ liệu xếp hạng.
                </div>
              ) : (
                <div className="space-y-2">

                  {leaderboard.map(
                    (entry, index) => {

                      const isCurrentUser =
                        entry.user_id === user?.id;

                      const rank = index + 1;

                      const rankIcon =
                        rank === 1
                          ? "🥇"
                          : rank === 2
                          ? "🥈"
                          : rank === 3
                          ? "🥉"
                          : `#${rank}`;

                      return (
                        <div
                          key={entry.user_id}
                          className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                            isCurrentUser
                              ? "bg-blue-500/10 border-blue-400/20"
                              : "bg-black/10 border-white/5"
                          }`}
                        >

                          <div className="w-10 text-center text-sm font-black">
                            {rankIcon}
                          </div>

                          <div className="w-10 h-10 shrink-0 rounded-full bg-blue-500/15 border border-blue-400/15 flex items-center justify-center">
                            👤
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              openPublicProfile(
                                entry.user_id
                              )
                            }
                            className="min-w-0 flex-1 text-left"
                          >

                            <div className="flex items-center gap-2">

                              <p className="font-bold truncate">
                                {entry.display_name}
                              </p>

                              {isCurrentUser && (
                                <span className="shrink-0 text-[9px] font-bold text-blue-300 bg-blue-500/10 border border-blue-400/15 rounded-full px-2 py-1">
                                  BẠN
                                </span>
                              )}

                            </div>

                            <p className="text-[10px] text-white/35 mt-1">
                              {entry.checkpoint_count} checkpoint
                              {" · "}
                              Level {entry.level}
                            </p>

                          </button>

                          <div className="text-right shrink-0">

                            <p className="font-black text-sm">
                              {entry.xp} XP
                            </p>

                            <p className="text-[9px] text-white/30 mt-1">
                              Level {entry.level}
                            </p>

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>
              )}

              <button
                onClick={loadLeaderboard}
                disabled={leaderboardLoading}
                className="w-full mt-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold transition disabled:opacity-50"
              >
                {leaderboardLoading
                  ? "📡 Đang cập nhật..."
                  : "↻ Cập nhật bảng xếp hạng"}
              </button>

            </div>

            {/* ================= ACHIEVEMENTS ================= */}

            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-6">

              <div className="flex items-center justify-between mb-4">

                <div>
                  <p className="text-xs text-blue-300 font-semibold">
                    ACHIEVEMENTS
                  </p>

                  <h3 className="text-xl font-black mt-1">
                    Thành tựu hành trình
                  </h3>
                </div>

                <div className="text-right">
                  <p className="text-lg font-black">
                    {unlockedAchievementCount}/{achievements.length}
                  </p>

                  <p className="text-[10px] text-white/35">
                    đã mở khóa
                  </p>
                </div>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {achievements.map(
                  (achievement) => (
                    <div
                      key={
                        achievement.id
                      }
                      className={`flex items-center gap-3 rounded-2xl border p-4 transition ${
                        achievement.unlocked
                          ? "bg-blue-500/10 border-blue-400/20"
                          : "bg-black/10 border-white/5 opacity-45"
                      }`}
                    >

                      <div
                        className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-2xl ${
                          achievement.unlocked
                            ? "bg-blue-500/15"
                            : "bg-black/20 grayscale"
                        }`}
                      >
                        {achievement.unlocked
                          ? achievement.icon
                          : "🔒"}
                      </div>

                      <div className="min-w-0">

                        <p className="font-bold text-sm">
                          {achievement.name}
                        </p>

                        <p className="text-xs text-white/40 mt-1 leading-relaxed">
                          {achievement.description}
                        </p>

                        <p
                          className={`text-[10px] mt-2 font-semibold ${
                            achievement.unlocked
                              ? "text-blue-300"
                              : "text-white/25"
                          }`}
                        >
                          {achievement.unlocked
                            ? "✓ Đã mở khóa"
                            : "Chưa mở khóa"}
                        </p>

                      </div>

                    </div>
                  )
                )}

              </div>

            </div>

            {/* ================= REGIONAL BADGES ================= */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-purple-300 font-semibold">REGIONAL BADGES</p>
                  <h3 className="text-xl font-black mt-1">🏙️ Huy hiệu theo khu vực</h3>
                </div>
                <span className="text-xs text-white/35">{regionalBadges.filter((item) => item.unlocked).length}/{regionalBadges.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {regionalBadges.map((badge) => (
                  <div key={badge.id} className={`rounded-2xl border p-4 ${badge.unlocked ? "bg-purple-500/10 border-purple-400/20" : "bg-black/10 border-white/5 opacity-45"}`}>
                    <p className="text-2xl">{badge.unlocked ? badge.icon : "🔒"}</p>
                    <p className="text-sm font-bold mt-2">{badge.name}</p>
                    <p className="text-[10px] text-white/40 mt-1">{badge.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ================= ADVANCED ACHIEVEMENTS ================= */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-orange-300 font-semibold">ADVANCED ACHIEVEMENTS</p>
                  <h3 className="text-xl font-black mt-1">🚀 Thành tựu nâng cao</h3>
                </div>
                <span className="text-xs text-white/35">{advancedAchievements.filter((item) => item.unlocked).length}/{advancedAchievements.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {advancedAchievements.map((item) => (
                  <div key={item.id} className={`rounded-2xl border p-4 ${item.unlocked ? "bg-orange-500/10 border-orange-400/20" : "bg-black/10 border-white/5 opacity-45"}`}>
                    <p className="text-2xl">{item.unlocked ? item.icon : "🔒"}</p>
                    <p className="text-sm font-bold mt-2">{item.name}</p>
                    <p className="text-[10px] text-white/40 mt-1">{item.description}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-blue-500/10 border border-blue-400/15 p-3">
                <p className="text-xs text-blue-200">💡 Bạn còn thiếu: {missingAchievements.length ? missingAchievements.slice(0, 3).map((item) => item.name).join(", ") : "không còn huy hiệu cơ bản nào."}</p>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-10 text-white/50">
                Đang tải huy hiệu...
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                {checkpoints.map(
                  (checkpoint) => {
                    const unlocked =
                      isCheckedIn(
                        checkpoint.id
                      );

                    return (
                      <div
                        key={
                          checkpoint.id
                        }
                        className={`rounded-3xl border p-5 text-center transition ${
                          unlocked
                            ? "bg-white/10 border-white/15"
                            : "bg-white/[0.03] border-white/5 opacity-50"
                        }`}
                      >

                        <div
                          className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl ${
                            unlocked
                              ? "bg-white/10"
                              : "bg-black/20 grayscale"
                          }`}
                        >
                          {unlocked
                            ? checkpoint.icon ??
                              "🏆"
                            : "🔒"}
                        </div>

                        <h3 className="font-bold text-sm mt-4">
                          {checkpoint.badge ??
                            checkpoint.name}
                        </h3>

                        <p className="text-xs text-white/40 mt-1">
                          {unlocked
                            ? "Đã mở khóa"
                            : "Chưa mở khóa"}
                        </p>

                      </div>
                    );
                  }
                )}

              </div>
            )}

            <button
              onClick={
                resetProgress
              }
              className="mt-8 text-xs text-red-300/60 hover:text-red-300 transition"
            >
              Reset dữ liệu demo
            </button>

          </section>
        )}

        {/* ================= UGC / LOCKET STYLE ================= */}
        {activeTab === "ugc" && (
          <section className="min-h-screen bg-[#06111f] px-4 pb-28 pt-24">
            <div className="mx-auto max-w-xl">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-300">
                    Travel Moments
                  </p>
                  <h2 className="mt-1 text-2xl font-black">Khoảnh khắc</h2>
                  <p className="mt-1 text-xs text-white/40">
                    Một ảnh, một khoảnh khắc, một chuyến đi.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-white/45">
                  {visiblePosts.length} moments
                </span>
              </div>

              {/* Floating camera + compact composer */}
              <button
                type="button"
                onClick={() => void openCamera()}
                className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-blue-500 text-2xl shadow-2xl shadow-blue-950/50 transition hover:scale-105 hover:bg-blue-400 active:scale-95"
                aria-label="Chia sẻ moment"
              >
                📸
              </button>

              {cameraOpen && (
                <div className="fixed inset-0 z-[100] bg-black">
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full object-cover ${cameraFacing === "user" ? "-scale-x-100" : ""}`}
                  />

                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
                    <button
                      type="button"
                      onClick={closeCamera}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-xl backdrop-blur"
                      aria-label="Đóng camera"
                    >
                      ×
                    </button>
                    <span className="rounded-full bg-black/45 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur">
                      Travel Moment
                    </span>
                    <button
                      type="button"
                      onClick={() => void switchCamera()}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-lg backdrop-blur"
                      aria-label="Đổi camera"
                    >
                      🔄
                    </button>
                  </div>

                  {cameraError && (
                    <div className="absolute left-5 right-5 top-24 rounded-2xl bg-black/65 p-4 text-center text-xs text-white/80 backdrop-blur">
                      {cameraError}
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-5 p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
                    <button
                      type="button"
                      onClick={captureCameraPhoto}
                      className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 shadow-2xl active:scale-90"
                      aria-label="Chụp ảnh"
                    >
                      <span className="h-14 w-14 rounded-full bg-white" />
                    </button>
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="rounded-full bg-black/45 px-4 py-2 text-xs text-white/80 backdrop-blur"
                    >
                      🖼️ Chọn ảnh từ máy
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-5 rounded-[26px] border border-white/10 bg-white/[0.045] p-3">
                <button
                  type="button"
                  onClick={() => void openCamera()}
                  className="flex w-full items-center gap-3 rounded-2xl bg-black/20 p-3 text-left transition hover:bg-white/5 active:scale-[0.99]"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xl shadow-lg shadow-blue-950/40">
                    📸
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{profileName}</p>
                    <p className="mt-0.5 text-[11px] text-white/35">
                      Chụp một khoảnh khắc ngay bây giờ
                    </p>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white/60">
                    Camera
                  </span>
                </button>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSelectImage}
                  className="hidden"
                />
              </div>

              {cameraPreviewOpen && imagePreview && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm">
                  <div className="relative flex h-full w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#06111f] shadow-2xl">
                    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-xl backdrop-blur"
                        aria-label="Hủy ảnh"
                      >
                        ×
                      </button>
                      <span className="rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur">
                        Preview
                      </span>
                      <span className="h-10 w-10" />
                    </div>

                    <div className="min-h-0 flex-1 bg-black">
                      <img
                        src={imagePreview}
                        alt="Ảnh moment vừa chụp"
                        className="h-full w-full object-contain"
                      />
                    </div>

                    <div className="shrink-0 border-t border-white/10 bg-[#06111f] p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                      <textarea
                        value={postContent}
                        onChange={(event) => setPostContent(event.target.value)}
                        maxLength={1000}
                        placeholder="Thêm một dòng cho khoảnh khắc này..."
                        className="min-h-14 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-blue-400/40"
                      />

                      <select
                        value={selectedPostCheckpoint ?? ""}
                        onChange={(event) =>
                          setSelectedPostCheckpoint(
                            event.target.value ? Number(event.target.value) : null
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-[#07182a] px-3 py-2.5 text-xs text-white outline-none"
                      >
                        <option value="">📍 Không gắn checkpoint</option>
                        {checkpoints.map((checkpoint) => (
                          <option key={checkpoint.id} value={checkpoint.id}>
                            {checkpoint.icon ?? "📍"} {checkpoint.name}
                          </option>
                        ))}
                      </select>

                      {postMessage && (
                        <p className="px-1 pt-2 text-xs text-blue-300">{postMessage}</p>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleCreatePost()}
                        disabled={posting}
                        className="mt-3 flex w-full items-center justify-center rounded-2xl bg-blue-500 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 active:scale-[0.99] disabled:opacity-50"
                      >
                        {posting ? "Đang chia sẻ..." : "📸 Chia sẻ moment"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1">
                <button
                  type="button"
                  onClick={() => setFeedMode("all")}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${feedMode === "all" ? "bg-white/10 text-white" : "text-white/35 hover:text-white"}`}
                >
                  🌍 Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!user?.id) {
                      setAuthOpen(true);
                      setAuthMode("login");
                      setAuthMessage("🔐 Hãy đăng nhập để xem bài từ người bạn theo dõi.");
                      return;
                    }
                    setFeedMode("following");
                  }}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${feedMode === "following" ? "bg-white/10 text-white" : "text-white/35 hover:text-white"}`}
                >
                  👥 Đang theo dõi
                  {user?.id && (
                    <span className="ml-1 text-[9px] opacity-60">
                      {followingUserIds.length}
                    </span>
                  )}
                </button>
              </div>

              {postsLoading ? (
                <div className="py-12 text-center text-sm text-white/40">
                  Đang tải moments...
                </div>
              ) : visiblePosts.length === 0 ? (
                <div className="rounded-[28px] border border-white/10 bg-white/[0.04] px-6 py-12 text-center">
                  <div className="text-5xl">📸</div>
                  <h3 className="mt-4 font-bold">
                    {feedMode === "following"
                      ? "Chưa có moment từ người bạn theo dõi"
                      : "Chưa có moment nào"}
                  </h3>
                  <p className="mt-2 text-sm text-white/40">
                    Chia sẻ một khoảnh khắc nhỏ trong chuyến đi của cậu.
                  </p>
                </div>
              ) : (
                <div className="mx-auto flex max-w-xl snap-y snap-mandatory flex-col gap-5">
                  {visiblePosts.map((post) => (
                    <article
                      key={post.id}
                      className="snap-start overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/20"
                    >
                      <div className="flex items-center justify-between px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-lg">
                            🧭
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">
                              {post.user_id === user?.id ? profileName : "Traveller"}
                            </p>
                            <p className="text-[11px] text-white/35">
                              {formatPostTime(post.created_at)}
                            </p>
                          </div>
                        </div>
                        {post.user_id === user?.id && (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => startEditPost(post)} className="text-[11px] text-white/35 hover:text-white">Sửa</button>
                            <button type="button" onClick={() => void deletePost(post.id)} className="text-[11px] text-white/35 hover:text-red-300">Xóa</button>
                          </div>
                        )}
                      </div>

                      {post.image_url ? (
                        <div className="aspect-[4/5] overflow-hidden bg-black/20">
                          <img
                            src={post.image_url}
                            alt="Khoảnh khắc TravelQuest"
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-[4/5] items-center justify-center bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-7xl">
                          📸
                        </div>
                      )}

                      <div className="px-4 pb-5 pt-3">
                        <div className="flex items-center gap-5">
                          <button
                            type="button"
                            onClick={() => handleLike(post)}
                            disabled={likeLoading[post.id]}
                            className={`text-sm transition ${likedPostIds.includes(post.id) ? "text-red-300" : "text-white/60 hover:text-white"} disabled:opacity-40`}
                          >
                            {likedPostIds.includes(post.id) ? "♥" : "♡"} {post.likes}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById(`comment-${post.id}`);
                              input?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }}
                            className="text-sm text-white/60 hover:text-white"
                          >
                            ◯ {comments.filter((comment) => comment.post_id === post.id).length}
                          </button>
                          <button
                            type="button"
                            onClick={() => savePost(post.id)}
                            className={`ml-auto text-sm transition ${savedPostIds.includes(post.id) ? "text-yellow-300" : "text-white/40 hover:text-white"}`}
                          >
                            {savedPostIds.includes(post.id) ? "🔖" : "☆"}
                          </button>
                        </div>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                          {post.content}
                        </p>

                        {post.checkpoint && (
                          <button
                            type="button"
                            onClick={() => {
                              selectCheckpoint(post.checkpoint!);
                              setActiveTab("map");
                            }}
                            className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-blue-400/10 bg-blue-500/[0.06] p-3 text-left transition hover:bg-blue-500/10"
                          >
                            <span className="text-xl">{post.checkpoint.icon ?? "📍"}</span>
                            <span className="min-w-0">
                              <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-blue-300/80">Checkpoint</span>
                              <span className="mt-0.5 block truncate text-xs font-semibold">{post.checkpoint.name}</span>
                            </span>
                            <span className="ml-auto text-white/25">›</span>
                          </button>
                        )}

                        <div className="mt-4 border-t border-white/5 pt-4">
                          <div className="mb-2 text-[11px] font-bold text-white/45">
                            💬 Bình luận ({comments.filter((comment) => comment.post_id === post.id).length})
                          </div>
                          <div className="max-h-40 space-y-2 overflow-y-auto">
                            {comments.filter((comment) => comment.post_id === post.id).map((comment) => (
                              <div key={comment.id} className="rounded-xl bg-black/10 px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-[11px] font-bold">
                                    {comment.user_id === user?.id ? profileName : "Traveller"}
                                  </p>
                                  <p className="shrink-0 text-[9px] text-white/25">
                                    {formatPostTime(comment.created_at)}
                                  </p>
                                </div>
                                <p className="mt-1 break-words text-xs text-white/65">{comment.content}</p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <input
                              id={`comment-${post.id}`}
                              type="text"
                              value={commentInputs[post.id] ?? ""}
                              maxLength={300}
                              onChange={(event) =>
                                setCommentInputs((current) => ({
                                  ...current,
                                  [post.id]: event.target.value,
                                }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  handleCreateComment(post.id);
                                }
                              }}
                              placeholder={user ? "Viết bình luận..." : "Đăng nhập để bình luận"}
                              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-blue-400/40"
                            />
                            <button
                              type="button"
                              onClick={() => handleCreateComment(post.id)}
                              disabled={commentLoading[post.id] || !(commentInputs[post.id] ?? "").trim()}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold disabled:opacity-40"
                            >
                              {commentLoading[post.id] ? "..." : "Gửi"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

      </div>

      {/* ================= BOTTOM NAV ================= */}

      <nav className="fixed bottom-3 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 pb-[env(safe-area-inset-bottom)]">
        <div className="rounded-2xl border border-white/10 bg-[#07182a]/55 p-1.5 shadow-[0_10px_35px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="flex h-[60px] items-center justify-around px-1">
            <button
              type="button"
              onClick={() => setActiveTab("map")}
              className={`flex min-w-[76px] flex-col items-center gap-1 rounded-2xl px-6 py-2 transition ${activeTab === "map" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
            >
              <span className="text-xl">🗺️</span>
              <span className="text-[11px] font-semibold">Map</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("badges")}
              className={`flex min-w-[76px] flex-col items-center gap-1 rounded-2xl px-6 py-2 transition ${activeTab === "badges" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
            >
              <span className="text-xl">🏆</span>
              <span className="text-[11px] font-semibold">Huy hiệu</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ugc")}
              className={`flex min-w-[76px] flex-col items-center gap-1 rounded-2xl px-6 py-2 transition ${activeTab === "ugc" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
            >
              <span className="text-xl">📸</span>
              <span className="text-[11px] font-semibold">UGC</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ============================================
          REPORT / MODERATION PANEL
      ============================================ */}

      {reportOpen && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Đóng báo cáo"
            onClick={closeReport}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto overflow-x-hidden rounded-[1.75rem] border border-white/10 bg-[#07182a] shadow-2xl">
            <div className="flex items-start justify-between gap-4 px-5 py-5 border-b border-white/10">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-red-300">
                  REPORT / MODERATION
                </p>
                <h2 className="text-xl font-black mt-1">🚩 Báo cáo nội dung</h2>
                <p className="text-[11px] text-white/40 mt-1">
                  Báo cáo {reportTargetLabel || "nội dung"} để đội ngũ xem xét.
                </p>
              </div>

              <button
                type="button"
                onClick={closeReport}
                disabled={reportLoading}
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white disabled:opacity-50 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <label className="block text-xs text-white/50 mb-2">Lý do</label>

              <select
                value={reportReason}
                onChange={(event) =>
                  setReportReason(event.target.value as ReportReason)
                }
                className="w-full rounded-xl bg-[#0b2035] border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-blue-400/50 transition"
              >
                <option value="spam">Spam / quảng cáo không phù hợp</option>
                <option value="harassment">Quấy rối / bắt nạt</option>
                <option value="inappropriate">Nội dung không phù hợp</option>
                <option value="misleading">Thông tin có vẻ sai lệch</option>
                <option value="other">Lý do khác</option>
              </select>

              <label className="block text-xs text-white/50 mb-2 mt-5">Chi tiết (không bắt buộc)</label>
              <textarea
                value={reportDetails}
                maxLength={500}
                onChange={(event) => setReportDetails(event.target.value)}
                rows={4}
                placeholder="Mô tả ngắn vấn đề..."
                className="w-full resize-none rounded-xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-400/50 transition"
              />

              {reportMessage && (
                <p className="text-xs text-blue-300 mt-3 leading-relaxed">
                  {reportMessage}
                </p>
              )}

              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={closeReport}
                  disabled={reportLoading}
                  className="flex-1 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 px-4 py-3 text-sm font-bold transition"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReport}
                  disabled={reportLoading}
                  className="flex-1 rounded-xl bg-red-500/80 hover:bg-red-500 disabled:opacity-50 px-4 py-3 text-sm font-bold transition"
                >
                  {reportLoading ? "Đang gửi..." : "🚩 Gửi báo cáo"}
                </button>
              </div>

              <p className="text-[10px] text-white/25 mt-3 text-center">
                Chỉ báo cáo nội dung thực sự có vấn đề.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          SEARCH TRAVELLER PANEL
      ============================================ */}

      {searchOpen && (
        <div className="fixed inset-0 z-[225] flex items-start justify-center px-4 pt-20">

          <button
            type="button"
            aria-label="Đóng tìm kiếm"
            onClick={closeSearch}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-lg max-h-[calc(100dvh-1rem)] overflow-y-auto overflow-x-hidden rounded-[1.75rem] border border-white/10 bg-[#07182a] shadow-2xl">

            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <p className="font-black text-lg">🔎 Tìm Traveller</p>
                <p className="text-[10px] text-white/35 mt-1">
                  Tìm người và mở hồ sơ công khai
                </p>
              </div>

              <button
                type="button"
                onClick={closeSearch}
                className="w-9 h-9 rounded-full bg-white/5 text-white/50 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <div className="relative">
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(event) =>
                    searchTravellers(event.target.value)
                  }
                  placeholder="Nhập tên Traveller..."
                  maxLength={50}
                  className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3.5 pr-12 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-400/50 transition"
                />

                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => searchTravellers("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-white/35 hover:text-white transition"
                  >
                    ✕
                  </button>
                )}
              </div>

              <p className="text-[10px] text-white/30 mt-2 px-1">
                Nhập ít nhất 2 ký tự để tìm kiếm.
              </p>

              <div className="mt-4 max-h-[55vh] overflow-y-auto">

                {searchLoading ? (
                  <div className="py-10 text-center text-sm text-white/40">
                    📡 Đang tìm Traveller...
                  </div>
                ) : searchQuery.trim().length < 2 ? (
                  <div className="py-10 text-center">
                    <div className="text-4xl">🧭</div>
                    <p className="font-bold mt-3">
                      Tìm bạn đồng hành
                    </p>
                    <p className="text-xs text-white/35 mt-1">
                      Nhập tên để khám phá các Traveller.
                    </p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="text-4xl">🕵️</div>
                    <p className="font-bold mt-3">
                      {searchMessage || "Không có kết quả"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((traveller) => (
                      <div
                        key={traveller.user_id}
                        className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 p-3 hover:bg-white/[0.07] transition"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            closeSearch();
                            openPublicProfile(traveller.user_id);
                          }}
                          className="w-12 h-12 shrink-0 rounded-full bg-blue-500/15 border border-blue-400/15 flex items-center justify-center text-xl"
                          title="Mở hồ sơ"
                        >
                          👤
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            closeSearch();
                            openPublicProfile(traveller.user_id);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="font-bold truncate">
                            {traveller.display_name}
                          </p>
                          <p className="text-[10px] text-white/35 mt-1">
                            Level {traveller.level} · {traveller.xp} XP · {traveller.checkpoint_count} checkpoint
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleFollow(traveller.user_id)
                          }
                          disabled={
                            followLoading[traveller.user_id]
                          }
                          className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold border transition disabled:opacity-50 ${
                            followingUserIds.includes(
                              traveller.user_id
                            )
                              ? "bg-white/5 border-white/10 text-white/65"
                              : "bg-blue-500 border-blue-400/20 text-white hover:bg-blue-400"
                          }`}
                        >
                          {followLoading[traveller.user_id]
                            ? "..."
                            : followingUserIds.includes(
                                traveller.user_id
                              )
                            ? "✓ Theo dõi"
                            : "+ Theo dõi"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          NOTIFICATIONS PANEL
      ============================================ */}

      {notificationsOpen && (
        <div className="fixed inset-0 z-[215] flex items-start justify-end px-4 pt-20">

          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() =>
              setNotificationsOpen(false)
            }
            className="absolute inset-0 bg-black/30"
          />

          <div className="relative w-full max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto overflow-x-hidden rounded-[1.5rem] border border-white/10 bg-[#07182a] shadow-2xl">

            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">

              <div>
                <p className="font-black text-lg">
                  🔔 Thông báo
                </p>
                <p className="text-[10px] text-white/35 mt-1">
                  Các hoạt động mới trên TravelQuest
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setNotificationsOpen(false)
                }
                className="w-9 h-9 rounded-full bg-white/5 text-white/50 hover:text-white transition"
              >
                ✕
              </button>

            </div>

            <div className="max-h-[65vh] overflow-y-auto">

              {notificationsLoading ? (
                <div className="py-10 text-center text-sm text-white/40">
                  📡 Đang tải thông báo...
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-12 px-6 text-center">

                  <div className="text-4xl">
                    🔕
                  </div>

                  <p className="font-bold mt-3">
                    Chưa có thông báo
                  </p>

                  <p className="text-xs text-white/35 mt-1">
                    Khi có Traveller tương tác với cậu, thông báo sẽ xuất hiện ở đây.
                  </p>

                </div>
              ) : (
                notifications.map(
                  (notification) => (
                    <div
                      key={notification.id}
                      className={`px-5 py-4 border-b border-white/5 ${
                        notification.is_read
                          ? ""
                          : "bg-blue-500/5"
                      }`}
                    >

                      <div className="flex gap-3">

                        <div className="w-10 h-10 shrink-0 rounded-full bg-blue-500/10 border border-blue-400/10 flex items-center justify-center">
                          {notification.type ===
                          "follow"
                            ? "👤"
                            : notification.type ===
                              "like"
                            ? "❤️"
                            : "💬"}
                        </div>

                        <div className="min-w-0">

                          <p className="text-sm leading-5">
                            {notification.message}
                          </p>

                          <p className="text-[10px] text-white/30 mt-1">
                            {formatPostTime(
                              notification.created_at
                            )}
                          </p>

                        </div>

                      </div>

                    </div>
                  )
                )
              )}

            </div>

            {notifications.length > 0 && (
              <div className="px-5 py-3 border-t border-white/10 text-center">
                <button
                  type="button"
                  onClick={loadNotifications}
                  disabled={
                    notificationsLoading
                  }
                  className="text-xs text-blue-300 hover:text-blue-200 font-bold transition disabled:opacity-50"
                >
                  ↻ Cập nhật
                </button>
              </div>
            )}

          </div>

        </div>
      )}

      {/* ============================================
          PUBLIC PROFILE PANEL
      ============================================ */}

      {publicProfileOpen && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center px-5">

          <button
            type="button"
            aria-label="Đóng hồ sơ"
            onClick={() => {
              setPublicProfileOpen(false);
              setPublicProfileMessage("");
            }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-sm pointer-events-auto">

            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#07182a] p-6 shadow-2xl">

              <div className="flex items-center gap-4">

                <div className="w-16 h-16 rounded-full bg-blue-500/15 border border-blue-400/20 flex items-center justify-center text-3xl">
                  👤
                </div>

                <div className="flex-1 min-w-0">

                  {publicProfileLoading ? (
                    <p className="font-bold">
                      📡 Đang tải hồ sơ...
                    </p>
                  ) : (
                    <>
                      <p className="font-black text-xl truncate">
                        {publicProfile?.display_name ??
                          "Traveller"}
                      </p>

                      <p className="text-xs text-white/40 mt-1">
                        Level{" "}
                        {publicProfile?.level ?? 1}
                        {" · "}
                        {publicProfile?.xp ?? 0} XP
                      </p>
                    </>
                  )}

                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPublicProfileOpen(false);
                    setPublicProfileMessage("");
                  }}
                  className="w-9 h-9 rounded-full bg-white/5 text-white/50 hover:text-white transition"
                >
                  ✕
                </button>

              </div>

              {publicProfileLoading ? (
                <div className="py-10 text-center text-sm text-white/40">
                  Đang tải thông tin Traveller...
                </div>
              ) : publicProfileMessage ? (
                <div className="py-8 text-center text-sm text-white/45">
                  {publicProfileMessage}
                </div>
              ) : publicProfile ? (
                <>
                  <div className="mt-6 grid grid-cols-2 gap-3">

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <p className="text-xs text-white/40">
                        Checkpoint
                      </p>
                      <p className="text-2xl font-black mt-1">
                        {publicProfile.checkpoint_count}
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <p className="text-xs text-white/40">
                        UGC
                      </p>
                      <p className="text-2xl font-black mt-1">
                        {publicProfile.post_count}
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <p className="text-xs text-white/40">
                        Người theo dõi
                      </p>
                      <p className="text-2xl font-black mt-1">
                        {publicProfile.follower_count}
                      </p>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                      <p className="text-xs text-white/40">
                        Đang theo dõi
                      </p>
                      <p className="text-2xl font-black mt-1">
                        {publicProfile.following_count}
                      </p>
                    </div>

                  </div>

                  {publicProfile.user_id !==
                    user?.id && (
                    <button
                      type="button"
                      onClick={() =>
                        toggleFollow(
                          publicProfile.user_id
                        )
                      }
                      disabled={
                        followLoading[
                          publicProfile.user_id
                        ]
                      }
                      className={`w-full mt-5 py-3 rounded-xl border font-bold transition disabled:opacity-50 ${
                        followingUserIds.includes(
                          publicProfile.user_id
                        )
                          ? "bg-white/5 border-white/10 text-white/70"
                          : "bg-blue-500 border-blue-400/20 text-white hover:bg-blue-400"
                      }`}
                    >
                      {followLoading[
                        publicProfile.user_id
                      ]
                        ? "📡 Đang cập nhật..."
                        : followingUserIds.includes(
                            publicProfile.user_id
                          )
                        ? "✓ Đang theo dõi"
                        : "+ Theo dõi"}
                    </button>
                  )}

                  {/* ============================================
                      PUBLIC JOURNEY SUMMARY
                  ============================================ */}

                  <div className="mt-5">

                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-black">🧭 Hành trình</p>
                        <p className="text-[11px] text-white/35 mt-1">
                          Tiến trình khám phá của Traveller
                        </p>
                      </div>

                      <div className="text-xs text-white/40">
                        {publicProfile.checkpoint_count} checkpoint
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/45">XP</span>
                        <span className="font-bold text-blue-200">
                          {publicProfile.xp} XP
                        </span>
                      </div>

                      <div className="h-2 mt-3 rounded-full bg-black/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{
                            width: `${Math.min(100, ((publicProfile.xp % 500) / 500) * 100)}%`,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between mt-2 text-[10px] text-white/30">
                        <span>Level {publicProfile.level}</span>
                        <span>
                          {publicProfile.xp % 500} / 500 XP đến level tiếp theo
                        </span>
                      </div>

                    </div>

                  </div>

                  <div className="mt-5">

                    <p className="text-sm font-black mb-3">🏆 Thành tựu</p>

                    <div className="grid grid-cols-2 gap-2">

                      <div className={`rounded-2xl border p-3 ${
                        publicProfile.checkpoint_count >= 1
                          ? "bg-blue-500/10 border-blue-400/20"
                          : "bg-white/5 border-white/10 opacity-45"
                      }`}>
                        <p className="text-lg">🌱</p>
                        <p className="text-xs font-bold mt-1">Khởi hành</p>
                        <p className="text-[10px] text-white/35 mt-1">
                          Checkpoint đầu tiên
                        </p>
                      </div>

                      <div className={`rounded-2xl border p-3 ${
                        publicProfile.checkpoint_count >= 2
                          ? "bg-blue-500/10 border-blue-400/20"
                          : "bg-white/5 border-white/10 opacity-45"
                      }`}>
                        <p className="text-lg">🗺️</p>
                        <p className="text-xs font-bold mt-1">Nhà khám phá</p>
                        <p className="text-[10px] text-white/35 mt-1">
                          2 checkpoint
                        </p>
                      </div>

                      <div className={`rounded-2xl border p-3 ${
                        publicProfile.post_count >= 1
                          ? "bg-blue-500/10 border-blue-400/20"
                          : "bg-white/5 border-white/10 opacity-45"
                      }`}>
                        <p className="text-lg">📸</p>
                        <p className="text-xs font-bold mt-1">Người kể chuyện</p>
                        <p className="text-[10px] text-white/35 mt-1">
                          Bài UGC đầu tiên
                        </p>
                      </div>

                      <div className={`rounded-2xl border p-3 ${
                        publicProfile.post_count >= 5
                          ? "bg-blue-500/10 border-blue-400/20"
                          : "bg-white/5 border-white/10 opacity-45"
                      }`}>
                        <p className="text-lg">🎒</p>
                        <p className="text-xs font-bold mt-1">Travel Creator</p>
                        <p className="text-[10px] text-white/35 mt-1">
                          5 bài UGC
                        </p>
                      </div>

                    </div>

                  </div>

                  {publicProfile.user_id ===
                    user?.id && (
                    <div className="mt-5 rounded-xl bg-blue-500/10 border border-blue-400/15 px-4 py-3 text-center text-sm text-blue-200">
                      Đây là hồ sơ công khai của bạn.
                    </div>
                  )}

                </>
              ) : null}

            </div>

          </div>

        </div>
      )}

      {/* ============================================
          ACCOUNT PANEL
      ============================================ */}

      {authOpen &&
        user && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center px-5 pointer-events-none">

            <div className="absolute inset-0 pointer-events-auto" />

            <div className="relative w-full max-w-sm pointer-events-auto">

              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#07182a] p-6 shadow-2xl">

                <div className="flex items-center gap-4">

                  <div className="w-14 h-14 rounded-full bg-blue-500/15 border border-blue-400/20 flex items-center justify-center text-2xl">
                    👤
                  </div>

                  <div className="flex-1 min-w-0">

                    <p className="font-black text-lg">
                      {profileName}
                    </p>

                    <p className="text-xs text-white/45 truncate">
                      {user.email}
                    </p>

                  </div>

                  <button
                    onClick={() => {
                      setAuthOpen(false);
                      setAuthMessage("");
                    }}
                    className="w-9 h-9 rounded-full bg-white/5 text-white/50 hover:text-white transition"
                  >
                    ✕
                  </button>

                </div>

                {/* ================= PROFILE NAME ================= */}

                <div className="mt-6">

                  <label className="block text-xs text-white/50 mb-2">
                    Tên hiển thị
                  </label>

                  <div className="flex gap-2">

                    <input
                      type="text"
                      value={
                        profileNameInput
                      }
                      maxLength={30}
                      onChange={(event) =>
                        setProfileNameInput(
                          event.target.value
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          saveProfile();
                        }
                      }}
                      placeholder="Tên của bạn"
                      className="min-w-0 flex-1 rounded-xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-400/50 transition"
                    />

                    <button
                      onClick={
                        saveProfile
                      }
                      disabled={
                        profileLoading
                      }
                      className="shrink-0 px-4 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-sm font-bold transition"
                    >
                      {profileLoading
                        ? "..."
                        : "Lưu"}
                    </button>

                  </div>

                  {profileMessage && (
                    <p className="text-xs text-blue-300 mt-2">
                      {profileMessage}
                    </p>
                  )}

                </div>

                <div className="mt-5">
                  <p className="text-xs text-white/50 mb-2">Ảnh avatar</p>

                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 bg-white/5 shrink-0">
                      {avatarImageUrl ? (
                        <img
                          src={avatarImageUrl}
                          alt="Avatar của bạn"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          {avatarEmoji}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(event) => void handleAvatarUpload(event)}
                      />

                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={avatarUploading}
                          className="px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-400/20 text-blue-200 text-xs font-bold hover:bg-blue-500/25 transition disabled:opacity-50"
                        >
                          {avatarUploading ? "📡 Đang xử lý..." : "📷 Chọn ảnh"}
                        </button>

                        {avatarImageUrl && (
                          <button
                            type="button"
                            onClick={removeAvatarImage}
                            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-bold hover:bg-white/10 hover:text-white transition"
                          >
                            Xóa ảnh
                          </button>
                        )}
                      </div>

                      <p className="text-[10px] text-white/35 mt-2">
                        PNG, JPG hoặc WebP · tối đa 5MB. Ảnh được thu nhỏ để làm avatar.
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-white/50 mt-4 mb-2">Avatar biểu tượng</p>
                  <div className="flex gap-2 flex-wrap">
                    {["🧭","🌍","🏕️","📸","🎒","🗺️","🏆","✨"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setAvatarEmoji(emoji)}
                        className={`w-10 h-10 rounded-xl border ${avatarEmoji === emoji ? "border-blue-400 bg-blue-500/15" : "border-white/10 bg-white/5"}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ================= ACCOUNT STATS ================= */}

                <div className="mt-5 grid grid-cols-2 gap-3">

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">

                    <p className="text-xs text-white/40">
                      Checkpoint
                    </p>

                    <p className="text-2xl font-black mt-1">
                      {checkins.length}
                    </p>

                    <p className="text-[10px] text-white/30 mt-1">
                      đã chinh phục
                    </p>

                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">

                    <p className="text-xs text-white/40">
                      UGC
                    </p>

                    <p className="text-2xl font-black mt-1">
                      {userPostCount}
                    </p>

                    <p className="text-[10px] text-white/30 mt-1">
                      bài đã đăng
                    </p>

                  </div>

                </div>

                <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4">

                  <div className="flex items-center justify-between">

                    <div>

                      <p className="text-xs text-white/40">
                        Trạng thái
                      </p>

                      <p className="text-sm font-bold mt-1">
                        🟢 Đang đăng nhập
                      </p>

                    </div>

                    <div className="text-2xl">
                      🧭
                    </div>

                  </div>

                </div>

                <button
                  onClick={() => {
                    setSettingsMessage("");
                    setAuthOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="w-full mt-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition"
                >
                  ⚙️ Cài đặt
                </button>

                <button
                  onClick={
                    handleLogout
                  }
                  disabled={
                    authLoading
                  }
                  className="w-full mt-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-400/15 text-red-300 font-bold transition disabled:opacity-50"
                >
                  {authLoading
                    ? "📡 Đang đăng xuất..."
                    : "🚪 Đăng xuất"}
                </button>

              </div>

            </div>

          </div>
        )}

        {/* ================= EXTRA FEATURE MODALS ================= */}
      {editPostId !== null && (
        <div className="fixed inset-0 z-[260] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#07182a] border border-white/10 p-5">
            <div className="flex items-center justify-between"><h3 className="font-black">✏️ Sửa bài viết</h3><button onClick={() => setEditPostId(null)}>✕</button></div>
            <textarea value={editPostContent} onChange={(event) => setEditPostContent(event.target.value)} maxLength={1000} className="w-full min-h-40 mt-4 rounded-2xl bg-black/20 border border-white/10 p-4 text-sm outline-none" />
            <div className="flex gap-2 mt-3"><button onClick={() => setEditPostId(null)} className="flex-1 rounded-xl bg-white/5 py-3">Hủy</button><button onClick={() => void saveEditedPost()} className="flex-1 rounded-xl bg-blue-500 py-3 font-bold">Lưu</button></div>
          </div>
        </div>
      )}

      {routePlannerOpen && (
        <div className="fixed inset-0 z-[250] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#07182a] border border-white/10 p-5">
            <div className="flex items-center justify-between"><div><p className="text-xs text-emerald-300 font-bold">ROUTE PLANNER</p><h3 className="text-xl font-black mt-1">🗺️ Lập tuyến</h3></div><button onClick={() => setRoutePlannerOpen(false)}>✕</button></div>
            <p className="text-xs text-white/45 mt-3">{journeyCheckpointIds.length} checkpoint trong tuyến. Kéo thứ tự bằng cách bỏ/chọn lại checkpoint trong Journey.</p>
            <div className="space-y-2 mt-4">{journeyCheckpoints.map((checkpoint, index) => <div key={checkpoint.id} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/5 p-3"><span className="w-7 h-7 rounded-full bg-blue-500/15 flex items-center justify-center text-xs">{index + 1}</span><span className="text-sm font-semibold">{checkpoint.icon ?? "📍"} {checkpoint.name}</span></div>)}</div>
            {buildRouteUrl() ? <a href={buildRouteUrl()} target="_blank" rel="noreferrer" className="block text-center mt-4 rounded-xl bg-blue-500 py-3 font-bold text-sm">🚗 Mở tuyến trên Google Maps</a> : <p className="text-xs text-yellow-300 mt-4">Chọn ít nhất 2 checkpoint để tạo tuyến.</p>}
          </div>
        </div>
      )}

      {smartTravelOpen && (
        <div className="fixed inset-0 z-[250] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl bg-[#07182a] border border-white/10 p-5">
            <div className="flex items-center justify-between"><div><p className="text-xs text-blue-300 font-bold">SMART TRAVEL</p><h3 className="text-xl font-black mt-1">✨ Trợ lý TravelQuest</h3></div><button onClick={() => setSmartTravelOpen(false)}>✕</button></div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3"><p className="text-xs text-white/40">Checkpoint tiếp theo</p><p className="text-sm font-bold mt-1">{checkpoints.find((checkpoint) => !isCheckedIn(checkpoint.id))?.name ?? "Đã hoàn thành"}</p></div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3"><p className="text-xs text-white/40">Tiến độ</p><p className="text-sm font-bold mt-1">{progress}% · Level {currentLevel}</p></div>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mt-3"><p className="text-xs text-white/40">Gợi ý lịch trình</p><div className="mt-2 space-y-2">{checkpoints.filter((checkpoint) => !isCheckedIn(checkpoint.id)).slice(0, 4).map((checkpoint, index) => <div key={checkpoint.id} className="flex items-center gap-3 text-sm"><span className="w-7 h-7 rounded-full bg-blue-500/15 flex items-center justify-center text-xs">{index + 1}</span><span>{checkpoint.icon ?? "📍"} {checkpoint.name}</span></div>)}</div></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mt-3"><p className="text-xs text-white/40">🏆 Huy hiệu còn thiếu</p><p className="text-sm mt-1">{missingAchievements.length ? missingAchievements.map((item) => item.name).slice(0, 3).join(" · ") : "Bạn đã mở hết huy hiệu cơ bản."}</p></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mt-3"><p className="text-xs text-white/40">TravelQuest AI Assistant</p><div className="flex gap-2 mt-2"><input value={assistantInput} onChange={(event) => setAssistantInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") askTravelAssistant(); }} placeholder="Ví dụ: checkpoint tiếp theo?" className="flex-1 rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-xs outline-none" /><button onClick={askTravelAssistant} className="rounded-xl bg-blue-500 px-3 text-xs font-bold">Hỏi</button></div>{assistantReply && <p className="text-xs text-blue-200 mt-3">{assistantReply}</p>}</div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mt-3"><p className="text-xs text-white/40">Journey Summary</p><p className="text-sm font-bold mt-1">{journeyName} · {journeyCompletedCount}/{journeyCheckpoints.length} checkpoint · {journeyProgress}%</p><p className="text-[10px] text-white/35 mt-1">{journeyStartDate || "Chưa có ngày bắt đầu"} → {journeyEndDate || "Chưa có ngày kết thúc"}</p></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mt-3"><p className="text-xs text-white/40">Travel services</p><div className="grid grid-cols-2 gap-2 mt-2">{bookingOptions.map((option) => <div key={option.title} className="rounded-xl bg-black/10 border border-white/5 p-3"><p className="text-sm font-bold">{option.icon} {option.title}</p><div className="flex flex-wrap gap-2 mt-2">{option.links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-300 hover:text-blue-200">{link.label}</a>)}</div></div>)}</div></div>
          </div>
        </div>
      )}

      {chatOpen && (
        <div className="fixed inset-0 z-[250] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-3xl bg-[#07182a] border border-white/10 p-5">
            <div className="flex items-center justify-between"><div><p className="text-xs text-purple-300 font-bold">COMMUNITY</p><h3 className="text-xl font-black">💬 Traveller Chat</h3></div><button onClick={() => setChatOpen(false)}>✕</button></div>
            <div className="flex-1 min-h-64 max-h-80 overflow-y-auto space-y-2 mt-4">{chatMessages.length === 0 ? <p className="text-sm text-white/40 text-center py-10">Chưa có tin nhắn. Bắt đầu trò chuyện!</p> : chatMessages.map((message) => <div key={message.id} className="rounded-xl bg-white/5 border border-white/5 p-3"><p className="text-[10px] text-white/40">{message.sender}</p><p className="text-sm mt-1">{message.text}</p></div>)}</div>
            <div className="flex gap-2 mt-3"><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendChatMessage(); }} placeholder="Nhắn tin..." className="flex-1 rounded-xl bg-black/20 border border-white/10 px-3 py-3 text-sm outline-none" /><button onClick={sendChatMessage} className="rounded-xl bg-blue-500 px-4 font-bold">Gửi</button></div>
          </div>
        </div>
      )}

      {/* ================= ACCOUNT SETTINGS ================= */}
        {settingsOpen && user && (
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-3xl bg-[#07152f] border border-white/10 shadow-2xl p-5 sm:p-6">

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-blue-300 font-bold uppercase tracking-wider">
                    Tài khoản
                  </p>
                  <h2 className="text-xl font-black mt-1">
                    ⚙️ Cài đặt
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSettingsOpen(false);
                      setSettingsMessage("");
                      setAuthOpen(true);
                    }}
                    className="h-9 px-3 rounded-full bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition text-xs font-bold"
                  >
                    ← Tài khoản
                  </button>

                  <button
                    onClick={() => {
                      setSettingsOpen(false);
                      setSettingsMessage("");
                    }}
                    className="w-9 h-9 rounded-full bg-white/5 text-white/50 hover:text-white transition"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={handleToggleNotifications}
                  className="w-full flex items-center justify-between gap-4 rounded-2xl bg-white/5 border border-white/10 p-4 text-left hover:bg-white/10 transition"
                >
                  <div>
                    <p className="font-bold">🔔 Thông báo</p>
                    <p className="text-xs text-white/40 mt-1">
                      {notificationsEnabled ? "Đang bật" : "Đang tắt"}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${notificationsEnabled ? "bg-blue-500/20 text-blue-300" : "bg-white/10 text-white/40"}`}>
                    {notificationsEnabled ? "BẬT" : "TẮT"}
                  </span>
                </button>

                <button
                  onClick={handleToggleGps}
                  className="w-full flex items-center justify-between gap-4 rounded-2xl bg-white/5 border border-white/10 p-4 text-left hover:bg-white/10 transition"
                >
                  <div>
                    <p className="font-bold">📍 GPS</p>
                    <p className="text-xs text-white/40 mt-1">
                      {gpsEnabled ? "Cho phép TravelQuest theo dõi vị trí khi cần check-in" : "Đang tắt theo dõi vị trí"}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${gpsEnabled ? "bg-blue-500/20 text-blue-300" : "bg-white/10 text-white/40"}`}>
                    {gpsEnabled ? "BẬT" : "TẮT"}
                  </span>
                </button>

                <button
                  onClick={handleClearLocalData}
                  className="w-full rounded-2xl bg-red-500/10 border border-red-400/15 p-4 text-left hover:bg-red-500/15 transition"
                >
                  <p className="font-bold text-red-300">🧹 Xóa dữ liệu trên thiết bị</p>
                  <p className="text-xs text-white/40 mt-1">
                    Xóa địa điểm đã lưu và hành trình lưu trên trình duyệt.
                  </p>
                </button>
              </div>

              {settingsMessage && (
                <p className="text-xs text-blue-300 mt-4">
                  {settingsMessage}
                </p>
              )}

              <div className="mt-5 rounded-2xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs text-white/40">Tài khoản</p>
                <p className="text-sm font-bold mt-1 truncate">{user.email}</p>
                <p className="text-[10px] text-white/30 mt-2">
                  TravelQuest MVP • Dữ liệu tài khoản được lưu trên Supabase.
                </p>
              </div>

            </div>
          </div>
        )}

    </main>
  );
}