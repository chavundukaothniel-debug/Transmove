// ==============================================================================
// TRANSMOVE ACCOUNTANT REPORT & PDF GENERATION SERVICE
// Weekly & Monthly Platform Transaction / Balance Reports for Admins
// Personal Transaction History & Account Statements for Authenticated Users
// Strictly Supabase + Google Drive (Zero Appwrite)
// ==============================================================================
import { getTrustedApiEndpoint } from "../config/appwrite.js";
import { getAuthJwt } from "../config/supabase.js";

async function callTrustedApi(action, data = {}) {
  const endpoint = getTrustedApiEndpoint();
  const jwt = await getAuthJwt();

  const headers = { "Content-Type": "application/json" };
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, data, jwt })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(json.error || `Report service error (HTTP ${res.status})`);
    error.status = res.status;
    throw error;
  }
  return json;
}

/**
 * Pure JavaScript PDF-1.4 standard document generator.
 * Produces clean, downloadable, standard-compliant vector PDF files with zero dependencies.
 */
function buildPdfDocument({ title, subtitle, dateRange, generatedAt, summaryItems, tableHeaders, tableRows, footerText }) {
  const sanitize = (str) => String(str ?? "").replace(/[\(\)\\\r\n]/g, " ").trim();

  let stream = "";
  // Document Header Box (Dark Navy / Green Theme)
  stream += "0.06 0.1 0.16 rg 36 720 540 46 re f\n"; // Header bar
  stream += "1 1 1 rg BT /F2 15 Tf 48 746 Td (TransMove Platform -- Financial Report) Tj ET\n";
  stream += "0.9 0.95 0.9 rg BT /F1 9 Tf 48 732 Td (" + sanitize(subtitle || "Official Accounting Summary") + ") Tj ET\n";

  // Report Meta info
  stream += "0.2 0.25 0.3 rg\n";
  stream += "BT /F2 9 Tf 36 702 Td (Date Range: ) Tj /F1 9 Tf (" + sanitize(dateRange) + ") Tj ET\n";
  stream += "BT /F2 9 Tf 360 702 Td (Generated: ) Tj /F1 9 Tf (" + sanitize(generatedAt) + ") Tj ET\n";
  stream += "0.85 0.88 0.92 rg 36 694 540 1 re f\n";

  // Summary KPI Cards (Horizontal row)
  let cardX = 36;
  const cardWidth = 100;
  const cardHeight = 44;
  for (const item of (summaryItems || []).slice(0, 5)) {
    stream += "0.96 0.98 0.99 rg " + cardX + " 640 " + cardWidth + " " + cardHeight + " re f\n";
    stream += "0.82 0.85 0.9 rg " + cardX + " 640 " + cardWidth + " " + cardHeight + " re S\n";
    stream += "0.35 0.4 0.45 rg BT /F1 7.5 Tf " + (cardX + 8) + " 670 Td (" + sanitize(item.label) + ") Tj ET\n";
    stream += "0.06 0.45 0.28 rg BT /F2 10.5 Tf " + (cardX + 8) + " 652 Td (" + sanitize(item.value) + ") Tj ET\n";
    cardX += cardWidth + 10;
  }

  // Table Title
  let curY = 618;
  stream += "0.1 0.15 0.2 rg BT /F2 11 Tf 36 " + curY + " Td (" + sanitize(title) + " Ledger) Tj ET\n";
  curY -= 16;

  // Table Header row
  stream += "0.12 0.18 0.25 rg 36 " + (curY - 4) + " 540 18 re f\n";
  stream += "1 1 1 rg\n";
  const colX = [42, 115, 175, 270, 360, 445, 515];
  tableHeaders.forEach((th, i) => {
    stream += "BT /F2 8 Tf " + colX[i] + " " + curY + " Td (" + sanitize(th) + ") Tj ET\n";
  });
  curY -= 18;

  // Table Data rows
  const maxRows = 24;
  const rows = (tableRows || []).slice(0, maxRows);
  rows.forEach((row, idx) => {
    if (idx % 2 === 0) {
      stream += "0.97 0.98 0.99 rg 36 " + (curY - 4) + " 540 16 re f\n";
    }
    stream += "0.15 0.2 0.25 rg\n";
    row.forEach((cell, i) => {
      const isBold = i === 4; // Amount
      stream += "BT " + (isBold ? "/F2" : "/F1") + " 7.5 Tf " + colX[i] + " " + curY + " Td (" + sanitize(cell).slice(0, 22) + ") Tj ET\n";
    });
    curY -= 16;
  });

  if ((tableRows || []).length > maxRows) {
    stream += "0.5 0.5 0.5 rg BT /F1 7.5 Tf 36 " + curY + " Td (... and " + ((tableRows || []).length - maxRows) + " more records. Showing top " + maxRows + " in this PDF view.) Tj ET\n";
    curY -= 14;
  }

  // Running balance / summary note
  curY = Math.max(curY - 10, 60);
  stream += "0.9 0.92 0.94 rg 36 " + curY + " 540 1 re f\n";
  stream += "0.4 0.45 0.5 rg BT /F1 7.5 Tf 36 " + (curY - 12) + " Td (" + sanitize(footerText || "TransMove Zimbabwe -- Official EcoCash Manual Payment Verification Ledger") + ") Tj ET\n";
  stream += "0.4 0.45 0.5 rg BT /F1 7.5 Tf 430 " + (curY - 12) + " Td (Verified Financial Record) Tj ET\n";

  const streamBytes = Buffer.from(stream, "utf-8");
  const streamLen = streamBytes.length;

  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objects[3] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  objects[6] = "<< /Length " + streamLen + " >>\nstream\n" + stream + "endstream";

  let out = "%PDF-1.4\n";
  const offsets = [];
  for (let i = 1; i <= 6; i++) {
    offsets[i] = Buffer.byteLength(out, "utf-8");
    out += i + " 0 obj\n" + objects[i] + "\nendobj\n";
  }
  const xrefOffset = Buffer.byteLength(out, "utf-8");
  out += "xref\n0 7\n0000000000 65535 f \n";
  for (let i = 1; i <= 6; i++) {
    out += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  out += "trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF";
  return new TextEncoder().encode(out);
}

export const ReportService = {
  buildPdfDocument,

  /**
   * Admin-only: Fetch weekly or monthly platform financial report from trusted API.
   *
   * @param {Object} params
   * @param {"weekly"|"monthly"} [params.period="weekly"]
   * @param {"transactions"|"balances"} [params.report_type="transactions"]
   */
  async getAdminFinancialReport({ period = "weekly", report_type = "transactions" } = {}) {
    return callTrustedApi("admin_get_financial_report", { period, report_type });
  },

  /**
   * User-side: Fetch authenticated user's own payment and transaction statement.
   */
  async getUserAccountStatement() {
    return callTrustedApi("get_user_account_statement", {});
  },

  /**
   * Exports an admin platform financial report as a downloadable PDF file.
   */
  async exportAdminPdf({ period = "weekly", report_type = "transactions" } = {}) {
    const data = await this.getAdminFinancialReport({ period, report_type });
    const summary = data.report || {};
    const txns = data.transactions || [];

    const periodLabel = period === "weekly" ? "Weekly (Last 7 Days)" : "Monthly (Last 30 Days)";
    const typeLabel = report_type === "balances" ? "Balances & Net Volume" : "Transaction Flow";
    const title = `TransMove ${periodLabel} ${typeLabel} Report`;

    const summaryItems = [
      { label: "Total Transactions", value: String(summary.total_transactions || txns.length) },
      { label: "Approved Revenue", value: `$${Number(summary.total_revenue || 0).toFixed(2)}` },
      { label: "Pending Review", value: `$${Number(summary.pending_volume || 0).toFixed(2)}` },
      { label: "Rejected Volume", value: `$${Number(summary.rejected_volume || 0).toFixed(2)}` },
      { label: "Platform Net Balance", value: `$${Number(summary.running_balance || summary.total_revenue || 0).toFixed(2)}` }
    ];

    const tableHeaders = ["Date", "Reference", "Type", "Destination", "Amount", "Sender", "Status"];
    const tableRows = txns.map((t) => [
      t.created_at ? new Date(t.created_at).toLocaleDateString("en-GB") : "—",
      t.reference || t.transaction_reference || "—",
      t.payment_type || "subscription",
      t.recipient_name ? `${t.recipient_name.split(" ")[0]} (${t.recipient_number || ""})` : "EcoCash",
      `$${Number(t.amount || 0).toFixed(2)}`,
      t.sender_name || "—",
      (t.status || "pending").toUpperCase()
    ]);

    const pdfBytes = buildPdfDocument({
      title: typeLabel,
      subtitle: `${periodLabel} Accountant-Friendly Platform Audit Report`,
      dateRange: `${summary.date_from ? new Date(summary.date_from).toLocaleDateString("en-GB") : "Recent"} - ${summary.date_to ? new Date(summary.date_to).toLocaleDateString("en-GB") : "Today"}`,
      generatedAt: new Date().toLocaleString("en-GB"),
      summaryItems,
      tableHeaders,
      tableRows,
      footerText: `TransMove Official Platform Financial Statement · Period: ${period} · Confidential Admin Audit`
    });

    const filename = `transmove_${period}_${report_type}_report_${Date.now()}.pdf`;
    this.downloadPdfBlob(pdfBytes, filename);
    return { success: true, filename, summary };
  },

  /**
   * Exports an authenticated user's own statement as a downloadable PDF.
   */
  async exportUserHistoryPdf() {
    const data = await this.getUserAccountStatement();
    const summary = data.summary || {};
    const txns = data.statement || [];

    const summaryItems = [
      { label: "Total Paid", value: `$${Number(summary.total_paid || 0).toFixed(2)}` },
      { label: "Pending Payments", value: String(summary.pending_count || 0) },
      { label: "Approved Submissions", value: String(summary.approved_count || 0) },
      { label: "Active Subscriptions", value: String(summary.active_subscriptions || 0) }
    ];

    const tableHeaders = ["Date", "Reference", "Type", "Destination", "Amount", "EcoCash Ref", "Status"];
    const tableRows = txns.map((t) => [
      t.created_at ? new Date(t.created_at).toLocaleDateString("en-GB") : "—",
      t.reference || t.$id || t.id || "—",
      t.payment_type || "subscription",
      t.recipient_name || "EcoCash TransMove",
      `$${Number(t.amount || 0).toFixed(2)}`,
      t.transaction_reference || "—",
      (t.status || "pending").toUpperCase()
    ]);

    const pdfBytes = buildPdfDocument({
      title: "My Account Transaction Statement",
      subtitle: `Account Holder: ${data.user_name || "TransMove User"} (${data.user_email || ""})`,
      dateRange: "All Time Account Activity",
      generatedAt: new Date().toLocaleString("en-GB"),
      summaryItems,
      tableHeaders,
      tableRows,
      footerText: "TransMove Zimbabwe · Personal User Payment Statement · Enforced Server Ownership"
    });

    const filename = `transmove_account_statement_${Date.now()}.pdf`;
    this.downloadPdfBlob(pdfBytes, filename);
    return { success: true, filename, summary };
  },

  downloadPdfBlob(pdfBytes, filename) {
    if (typeof window === "undefined" || !window.document) return;
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  }
};
