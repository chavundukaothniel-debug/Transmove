import { icon } from "./Icon.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

const STORAGE_PREFIX = "transmove_popup_seen_v1";

export const SmartPopup = {
  queue: [],
  current: null,

  _storageKey(userId) {
    return `${STORAGE_PREFIX}:${userId || "guest"}`;
  },

  _seen(userId) {
    try {
      return new Set(JSON.parse(localStorage.getItem(this._storageKey(userId)) || "[]"));
    } catch (_) {
      return new Set();
    }
  },

  hasSeen(userId, eventKey) {
    return Boolean(eventKey && this._seen(userId).has(eventKey));
  },

  markSeen(userId, eventKey) {
    if (!eventKey) return;
    const seen = this._seen(userId);
    seen.add(eventKey);
    try {
      localStorage.setItem(this._storageKey(userId), JSON.stringify([...seen].slice(-250)));
    } catch (_) {}
  },

  _markup(options) {
    const actions = Array.isArray(options.actions) ? options.actions : [];
    return `
      <section class="smart-popup-card ${options.kind === "sponsored" ? "smart-popup-card--sponsored" : ""} ${options.pulse ? "smart-popup-card--pulse" : ""}" data-sheet-state="${escapeHtml(options.state || "default")}">
        <div class="smart-popup-accent"></div>
        <div class="smart-popup-grabber" aria-hidden="true"></div>
        <header class="smart-popup-header">
          <div>
            ${options.eyebrow ? `<span class="smart-popup-eyebrow">${escapeHtml(options.eyebrow)}</span>` : ""}
            <h2 class="smart-popup-title">${escapeHtml(options.title)}</h2>
          </div>
          <div class="smart-popup-window-actions">
            ${options.minimizable ? `<button type="button" class="smart-popup-minimize" aria-label="Minimize" title="Minimize">${icon("minus", 18)}</button>` : ""}
            ${options.dismissible === false ? "" : `<button type="button" class="smart-popup-close" aria-label="Close" title="Close">${icon("x", 18)}</button>`}
          </div>
        </header>
        <div class="smart-popup-connection" ${options.connectionLost ? "" : "hidden"}><strong>Connection lost</strong><span>Trying to reconnect…</span></div>
        <div class="smart-popup-body">${options.html || ""}</div>
        <div class="smart-popup-error" hidden></div>
        ${actions.length ? `<footer class="smart-popup-actions">${actions.map((action, index) => `
          <button type="button" class="btn ${action.primary ? "btn-primary" : action.danger ? "btn-danger" : "btn-outline"} smart-popup-action" data-action-index="${index}" ${action.id ? `id="${escapeHtml(action.id)}"` : ""}>${escapeHtml(action.label)}</button>
        `).join("")}</footer>` : ""}
      </section>
    `;
  },

  _bind(options) {
    const current = this.current;
    if (!current?.backdrop) return;
    const { backdrop } = current;
    const actions = Array.isArray(options.actions) ? options.actions : [];
    backdrop.querySelector(".smart-popup-close")?.addEventListener("click", () => this.close());
    backdrop.querySelector(".smart-popup-minimize")?.addEventListener("click", () => this.minimize());

    // Native-feeling mobile sheet drag. Dragging down minimizes flows that can
    // safely continue in the background; a short drag snaps to half height.
    const card = backdrop.querySelector(".smart-popup-card");
    const grabber = backdrop.querySelector(".smart-popup-grabber");
    if (card && grabber && window.matchMedia?.("(max-width: 768px)").matches) {
      let startY = 0;
      let deltaY = 0;
      const resetDrag = () => {
        card.style.removeProperty("transform");
        card.style.removeProperty("transition");
      };
      grabber.addEventListener("pointerdown", (event) => {
        startY = event.clientY;
        deltaY = 0;
        grabber.setPointerCapture?.(event.pointerId);
        card.style.transition = "none";
      });
      grabber.addEventListener("pointermove", (event) => {
        if (!startY) return;
        deltaY = Math.max(-45, event.clientY - startY);
        card.style.transform = `translateY(${Math.max(0, deltaY)}px)`;
      });
      grabber.addEventListener("pointerup", () => {
        const drag = deltaY;
        startY = 0;
        deltaY = 0;
        resetDrag();
        if (drag > 110 && options.minimizable) {
          this.minimize();
        } else if (drag > 42) {
          card.dataset.sheetPosition = "half";
        } else {
          card.dataset.sheetPosition = "expanded";
        }
      });
      grabber.addEventListener("pointercancel", () => {
        startY = 0;
        deltaY = 0;
        resetDrag();
      });
    }

    backdrop.querySelectorAll(".smart-popup-action").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = actions[Number(button.dataset.actionIndex)];
        if (!action) return;
        const error = backdrop.querySelector(".smart-popup-error");
        error.hidden = true;
        const allButtons = [...backdrop.querySelectorAll("button")];
        allButtons.forEach((item) => { item.disabled = true; });
        const original = button.textContent;
        if (action.busyLabel) button.textContent = action.busyLabel;
        try {
          const result = await action.onClick?.({
            backdrop,
            close: () => this.close(),
            update: (next) => this.update(next),
            minimize: () => this.minimize()
          });
          if (action.close !== false && result !== false) this.close();
        } catch (cause) {
          error.textContent = cause?.message || "This action could not be completed.";
          error.hidden = false;
          allButtons.forEach((item) => { item.disabled = false; });
          button.textContent = original;
        }
      });
    });

    try { options.onRender?.({ backdrop, update: (next) => this.update(next) }); } catch (error) {
      console.warn("Smart sheet render notice:", error.message);
    }
    setTimeout(() => backdrop.querySelector(".smart-popup-action.btn-primary")?.focus(), 0);
  },

  open(options = {}) {
    if (!options.title) return false;
    const userId = options.userId || "guest";
    if (this.current?.flowKey && options.flowKey && this.current.flowKey === options.flowKey) return this.update(options);
    if (options.eventKey && this.hasSeen(userId, options.eventKey)) return false;
    if (this.current?.eventKey === options.eventKey && options.eventKey) return false;
    if (this.current) {
      if (!this.queue.some((item) => item.eventKey && item.eventKey === options.eventKey)) this.queue.push(options);
      return true;
    }

    const backdrop = document.createElement("div");
    backdrop.id = "smart-popup-backdrop";
    backdrop.className = "smart-popup-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-label", options.title);
    backdrop.innerHTML = this._markup(options);
    document.body.appendChild(backdrop);
    this.current = { ...options, userId, backdrop, minimized: false, pill: null };
    if (options.eventKey) this.markSeen(userId, options.eventKey);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop && this.current?.dismissible !== false && !this.current?.minimizable) this.close();
    });
    this._bind(this.current);
    if (this.autoMinimizeTimer) clearTimeout(this.autoMinimizeTimer);
    this.autoMinimizeTimer = null;
    if (typeof options.autoMinimizeAfter === "number" && options.autoMinimizeAfter > 0) {
      this.autoMinimizeTimer = setTimeout(() => {
        if (this.current && !this.current.minimized) this.minimize();
      }, options.autoMinimizeAfter);
    }
    return true;
  },

  update(options = {}) {
    if (!this.current?.backdrop) return this.open(options);
    const previous = this.current;
    const merged = {
      ...previous,
      ...options,
      pulse: options.pulse === true,
      onRender: options.onRender || null,
      backdrop: previous.backdrop,
      pill: previous.pill,
      minimized: false
    };
    previous.pill?.remove();
    merged.pill = null;
    merged.backdrop.style.display = "flex";
    merged.backdrop.setAttribute("aria-label", merged.title || "TransMove update");
    merged.backdrop.innerHTML = this._markup(merged);
    this.current = merged;
    if (options.eventKey) this.markSeen(merged.userId, options.eventKey);
    const card = merged.backdrop.querySelector(".smart-popup-card");
    card?.classList.add("smart-popup-card--transitioning");
    setTimeout(() => card?.classList.remove("smart-popup-card--transitioning"), 260);
    this._bind(merged);
    if (this.autoMinimizeTimer) clearTimeout(this.autoMinimizeTimer);
    this.autoMinimizeTimer = null;
    if (typeof options.autoMinimizeAfter === "number" && options.autoMinimizeAfter > 0) {
      this.autoMinimizeTimer = setTimeout(() => {
        if (this.current && !this.current.minimized) this.minimize();
      }, options.autoMinimizeAfter);
    }
    return true;
  },

  minimize() {
    if (this.autoMinimizeTimer) clearTimeout(this.autoMinimizeTimer);
    this.autoMinimizeTimer = null;
    const current = this.current;
    if (!current?.backdrop || current.minimized) return false;
    current.minimized = true;
    current.backdrop.style.display = "none";
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "smart-popup-pill";
    pill.innerHTML = `<span class="smart-popup-pill-dot"></span><span>${escapeHtml(current.pillText || current.title)}</span>`;
    pill.setAttribute("aria-label", `Restore ${current.title}`);
    pill.addEventListener("click", () => this.restore());
    document.body.appendChild(pill);
    current.pill = pill;
    return true;
  },

  restore() {
    if (this.autoMinimizeTimer) clearTimeout(this.autoMinimizeTimer);
    this.autoMinimizeTimer = null;
    const current = this.current;
    if (!current?.backdrop || !current.minimized) return false;
    current.minimized = false;
    current.pill?.remove();
    current.pill = null;
    current.backdrop.style.display = "flex";
    current.backdrop.querySelector(".smart-popup-card")?.classList.add("smart-popup-card--transitioning");
    return true;
  },

  setConnectionStatus(isOffline) {
    if (!this.current?.backdrop) return false;
    this.current.connectionLost = Boolean(isOffline);
    const banner = this.current.backdrop.querySelector(".smart-popup-connection");
    if (banner) banner.hidden = !isOffline;
    if (this.current.pill) this.current.pill.classList.toggle("smart-popup-pill--offline", Boolean(isOffline));
    return true;
  },

  close() {
    if (this.autoMinimizeTimer) clearTimeout(this.autoMinimizeTimer);
    this.autoMinimizeTimer = null;
    const current = this.current;
    this.current = null;
    current?.pill?.remove();
    current?.backdrop?.remove();
    const next = this.queue.shift();
    if (next) setTimeout(() => this.open(next), 80);
  },

  clear() {
    this.queue = [];
    this.close();
  }
};
