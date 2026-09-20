const warnedIcons = new Set();

const toPascalCase = (name) => String(name || "")
  .trim()
  .split(/[-_\s]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join("");

/**
 * Render a locally bundled Lucide icon for use inside trusted UI templates.
 * User-provided values are never interpolated into the generated SVG markup.
 */
export function icon(name, size = 20, options = {}) {
  const library = globalThis.lucide;
  const iconName = toPascalCase(name);
  const iconNode = library?.icons?.[iconName];

  if (!library?.createElement || !iconNode) {
    if (!warnedIcons.has(iconName)) {
      warnedIcons.add(iconName);
      console.warn(`Lucide icon unavailable: ${iconName || "unknown"}`);
    }
    return '<span class="tm-icon tm-icon--missing" aria-hidden="true"></span>';
  }

  const label = typeof options.label === "string" && options.label.trim()
    ? options.label.trim()
    : "";
  const className = ["tm-icon", options.className]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ");
  const attributes = {
    width: String(size),
    height: String(size),
    class: className,
    "stroke-width": String(options.strokeWidth || 2),
    focusable: "false"
  };

  if (label) {
    attributes.role = "img";
    attributes["aria-label"] = label;
  } else {
    attributes["aria-hidden"] = "true";
  }

  return library.createElement(iconNode, attributes).outerHTML;
}

export function iconLabel(name, label, size = 18, options = {}) {
  return `<span class="icon-label">${icon(name, size, options)}<span>${label}</span></span>`;
}

const STATUS_PRESENTATION = {
  pending: { icon: "clock-3", label: "Pending", className: "badge-warning" },
  approved: { icon: "circle-check", label: "Approved", className: "badge-success" },
  rejected: { icon: "circle-x", label: "Rejected", className: "badge-danger" },
  verified: { icon: "badge-check", label: "Verified", className: "badge-success" },
  unverified: { icon: "circle-help", label: "Unverified", className: "badge-neutral" }
};

export function statusBadge(status, options = {}) {
  const key = String(status || "unverified").toLowerCase();
  const presentation = STATUS_PRESENTATION[key] || {
    icon: "info",
    label: key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    className: "badge-info"
  };
  const className = ["badge", "status-badge", presentation.className, options.className]
    .filter(Boolean)
    .join(" ");
  return `<span class="${className}">${icon(presentation.icon, options.size || 15)}<span>${presentation.label}</span></span>`;
}
