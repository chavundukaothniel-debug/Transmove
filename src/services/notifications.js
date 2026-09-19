// ==============================================================================
// TRANSMOVE NOTIFICATION SERVICE
// In-App Toast & DB Event Notification Management via Trusted API & Supabase
// ==============================================================================
import { getTrustedApiEndpoint } from "../config/appwrite.js";
import { getAuthJwt } from "../config/supabase.js";

async function trustedCall(action, data = {}) {
  const jwt = await getAuthJwt();
  if (!jwt) return { notifications: [] };

  const endpoint = getTrustedApiEndpoint();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`
    },
    body: JSON.stringify({ action, data, jwt })
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Trusted API error (HTTP ${res.status})`);
  }
  return body;
}

export const NotificationService = {
  /**
   * Fetches unread & recent notifications for current user.
   */
  async getNotifications(userId) {
    try {
      const result = await trustedCall("list_notifications", {});
      return (result.notifications || []).map(n => ({
        ...n,
        id: n.$id || n.id,
        body: n.message || n.body,
        is_read: n.read !== undefined ? n.read : n.is_read
      }));
    } catch (err) {
      console.warn("getNotifications notice:", err.message);
      return [];
    }
  },

  /**
   * Marks a notification as read.
   */
  async markAsRead(notificationId) {
    if (!notificationId) return;

    try {
      await trustedCall("mark_notification_read", { notification_id: notificationId });
    } catch (err) {
      console.warn("markAsRead notice:", err.message);
    }
  },

  /**
   * Marks all notifications for current user as read.
   */
  async markAllAsRead() {
    try {
      await trustedCall("mark_all_notifications_read", {});
    } catch (err) {
      console.warn("markAllAsRead notice:", err.message);
    }
  },

  /**
   * Subscribes to realtime incoming notifications for the current user.
   */
  subscribeToNotifications(userId, callback) {
    return { unsubscribe: () => {} };
  },

  /**
   * Creates an in-app toast popup overlay.
   * UI PRESERVED: Zero visual changes.
   */
  showToast(title, message, type = "info", options = {}) {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 360px;
      `;
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    const bgColor = type === "error" ? "#EF4444" : type === "success" ? "#10B981" : "#3B82F6";

    toast.style.cssText = `
      background: var(--bg-surface, #1e293b);
      color: var(--text-main, #f8fafc);
      border-left: 5px solid ${bgColor};
      padding: 14px 18px;
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      font-size: 0.9rem;
      animation: slideIn 0.3s ease-out;
    `;

    toast.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 4px;">${title}</div>
      <div style="color: var(--text-muted, #94a3b8); font-size: 0.85rem;">${message}</div>
      ${options.actionLabel ? `<button type="button" class="toast-action" style="margin-top: 0.65rem; padding: 0; border: 0; background: transparent; color: #60a5fa; font: inherit; font-weight: 800; cursor: pointer;">${options.actionLabel}</button>` : ""}
    `;

    container.appendChild(toast);

    let settled = false;
    toast.querySelector(".toast-action")?.addEventListener("click", async () => {
      if (settled) return;
      settled = true;
      try { await options.onAction?.(); } finally { toast.remove(); }
    });

    setTimeout(() => {
      if (settled || !toast.isConnected) return;
      settled = true;
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, Number(options.duration || 4500));

    return toast;
  }
};
