const ONBOARDING_KEY = "transmove_permissions_onboarding_seen";

const normalizeState = (state) => {
  if (state === "granted") return "granted";
  if (state === "denied") return "denied";
  return "prompt";
};

const browserPermission = async (name) => {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "prompt";
  try {
    const result = await navigator.permissions.query({ name });
    return normalizeState(result.state);
  } catch (_) {
    return "prompt";
  }
};

const getCapacitor = () => globalThis.Capacitor || null;
const getNativeGeolocation = () => getCapacitor()?.Plugins?.Geolocation || null;
const getNativeDevicePermissions = () => getCapacitor()?.Plugins?.DevicePermissions || null;
const isAndroid = () => {
  const capacitor = getCapacitor();
  return Boolean(capacitor?.isNativePlatform?.() && capacitor?.getPlatform?.() === "android");
};

export const DevicePermissionService = {
  isAndroid,

  getNativeGeolocation,

  async checkLocation() {
    if (isAndroid()) {
      try {
        const result = await getNativeGeolocation().checkPermissions();
        if (result.location === "granted" || result.coarseLocation === "granted") return "granted";
        if (result.location === "denied" && result.coarseLocation === "denied") return "denied";
        return "prompt";
      } catch (_) {
        return "prompt";
      }
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) return "denied";
    return browserPermission("geolocation");
  },

  async requestLocation() {
    if (isAndroid()) {
      try {
        const result = await getNativeGeolocation().requestPermissions({ permissions: ["location", "coarseLocation"] });
        if (result.location === "granted" || result.coarseLocation === "granted") return "granted";
        return result.location === "denied" && result.coarseLocation === "denied" ? "denied" : "prompt";
      } catch (_) {
        return "denied";
      }
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) return "denied";
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve("granted"),
        (error) => resolve(error?.code === 1 ? "denied" : "prompt"),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    });
  },

  async checkNotification() {
    if (isAndroid() && getNativeDevicePermissions()) {
      try {
        const result = await getNativeDevicePermissions().checkPermissions();
        return normalizeState(result.notifications);
      } catch (_) {
        return "prompt";
      }
    }
    if (typeof Notification === "undefined") return "prompt";
    return normalizeState(Notification.permission === "default" ? "prompt" : Notification.permission);
  },

  async requestNotification() {
    if (isAndroid() && getNativeDevicePermissions()) {
      try {
        const result = await getNativeDevicePermissions().requestPermissions({ permissions: ["notifications"] });
        return normalizeState(result.notifications);
      } catch (_) {
        return "denied";
      }
    }
    if (typeof Notification === "undefined" || typeof Notification.requestPermission !== "function") return "prompt";
    try {
      return normalizeState(await Notification.requestPermission());
    } catch (_) {
      return "denied";
    }
  },

  async checkCamera() {
    if (isAndroid()) return "prompt";
    return browserPermission("camera");
  },

  async requestCamera() {
    if (isAndroid() || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return "prompt";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      return "granted";
    } catch (error) {
      return error?.name === "NotAllowedError" ? "denied" : "prompt";
    }
  },

  async openAppSettings() {
    if (!isAndroid()) return false;
    if (getNativeDevicePermissions()?.openAppSettings) {
      try {
        const result = await getNativeDevicePermissions().openAppSettings();
        return result?.opened !== false;
      } catch (_) {}
    }
    const appId = "zw.co.transmove.app";
    const intentUrl = `intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:${appId};end`;
    try {
      window.location.assign(intentUrl);
      return true;
    } catch (_) {
      return false;
    }
  },

  hasSeenOnboarding() {
    try {
      return localStorage.getItem(ONBOARDING_KEY) === "true";
    } catch (_) {
      return false;
    }
  },

  markOnboardingSeen() {
    try {
      localStorage.setItem(ONBOARDING_KEY, "true");
    } catch (_) {}
  }
};
