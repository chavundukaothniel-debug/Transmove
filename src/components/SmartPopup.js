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

  open(options = {}) {
    if (!options.title) return false;
    const userId = options.userId || "guest";
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

    const actions = Array.isArray(options.actions) ? options.actions : [];
    backdrop.innerHTML = `
      <section class="smart-popup-card ${options.kind === "sponsored" ? "smart-popup-card--sponsored" : ""}">
        <div class="smart-popup-accent"></div>
        <header class="smart-popup-header">
          <div>
            ${options.eyebrow ? `<span class="smart-popup-eyebrow">${escapeHtml(options.eyebrow)}</span>` : ""}
            <h2>${escapeHtml(options.title)}</h2>
          </div>
          ${options.dismissible === false ? "" : `<button type="button" class="smart-popup-close" aria-label="Close popup">×</button>`}
        </header>
        <div class="smart-popup-body">${options.html || ""}</div>
        <div class="smart-popup-error" hidden></div>
        ${actions.length ? `<footer class="smart-popup-actions">${actions.map((action, index) => `
          <button type="button" class="btn ${action.primary ? "btn-primary" : action.danger ? "btn-danger" : "btn-outline"} smart-popup-action" data-action-index="${index}">${escapeHtml(action.label)}</button>
        `).join("")}</footer>` : ""}
      </section>
    `;

    document.body.appendChild(backdrop);
    this.current = { ...options, userId, backdrop };
    if (options.eventKey) this.markSeen(userId, options.eventKey);

    const close = () => this.close();
    backdrop.querySelector(".smart-popup-close")?.addEventListener("click", close);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop && options.dismissible !== false) close();
    });

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
          const result = await action.onClick?.({ backdrop, close });
          if (action.close !== false && result !== false) close();
        } catch (cause) {
          error.textContent = cause?.message || "This action could not be completed.";
          error.hidden = false;
          allButtons.forEach((item) => { item.disabled = false; });
          button.textContent = original;
        }
      });
    });

    setTimeout(() => backdrop.querySelector(".smart-popup-action.btn-primary")?.focus(), 0);
    return true;
  },

  close() {
    const current = this.current;
    this.current = null;
    current?.backdrop?.remove();
    const next = this.queue.shift();
    if (next) setTimeout(() => this.open(next), 80);
  },

  clear() {
    this.queue = [];
    this.close();
  }
};
