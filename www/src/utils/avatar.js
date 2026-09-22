import { getFilePreviewUrl } from "../config/appwrite.js";

const withVersion = (url, version) => {
  if (!url || !version || /^(?:data:|blob:)/i.test(url)) return url || "";
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(String(version))}`;
};

export function avatarInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  return `${parts[0][0] || ""}${parts.length > 1 ? parts[parts.length - 1][0] || "" : ""}`.toUpperCase();
}

export function resolveAvatarUrl(profile) {
  if (!profile) return "";
  const fileId = profile.profile_image_id || profile.profile_photo_drive_id || profile.photo_file_id || "";
  const version = profile.updated_at || fileId;
  if (fileId) return withVersion(getFilePreviewUrl(fileId), version);

  const stored = String(profile.profile_photo_url || profile.avatar_url || "").trim();
  if (!stored) return "";

  const proxyMatch = stored.match(/\/api\/files\/preview\/([^?/#]+)/i);
  if (proxyMatch) return withVersion(getFilePreviewUrl(decodeURIComponent(proxyMatch[1])), version);

  // Private Drive browser links are not renderable in Android WebView and must
  // never be made public. A Drive-backed profile must use profile_image_id.
  if (/drive\.google\.com|googleusercontent\.com/i.test(stored)) return "";
  if (/^(?:https?:|data:|blob:)/i.test(stored)) return withVersion(stored, version);
  return "";
}

export function handleAvatarImageError(image, fallbackElement = null) {
  if (image) image.style.display = "none";
  if (fallbackElement) fallbackElement.style.display = "flex";
}
