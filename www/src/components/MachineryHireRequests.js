import { MachineryService } from "../services/machinery.js";
import { NotificationService } from "../services/notifications.js";

const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const states = {
  pending: ["Awaiting owner", "badge-warning", "The owner is reviewing your request."],
  accepted: ["Confirmed", "badge-success", "The owner accepted your request. Contact them to arrange delivery or collection."],
  active: ["Hire in progress", "badge-success", "Your machinery hire is underway."],
  completed: ["Completed", "badge-neutral", "This hire is complete."],
  declined: ["Declined", "badge-danger", "The owner declined this request."],
  cancelled: ["Cancelled", "badge-neutral", "This request was cancelled."]
};
const dateLabel = value => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Not specified";
};

export function renderMachineryHireRequests(hires, filter = "all") {
  const visible = hires.filter(h => filter === "rentals" ? ["accepted", "active"].includes(h.status) : filter === "history" ? ["completed", "declined", "cancelled"].includes(h.status) : true);
  return `<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem"><h2 style="font-size:1.15rem">${filter === "rentals" ? "My machinery rentals" : filter === "history" ? "Machinery hire history" : "My machinery requests"}</h2><button type="button" class="btn btn-outline btn-sm" data-refresh-hires>Refresh</button></div><div data-hire-notice role="status" aria-live="polite"></div>` + (visible.length ? visible.map(h => {
    const [label, badge, message] = states[h.status] || [h.status, "badge-neutral", ""];
    const confirmed = ["accepted", "active", "completed"].includes(h.status);
    const phone = confirmed ? String(h.owner_phone || "").replace(/[^+0-9]/g, "") : "";
    return `<article style="padding:1rem;border:1px solid var(--border-light);border-radius:10px;margin-top:.75rem;overflow-wrap:anywhere" data-hire-status="${escape(h.status)}"><div style="display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap"><strong>${escape(h.machinery_name || h.machinery?.name || "Machinery hire")}</strong><span class="badge ${badge}">${escape(label)}</span></div><p style="margin:.5rem 0;color:var(--text-muted)">${escape(message)}</p><div style="display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;font-size:.9rem"><span>${escape(dateLabel(h.start_date))} – ${escape(dateLabel(h.end_date))}</span><strong>Agreed total: $${Number(h.calculated_total || 0).toFixed(2)} ${escape(h.currency || "USD")}</strong><span>${h.with_operator ? "Operator included" : "Machinery only"}</span></div>${h.job_location ? `<p style="margin-top:.5rem">Location: ${escape(h.job_location)}</p>` : ""}${confirmed ? `<p style="margin-top:.75rem"><strong>Owner:</strong> ${escape(h.owner_name || "Machinery owner")} ${phone ? `<a class="btn btn-outline btn-sm" href="tel:${escape(phone)}" style="margin-left:.5rem">Call ${escape(h.owner_phone)}</a>` : "<span> · Contact details are currently unavailable.</span>"}</p>` : ""}${h.status === "declined" && h.decline_reason ? `<p style="margin-top:.5rem">Reason: ${escape(h.decline_reason)}</p>` : ""}${["pending", "accepted"].includes(h.status) ? `<button type="button" class="btn btn-outline btn-sm" data-cancel-hire="${escape(h.id)}" style="margin-top:.75rem">Cancel request</button>` : ""}</article>`;
  }).join("") : '<p style="color:var(--text-muted)">No machinery requests in this section yet. <a href="#machinery">Browse machinery</a></p>');
}

export function createMachineryHireRequests(panel, { alwaysVisible = false, filter = "all" } = {}) {
  let stopped = false, busy = false, timer = null, signature = null, previous = new Map();
  async function refresh(force = false) {
    if (stopped || busy || !panel.isConnected) return;
    busy = true;
    try {
      const hires = await MachineryService.getRenterHires();
      if (stopped || !panel.isConnected) return;
      const nextSignature = JSON.stringify(hires);
      if (force || nextSignature !== signature) {
        const accepted = hires.filter(h => h.status === "accepted" && previous.has(h.id) && previous.get(h.id) !== "accepted");
        panel.hidden = !alwaysVisible && !hires.length;
        panel.innerHTML = renderMachineryHireRequests(hires, filter);
        for (const hire of accepted) NotificationService.showToast("Machinery request accepted", `${hire.machinery_name || hire.machinery?.name || "Your machinery"} hire is confirmed. See your machinery requests for details.`, "success");
        previous = new Map(hires.map(h => [h.id, h.status]));
        signature = nextSignature;
      }
      const notice = panel.querySelector("[data-hire-notice]");
      if (notice) notice.textContent = "";
    } catch (error) {
      if (stopped || !panel.isConnected) return;
      panel.hidden = false;
      if (signature === null) panel.innerHTML = renderMachineryHireRequests([], filter);
      const notice = panel.querySelector("[data-hire-notice]");
      if (notice) notice.textContent = `Could not refresh your machinery requests: ${error.message}. Use Refresh to try again.`;
    } finally { busy = false; }
  }
  const onClick = async event => {
    const button = event.target.closest("[data-cancel-hire], [data-refresh-hires]");
    if (!button || !panel.contains(button) || busy) return;
    if (button.hasAttribute("data-refresh-hires")) { await refresh(true); return; }
    if (!confirm("Cancel this machinery request?")) return;
    busy = true;
    button.disabled = true;
    try {
      await MachineryService.updateHireStatus(button.dataset.cancelHire, "cancelled", "Cancelled by renter");
    } catch (error) {
      if (!stopped) NotificationService.showToast("Could not cancel request", error.message, "error");
    } finally { busy = false; button.disabled = false; }
    await refresh(true);
  };
  const onFocus = () => { if (!document.hidden) return refresh(); };
  return {
    refresh,
    async start() {
      panel.addEventListener("click", onClick);
      window.addEventListener("focus", onFocus);
      window.addEventListener("online", onFocus);
      document.addEventListener("visibilitychange", onFocus);
      timer = window.setInterval(onFocus, 10000);
      await refresh();
    },
    destroy() {
      stopped = true;
      window.clearInterval(timer);
      panel.removeEventListener("click", onClick);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    }
  };
}
