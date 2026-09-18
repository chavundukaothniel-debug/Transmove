// ==============================================================================
// TRANSMOVE MODAL SYSTEM
// ==============================================================================

export const Modal = {
  open(title, contentHtml) {
    this.close(); // Close any existing modal

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "app-modal-backdrop";

    backdrop.innerHTML = `
      <div class="modal-card">
        <div class="card-header" style="margin-bottom: 1rem;">
          <h3 class="card-title">${title}</h3>
          <button id="modal-close-btn" class="btn btn-outline btn-sm" style="padding: 0.2rem 0.5rem;">✕</button>
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
