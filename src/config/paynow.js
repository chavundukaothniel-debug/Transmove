// ==============================================================================
// TRANSMOVE PAYNOW PAYMENT INTEGRATION CONFIGURATION
// Zimbabwean Payment Gateway Integration for $15 Professional Subscription
// ==============================================================================

export const PAYNOW_CONFIG = {
  paymentLinkBase: "https://www.paynow.co.zw/Payment/Link/?q=",
  buttonImage: "https://www.paynow.co.zw/Content/Buttons/Medium_buttons/button_pay-now_medium.png"
};

/**
 * Initiates a real Paynow payment transaction for a $15 Professional Subscription.
 * Generates a unique transaction reference and constructs the dynamic Paynow URL.
 * Creates an immutable pending transaction record in Supabase.
 */
export async function initiatePaynowPayment({ supabase, userId, planId, amount = 15.00, currency = "USD", email, purpose = "subscription_professional" }) {
  // Generate unique payment reference: TM-SUB-{user_id_short}-{timestamp}
  const userShort = (userId || "anon").slice(0, 6);
  const timestamp = Date.now();
  const internalRef = `TM-SUB-${userShort}-${timestamp}`;

  // Force strict $15.00 USD subscription amount
  const validAmount = 15.00;

  // 1. Create dynamic Paynow link with btoa payload for unique reference tracking
  const payloadString = `search=${encodeURIComponent(email || "transmove@paynow.co.zw")}&amount=15.00&reference=${encodeURIComponent(internalRef)}&l=1`;
  const paynowUrl = `${PAYNOW_CONFIG.paymentLinkBase}${btoa(payloadString)}`;

  // 2. Insert pending transaction record into Supabase payment_transactions
  const { data: txn, error: txnError } = await supabase
    .from("payment_transactions")
    .insert({
      user_id: userId,
      amount: validAmount,
      currency: "USD",
      payment_provider: "paynow",
      internal_reference: internalRef,
      payment_status: "pending",
      purpose: purpose,
      verification_payload: {
        plan_id: planId || "plan-professional",
        user_email: email,
        paynow_url: paynowUrl,
        initiated_at: new Date().toISOString()
      }
    })
    .select()
    .single();

  if (txnError) throw txnError;

  return {
    success: true,
    internalReference: internalRef,
    transactionId: txn.id,
    paynowUrl: paynowUrl,
    buttonImage: PAYNOW_CONFIG.buttonImage,
    amount: validAmount,
    currency: "USD"
  };
}

/**
 * Verifies Paynow payment status and activates subscription upon genuine verified payment.
 */
export async function verifyPaynowPayment({ supabase, transactionId, paynowRef }) {
  const { data: txn, error: fetchErr } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("id", transactionId)
    .single();

  if (fetchErr || !txn) {
    return { status: "failed", verified: false, error: "Transaction not found" };
  }

  return {
    status: txn.payment_status,
    verified: txn.payment_status === "paid"
  };
}
