// ==============================================================================
// TRANSMOVE OFFICIAL RECEIPT RENDERER COMPONENT
// ==============================================================================
import { icon } from "./Icon.js";

export function renderReceiptModal(booking, transaction) {
  const receiptNum = transaction?.internal_reference || `TM-RCT-${(booking?.id || Date.now()).slice(0, 8).toUpperCase()}`;
  const tripId = `TM-2026-${(booking?.id || "849201").slice(0, 6).toUpperCase()}`;
  const fare = booking?.final_price || transaction?.amount || 0;
  const platformFee = parseFloat((fare * 0.05).toFixed(2));
  const total = fare;
  const paymentStatus = (transaction?.payment_status || "PAID").toUpperCase();
  const paymentMethod = transaction?.payment_provider ? transaction.payment_provider.toUpperCase() : "ECOCASH MANUAL";
  const dateStr = new Date(booking?.created_at || Date.now()).toLocaleString("en-ZW");

  return `
    <div id="receipt-modal-content" class="receipt-card" style="background: #ffffff; color: #0f172a; padding: 2rem; border-radius: 12px; font-family: 'Inter', sans-serif; max-width: 480px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border: 1px solid #e2e8f0;">
      
      <!-- Receipt Header -->
      <div style="text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 1.25rem; margin-bottom: 1.25rem;">
        <div style="font-weight: 900; font-size: 1.6rem; color: #0f172a; letter-spacing: -0.03em;">
          Trans<span style="color: #10b981;">Move</span>
        </div>
        <div style="font-size: 0.75rem; text-transform: uppercase; tracking: 0.1em; color: #64748b; margin-top: 0.2rem;">
          Official Transaction Receipt
        </div>
        <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem;">
          17056 Teviotdale, Vainona, Harare, Zimbabwe
        </div>
      </div>

      <!-- Key Details -->
      <div style="font-size: 0.85rem; line-height: 1.6; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748b;">Receipt Number:</span>
          <span style="font-weight: 700; color: #0f172a;">${receiptNum}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748b;">Trip ID:</span>
          <span style="font-weight: 700; color: #0f172a;">${tripId}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748b;">Date &amp; Time:</span>
          <span style="font-weight: 600;">${dateStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748b;">Payment Method:</span>
          <span style="font-weight: 600;">${paymentMethod}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748b;">Payment Status:</span>
          <span style="font-weight: 800; color: ${paymentStatus === 'PAID' ? '#10b981' : '#f59e0b'};">${paymentStatus}</span>
        </div>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin-bottom: 1.25rem;" />

      <!-- Route Details -->
      <div style="font-size: 0.85rem; margin-bottom: 1.25rem; background: #f8fafc; padding: 0.85rem; border-radius: 8px;">
        <div style="margin-bottom: 0.35rem;">
          <strong class="icon-label" style="color: #10b981;">${icon("map-pin", 16)}<span>Pickup:</span></strong> ${booking?.pickup_address || "Pickup Location"}
        </div>
        <div>
          <strong class="icon-label" style="color: #ef4444;">${icon("flag", 16)}<span>Destination:</span></strong> ${booking?.destination_address || "Drop-off Location"}
        </div>
      </div>

      <!-- Breakdown -->
      <div style="font-size: 0.9rem; line-height: 1.8; margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between;">
          <span>Trip Fare</span>
          <span>$${(fare - platformFee).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 0.85rem;">
          <span>Platform Service Fee</span>
          <span>$${platformFee.toFixed(2)}</span>
        </div>
        <hr style="border: none; border-top: 1px dashed #cbd5e1; margin: 0.5rem 0;" />
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 1.15rem; color: #0f172a;">
          <span>Total Paid</span>
          <span style="color: #10b981;">$${total.toFixed(2)}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 0.75rem;">
        <button onclick="window.print()" class="btn btn-primary btn-full" style="background: #10b981; border: none; font-weight: 700;">
        ${icon("printer", 17)}<span>Print / Download Receipt</span>
        </button>
      </div>

    </div>
  `;
}
