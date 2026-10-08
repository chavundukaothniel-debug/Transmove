const escape = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const colors = ["#10b981", "#f59e0b", "#ef4444", "#6366f1", "#06b6d4"];
export function summarizePayments(payments, now = new Date()) {
  const months = Array.from({length: 6}, (_, i) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
    return {key: date.toISOString().slice(0, 7), label: date.toLocaleDateString("en", {month:"short",year:"2-digit", timeZone:"UTC"})};
  });
  const currencies = {};
  const statuses = {};
  for (const p of payments) {
    statuses[p.status || "unknown"] = (statuses[p.status || "unknown"] || 0) + 1;
    const currency = p.currency || "USD";
    const group = currencies[currency] ||= {approved: 0, pending: 0, monthly: months.map(m => ({...m, value: 0}))};
    const amount = Number(p.amount ?? p.amount_expected ?? p.amount_declared ?? 0);
    if (!Number.isFinite(amount) || amount < 0) continue;
    if (p.status === "approved") {
      group.approved += amount;
      // Submission month: approval timestamps are not available for all records.
      const month = group.monthly.find(m => m.key === String(p.created_at || p.submitted_at || "").slice(0, 7));
      if (month) month.value += amount;
    }
    if (p.status === "pending_review") group.pending += amount;
  }
  return {currencies, statuses, count: payments.length};
}
function bars(title, rows, format = value => String(value)) {
  const max = Math.max(1, ...rows.map(row => row.value));
  return '<section class="card" style="padding:1.25rem;min-width:0"><h3 style="margin-bottom:1rem">' + escape(title) + '</h3>' + rows.map((row, i) => '<div style="margin-bottom:.8rem"><div style="display:flex;justify-content:space-between;gap:1rem;font-size:.85rem;margin-bottom:.3rem"><span>' + escape(row.label) + '</span><strong>' + escape(format(row.value)) + '</strong></div><div style="height:12px;background:var(--bg-hover);border-radius:6px;overflow:hidden"><div style="height:100%;border-radius:6px;width:' + (row.value / max * 100) + '%;background:' + colors[i % colors.length] + '"></div></div></div>').join('') + '</section>';
}
function monthlyChart(currency, rows) {
  const max = Math.max(1, ...rows.map(row => row.value));
  const columns = rows.map((row, i) => {
    const x = 40 + i * 94;
    const height = row.value / max * 140;
    return '<g><title>' + escape(row.label + ': ' + row.value.toFixed(2) + ' ' + currency) + '</title><rect x="' + x + '" y="' + (175-height) + '" width="48" height="' + height + '" rx="5" fill="#10b981"/><text x="' + (x+24) + '" y="' + (165-height) + '" text-anchor="middle" fill="currentColor" font-size="15">' + row.value.toFixed(2) + '</text><text x="' + (x+24) + '" y="200" text-anchor="middle" fill="currentColor" font-size="15">' + escape(row.label) + '</text></g>';
  }).join('');
  return '<section class="card" style="padding:1.25rem;min-width:0"><h3>Approved payments by submission month · ' + escape(currency) + '</h3><svg viewBox="0 0 640 215" role="img" aria-label="Approved payments for the last six months in ' + escape(currency) + '" style="width:100%;height:auto;color:var(--text-main);margin-top:1rem"><line x1="20" y1="175" x2="620" y2="175" stroke="currentColor" opacity=".2"/>' + columns + '</svg></section>';
}
export function renderPaymentCharts(payments) {
  const {currencies, statuses, count} = summarizePayments(payments);
  if (!count) return '<div class="card" style="padding:1.5rem;color:var(--text-muted)">No payment records yet. Charts will appear when payments are submitted.</div>';
  let html = bars("Payment status · " + count + " submissions", Object.entries(statuses).map(([label,value]) => ({label:label.replaceAll("_", " "),value})));
  for (const [currency, data] of Object.entries(currencies)) {
    html += '<section class="card" style="padding:1.25rem"><h3>' + escape(currency) + ' payment overview</h3><p style="color:var(--text-muted);margin-top:.5rem">Approved payments</p><strong style="font-size:2rem;color:#10b981">' + data.approved.toFixed(2) + '</strong><p style="margin-top:.7rem;color:var(--text-muted)">Awaiting review: <strong>' + data.pending.toFixed(2) + ' ' + escape(currency) + '</strong></p></section>';
    html += monthlyChart(currency, data.monthly);
  }
  return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:1rem;margin-bottom:1.5rem">' + html + '</div><p style="font-size:.8rem;color:var(--text-muted);margin-bottom:1rem">Payment charts cover all loaded records, independently of the queue filter. Monthly totals use submission dates (UTC); only approved payments count as revenue.</p>';
}
export function renderBookingChart(analytics) {
  return bars("Booking outcomes", [{label:"Completed",value:Number(analytics.completedBookings || 0)},{label:"Cancelled",value:Number(analytics.cancelledBookings || 0)}]);
}
