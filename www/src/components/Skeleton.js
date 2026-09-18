// ==============================================================================
// TRANSMOVE REUSABLE SKELETON LOADING COMPONENTS
// Prevents UI flashing of "0", "undefined", or blank space while async Supabase data loads
// ==============================================================================

export function renderSkeletonKpiGrid(count = 4) {
  let cardsHtml = "";
  for (let i = 0; i < count; i++) {
    cardsHtml += `
      <div class="card" style="padding: 1rem;">
        <div class="skeleton skeleton-text" style="width: 50%;"></div>
        <div class="skeleton skeleton-title" style="width: 70%; height: 1.8rem; margin: 0.5rem 0;"></div>
        <div class="skeleton skeleton-text" style="width: 40%;"></div>
      </div>
    `;
  }
  return `<div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">${cardsHtml}</div>`;
}

export function renderSkeletonList(count = 3) {
  let listHtml = "";
  for (let i = 0; i < count; i++) {
    listHtml += `
      <div class="skeleton-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="skeleton skeleton-title" style="width: 45%;"></div>
          <div class="skeleton skeleton-text" style="width: 20%; height: 1.2rem;"></div>
        </div>
        <div class="skeleton skeleton-text" style="width: 80%; margin-top: 0.5rem;"></div>
      </div>
    `;
  }
  return listHtml;
}

export function renderSkeletonTable(rows = 4) {
  let rowsHtml = "";
  for (let i = 0; i < rows; i++) {
    rowsHtml += `
      <tr style="border-bottom: 1px solid var(--border-light);">
        <td style="padding: 0.85rem;"><div class="skeleton skeleton-text" style="width: 70%;"></div></td>
        <td style="padding: 0.85rem;"><div class="skeleton skeleton-text" style="width: 50%;"></div></td>
        <td style="padding: 0.85rem;"><div class="skeleton skeleton-text" style="width: 40%;"></div></td>
        <td style="padding: 0.85rem;"><div class="skeleton skeleton-text" style="width: 60%;"></div></td>
      </tr>
    `;
  }
  return `
    <div style="width: 100%; overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: var(--bg-hover); text-align: left; font-size: 0.8rem; color: var(--text-muted);">
            <th style="padding: 0.75rem;">ITEM</th>
            <th style="padding: 0.75rem;">DETAILS</th>
            <th style="padding: 0.75rem;">STATUS</th>
            <th style="padding: 0.75rem;">ACTION</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}
