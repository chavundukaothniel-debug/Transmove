// ==============================================================================
// TRANSMOVE DRIVER REQUEST FLOATING CARD & 10-SECOND COUNTDOWN
// Small floating smart card placed in TOP-RIGHT on desktop (below nav/account)
// Full mobile-responsive adaptation (<= 768px: full width with margins)
// Visible 10s countdown with color transitions (10-6s green, 5-3s amber, 2-1s rose)
// Timer persistence across polling ticks (never restarts at 10s for same job)
// Multiple request queue ("New requests (N)")
// Stops immediately on "Make offer"; 0s timeout affects only current driver
// ==============================================================================

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

const COUNTDOWN_DURATION_MS = 10000;

export const DriverRequestCard = {
  queue: [],
  active: null,
  // Map of requestId -> firstDisplayedAt timestamp for persistence across polling
  timers: new Map(),
  // Set of dismissed job IDs for current session
  locallyDismissed: new Set(),
  // Flag if quotation or sheet is currently active
  isComposing: false,

  getRemainingMs(jobId) {
    const firstDisplayedAt = this.timers.get(jobId);
    if (!firstDisplayedAt) return COUNTDOWN_DURATION_MS;
    const elapsed = Date.now() - firstDisplayedAt;
    return Math.max(0, COUNTDOWN_DURATION_MS - elapsed);
  },

  show(job, options = {}) {
    if (!job) return;
    const jobId = job.id || job.$id;
    if (!jobId) return;

    // If driver already dismissed or made offer on this job locally, skip
    if (this.locallyDismissed.has(jobId)) return;

    // Check if job expired on existing timer
    if (this.timers.has(jobId) && this.getRemainingMs(jobId) <= 0) {
      this.locallyDismissed.add(jobId);
      return;
    }

    // Check if this job is already the active card
    if (this.active && (this.active.job.id || this.active.job.$id) === jobId) {
      this._updateQueueBadge();
      return;
    }

    // Check if already in queue
    const inQueue = this.queue.some(item => (item.job.id || item.job.$id) === jobId);
    if (inQueue) {
      this._updateQueueBadge();
      return;
    }

    // If currently displaying a card or composing an offer, push to queue
    if (this.active || this.isComposing) {
      this.queue.push({ job, options });
      this._updateQueueBadge();
      return;
    }

    this._renderCard(job, options);
  },

  _renderCard(job, options) {
    const jobId = job.id || job.$id;
    
    // Register or retrieve firstDisplayedAt for timer persistence
    if (!this.timers.has(jobId)) {
      this.timers.set(jobId, Date.now());
    }

    const remainingMs = this.getRemainingMs(jobId);
    if (remainingMs <= 0) {
      this.locallyDismissed.add(jobId);
      this._showNextInQueue();
      return;
    }

    // Remove existing card if any
    this._removeCardElement();

    const pickup = escapeHtml(job.pickup_address || job.pickup_location || "Pickup");
    const destination = escapeHtml(job.destination_address || job.destination || "Destination");
    const rawType = (job.service_type || job.request_type || "ride").toLowerCase();
    const serviceLabel = rawType === "logistics" ? "Goods Delivery" : rawType === "hire" ? "Vehicle Hire" : "Ride";
    const budget = Number(job.suggested_price || job.budget || 0);

    const cardEl = document.createElement("div");
    cardEl.id = "driver-floating-request-card";
    cardEl.className = "driver-request-floating-card";
    cardEl.setAttribute("role", "alert");
    cardEl.setAttribute("aria-live", "assertive");

    const totalInBatch = this.queue.length + 1;
    const headerTitle = totalInBatch > 1 ? `New requests (${totalInBatch})` : `New request`;

    cardEl.innerHTML = `
      <div class="driver-request-card-inner">
        <div class="driver-request-card-header">
          <div class="driver-request-header-title-wrap">
            <span class="driver-request-pulse-dot"></span>
            <span class="driver-request-title" id="driver-request-header-title">${headerTitle}</span>
            <span class="driver-request-badge">${serviceLabel}</span>
          </div>
          <div class="driver-request-countdown" id="driver-request-countdown-text">10s</div>
        </div>

        <div class="driver-request-timer-bar-bg">
          <div class="driver-request-timer-bar" id="driver-request-timer-bar"></div>
        </div>

        <div class="driver-request-card-body">
          <div class="driver-request-route">
            <div class="driver-request-stop">
              <span class="driver-request-dot driver-request-dot--pickup"></span>
              <span class="driver-request-location" title="${pickup}">${pickup}</span>
            </div>
            <div class="driver-request-arrow">↓</div>
            <div class="driver-request-stop">
              <span class="driver-request-dot driver-request-dot--dest"></span>
              <span class="driver-request-location" title="${destination}">${destination}</span>
            </div>
          </div>

          ${budget > 0 ? `
            <div class="driver-request-budget-row">
              <span class="driver-request-budget-label">Passenger budget:</span>
              <strong class="driver-request-budget-val">$${budget.toFixed(2)}</strong>
            </div>
          ` : `
            <div class="driver-request-budget-row">
              <span class="driver-request-budget-label">Budget:</span>
              <span class="driver-request-budget-muted">Open for offers</span>
            </div>
          `}
        </div>

        <div class="driver-request-card-actions">
          <button type="button" class="btn btn-sm btn-outline driver-btn-not-interested" id="driver-btn-not-interested">
            Not interested
          </button>
          <button type="button" class="btn btn-sm btn-primary driver-btn-make-offer" id="driver-btn-make-offer">
            Make offer
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(cardEl);

    // Save active state
    this.active = {
      job,
      options,
      element: cardEl,
      timerId: null
    };

    // Attach click listeners
    const notInterestedBtn = cardEl.querySelector("#driver-btn-not-interested");
    const makeOfferBtn = cardEl.querySelector("#driver-btn-make-offer");

    notInterestedBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleNotInterested();
    });

    makeOfferBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleMakeOffer();
    });

    // Start 10s countdown animation
    this._startCountdown(jobId);
  },

  _startCountdown(jobId) {
    if (!this.active) return;
    const countdownText = document.getElementById("driver-request-countdown-text");
    const progressBar = document.getElementById("driver-request-timer-bar");

    const updateTimer = () => {
      if (!this.active || (this.active.job.id || this.active.job.$id) !== jobId) {
        return;
      }

      const remainingMs = this.getRemainingMs(jobId);
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      const percentage = Math.max(0, Math.min(100, (remainingMs / COUNTDOWN_DURATION_MS) * 100));

      if (countdownText) {
        countdownText.textContent = `${remainingSec}s`;
      }

      if (progressBar) {
        progressBar.style.width = `${percentage}%`;

        // Color transitions:
        // 10-6s: TransMove blue, 5-3s amber, 2-1s red
        // 5-3s: slightly warmer indicator (#f59e0b warm amber)
        // 2-1s: subtle warning accent (#ef4444 rose, no flashing)
        if (remainingSec >= 6) {
          progressBar.style.backgroundColor = "#2495ff";
          if (countdownText) countdownText.style.color = "#2495ff";
        } else if (remainingSec >= 3) {
          progressBar.style.backgroundColor = "#f59e0b";
          if (countdownText) countdownText.style.color = "#d97706";
        } else {
          progressBar.style.backgroundColor = "#ef4444";
          if (countdownText) countdownText.style.color = "#dc2626";
        }
      }

      if (remainingMs <= 0) {
        this.handleTimeout();
      }
    };

    // Initial update immediately
    updateTimer();

    // Smooth 50ms interval for fluid progress bar shrinking
    this.active.timerId = setInterval(updateTimer, 50);
  },

  handleMakeOffer() {
    if (!this.active) return;
    const { job, options } = this.active;
    const jobId = job.id || job.$id;

    // STOP timer immediately
    this._stopActiveTimer();
    this._removeCardElement();
    this.active = null;
    this.isComposing = true;

    // Invoke driver's quotation callback
    if (typeof options.onMakeOffer === "function") {
      options.onMakeOffer(job);
    }
  },

  handleNotInterested() {
    if (!this.active) return;
    const { job, options } = this.active;
    const jobId = job.id || job.$id;

    this.locallyDismissed.add(jobId);
    this._stopActiveTimer();
    this._removeCardElement();
    this.active = null;

    if (typeof options.onDismiss === "function") {
      options.onDismiss(job);
    }

    this._showNextInQueue();
  },

  handleTimeout() {
    if (!this.active) return;
    const { job, options } = this.active;
    const jobId = job.id || job.$id;

    // Timeout dismisses ONLY locally for this driver!
    // The request stays open_for_bids globally.
    // Does NOT consume driver's free job.
    this.locallyDismissed.add(jobId);
    this._stopActiveTimer();
    this._removeCardElement();
    this.active = null;

    if (typeof options.onTimeout === "function") {
      options.onTimeout(job);
    }

    this._showNextInQueue();
  },

  _showNextInQueue() {
    // If quotation modal is open, wait until closed
    if (this.isComposing) return;

    while (this.queue.length > 0) {
      const next = this.queue.shift();
      const nextId = next.job.id || next.job.$id;
      if (!this.locallyDismissed.has(nextId) && this.getRemainingMs(nextId) > 0) {
        this._renderCard(next.job, next.options);
        return;
      }
    }
    this._removeCardElement();
  },

  _updateQueueBadge() {
    if (!this.active) return;
    const titleEl = document.getElementById("driver-request-header-title");
    if (titleEl) {
      const totalInBatch = this.queue.length + 1;
      titleEl.textContent = totalInBatch > 1 ? `New requests (${totalInBatch})` : `New request`;
    }
  },

  _stopActiveTimer() {
    if (this.active?.timerId) {
      clearInterval(this.active.timerId);
      this.active.timerId = null;
    }
  },

  _removeCardElement() {
    const el = document.getElementById("driver-floating-request-card");
    if (el) {
      el.remove();
    }
  },

  onQuotationClosed() {
    this.isComposing = false;
    this._showNextInQueue();
  },

  clear() {
    this._stopActiveTimer();
    this._removeCardElement();
    this.active = null;
    this.queue = [];
    this.isComposing = false;
  }
};
