// ==============================================================================
// TRANSMOVE MODAL SYSTEM
// ==============================================================================
import { icon } from "./Icon.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

export const Modal = {
  open(title, contentHtml) {
    if (title && typeof title === "object") {
      contentHtml = title.content || "";
      title = title.title || "";
    }
    this.close(); // Close any existing modal

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "app-modal-backdrop";

    backdrop.innerHTML = `
      <div class="modal-card">
        <div class="card-header" style="margin-bottom: 1rem;">
          <h3 class="card-title">${escapeHtml(title)}</h3>
          <button type="button" id="modal-close-btn" class="btn btn-outline btn-sm icon-button" aria-label="Close dialog" title="Close dialog">${icon("x", 19)}</button>
        </div>
        <div class="modal-body">
          ${contentHtml}
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    document.getElementById("modal-close-btn")?.addEventListener("click", () => this.close());
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) this.close();
    });
  },

  close() {
    const existing = document.getElementById("app-modal-backdrop");
    if (existing) {
      existing.remove();
    }
  }
};
