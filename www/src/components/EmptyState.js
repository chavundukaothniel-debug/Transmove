// ==============================================================================
// TRANSMOVE EMPTY STATE COMPONENT
// Crisp, professional empty state indicators - Zero fake data
// ==============================================================================
import { icon as renderIcon } from "./Icon.js";

export function renderEmptyState({ title, description, actionText, actionLink, icon = "inbox" }) {
  const selectedIcon = renderIcon({ car: "car-front", chat: "message-circle" }[icon] || icon || "inbox", 32);

  return `
    <div class="empty-state">
      <div class="empty-icon">
        ${selectedIcon}
      </div>
      <h3 class="empty-title">${title}</h3>
      <p class="empty-desc">${description}</p>
      ${actionText && actionLink ? `
        <a href="${actionLink}" class="btn btn-primary btn-sm">
          ${actionText}
        </a>
      ` : ""}
    </div>
  `;
}
