// ==============================================================================
// TRANSMOVE BOOKING RECEIPT SERVICE
// ==============================================================================
import { getTrustedApiEndpoint, getAppwriteAccount } from "../config/appwrite.js";

async function callTrustedApi(action, data = {}) {
  const endpoint = getTrustedApiEndpoint();
  const account = getAppwriteAccount();
  const jwtRes = await account.createJWT();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwtRes.jwt}`,
      "X-Appwrite-JWT": jwtRes.jwt
    },
    body: JSON.stringify({ action, data })
  });

  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || "Receipt operation failed.");
    err.status = res.status;
    throw err;
  }
  return json;
}

export const ReceiptService = {
  /**
   * Fetches official booking receipt from trusted server.
   */
  async getReceipt(bookingId) {
    if (!bookingId) throw new Error("bookingId is required.");
    return callTrustedApi("get_booking_receipt", { booking_id: bookingId });
  },

  /**
   * Generates a printable HTML receipt string.
   */
  renderReceiptHtml(receipt) {
    const isPaid = Boolean(receipt.paid);
    const dateFormatted = receipt.date ? new Date(receipt.date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";

    return `
      <div class="transmove-receipt" id="transmove-printable-receipt" style="font-family: 'Inter', system-ui, sans-serif; background: #ffffff; color: #0f172a; padding: 2.5rem; max-width: 580px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
          <div>
            <h1 style="margin: 0; font-size: 1.6rem; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">Trans<span style="color: #059669;">Move</span></h1>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.2rem;">Official Booking Receipt &amp; Summary</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.85rem; font-weight: 800; color: #0f172a;">${receipt.receipt_id}</div>
            <div style="font-size: 0.75rem; color: #64748b;">${dateFormatted}</div>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem 1.25rem; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 0.35rem;">Route &amp; Service</div>
          <div style="font-weight: 800; font-size: 1rem; color: #0f172a; margin-bottom: 0.25rem;">${receipt.pickup} → ${receipt.destination}</div>
          <div style="font-size: 0.85rem; color: #059669; font-weight: 600; text-transform: capitalize;">${receipt.service_type} Transport</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; font-size: 0.85rem;">
          <div>
            <span style="color: #64748b; display: block; font-size: 0.75rem;">Passenger</span>
            <strong style="color: #0f172a;">${receipt.passenger_name}</strong>
          </div>
          <div>
            <span style="color: #64748b; display: block; font-size: 0.75rem;">Assigned Provider</span>
            <strong style="color: #0f172a;">${receipt.driver_name}</strong>
          </div>
          <div>
            <span style="color: #64748b; display: block; font-size: 0.75rem;">Vehicle</span>
            <strong style="color: #0f172a;">${receipt.vehicle}</strong>
          </div>
          <div>
            <span style="color: #64748b; display: block; font-size: 0.75rem;">Trip Status</span>
            <strong style="color: #0f172a; text-transform: uppercase;">${receipt.booking_status}</strong>
          </div>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 1rem; margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="color: #64748b; font-size: 0.9rem;">Accepted Quotation</span>
            <strong style="color: #0f172a; font-size: 1.15rem;">$${receipt.amount} ${receipt.currency}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #64748b; font-size: 0.85rem;">Payment Ledger Status</span>
            <span style="font-weight: 800; font-size: 0.8rem; padding: 0.2rem 0.6rem; border-radius: 9999px; ${isPaid ? 'background: #dcfce7; color: #15803d;' : 'background: #fef3c7; color: #92400e;'}">
              ${receipt.payment_status}
            </span>
          </div>
        </div>

        <div style="border-top: 1px dashed #cbd5e1; padding-top: 1rem; text-align: center; font-size: 0.75rem; color: #94a3b8;">
          Thank you for choosing TransMove · Fair Transportation Marketplace<br/>
          Zimbabwe Official Electronic Receipt
        </div>
      </div>
    `;
  },

  /**
   * Opens the printable receipt in a clean print window.
   */
  async printReceipt(bookingId) {
    const receipt = await this.getReceipt(bookingId);
    const receiptHtml = this.renderReceiptHtml(receipt);
    const win = window.open("", "_blank", "width=680,height=750");
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt ${receipt.receipt_id}</title>
          <style>body { margin: 2rem; background: #f8fafc; }</style>
        </head>
        <body>
          ${receiptHtml}
          <script>window.onload = function() { window.print(); };</script>
        </body>
        </html>
      `);
      win.document.close();
    }
  },

  /**
   * Renders an official printable receipt for an EcoCash payment record.
   */
  renderPaymentReceiptHtml(payment) {
    const isApproved = payment.status === "approved";
    const isRejected = payment.status === "rejected";
    const isPending = !isApproved && !isRejected;

    const statusBadgeStyle = isApproved
      ? "background: #dcfce7; color: #15803d; border: 1px solid #86efac;"
      : isRejected
      ? "background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5;"
      : "background: #fef3c7; color: #92400e; border: 1px solid #fde68a;";

    const statusLabel = isApproved
      ? "APPROVED & VERIFIED"
      : isRejected
      ? "PAYMENT REJECTED"
      : "PENDING ADMIN VERIFICATION";

    const dateFormatted = payment.created_at
      ? new Date(payment.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
      : "—";

    return `
      <div class="transmove-receipt" id="transmove-payment-receipt" style="font-family: 'Inter', system-ui, sans-serif; background: #ffffff; color: #0f172a; padding: 2.5rem; max-width: 580px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
          <div>
            <h1 style="margin: 0; font-size: 1.6rem; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">Trans<span style="color: #059669;">Move</span></h1>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.2rem;">Official EcoCash Payment Voucher</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.85rem; font-weight: 800; color: #0f172a;">${payment.reference || payment.$id || "REC"}</div>
            <div style="font-size: 0.75rem; color: #64748b;">${dateFormatted}</div>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem 1.25rem; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #64748b;">Payment Method</div>
              <div style="font-weight: 800; font-size: 1.05rem; color: #0f172a;">EcoCash Manual Transfer</div>
            </div>
            <span style="font-weight: 800; font-size: 0.75rem; padding: 0.35rem 0.75rem; border-radius: 9999px; ${statusBadgeStyle}">
              ${statusLabel}
            </span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; font-size: 0.85rem;">
          <div>
            <span style="color: #64748b; display: block; font-size: 0.75rem;">Payment Category</span>
            <strong style="color: #0f172a; text-transform: capitalize;">${payment.payment_type || "Service"}</strong>
          </div>
          <div>
            <span style="color: #64748b; display: block; font-size: 0.75rem;">EcoCash Reference</span>
            <strong style="color: #059669; font-family: monospace; font-size: 0.95rem;">${payment.transaction_reference || payment.provider_reference || "—"}</strong>
          </div>
          <div>
            <span style="color: #64748b; display: block; font-size: 0.75rem;">Sender Name</span>
            <strong style="color: #0f172a;">${payment.sender_name || "—"}</strong>
          </div>
          <div>
            <span style="color: #64748b; display: block; font-size: 0.75rem;">Sender Phone</span>
            <strong style="color: #0f172a;">${payment.sender_phone || "—"}</strong>
          </div>
          <div>
            <span style="color: #64748b; display: block; font-size: 0.75rem;">Destination Account</span>
            <strong style="color: #0f172a;">${payment.recipient_name || "TransMove Admin"}</strong>
          </div>
          <div>
            <span style="color: #64748b; display: block; font-size: 0.75rem;">Destination Number</span>
            <strong style="color: #0f172a;">${payment.recipient_number || "—"}</strong>
          </div>
        </div>

        ${isRejected && payment.rejection_reason ? `
          <div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1.5rem; font-size: 0.85rem;">
            <strong>Rejection Reason:</strong> ${payment.rejection_reason}
          </div>
        ` : ""}

        <div style="border-top: 1px solid #e2e8f0; padding-top: 1rem; margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="color: #64748b; font-size: 0.9rem;">Amount Declared</span>
            <span style="color: #64748b; font-size: 0.95rem;">$${Number(payment.amount_declared || payment.amount || 0).toFixed(2)} ${payment.currency || "USD"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #0f172a; font-weight: 700; font-size: 1rem;">Amount Verified</span>
            <strong style="color: #059669; font-size: 1.25rem;">$${Number(payment.amount || payment.amount_expected || 0).toFixed(2)} ${payment.currency || "USD"}</strong>
          </div>
        </div>

        <div style="border-top: 1px dashed #cbd5e1; padding-top: 1rem; text-align: center; font-size: 0.75rem; color: #94a3b8;">
          TransMove Zimbabwe · EcoCash Payment Verification System<br/>
          Automated Electronic Proof of Payment Voucher
        </div>
      </div>
    `;
  },

  printPaymentReceipt(payment) {
    const receiptHtml = this.renderPaymentReceiptHtml(payment);
    const win = window.open("", "_blank", "width=680,height=750");
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Receipt ${payment.reference || payment.$id}</title>
          <style>body { margin: 2rem; background: #f8fafc; }</style>
        </head>
        <body>
          ${receiptHtml}
          <script>window.onload = function() { window.print(); };</script>
        </body>
        </html>
      `);
      win.document.close();
    }
  }
};
