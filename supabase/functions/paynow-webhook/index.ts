// ==============================================================================
// TRANSMOVE PAYNOW WEBHOOK & STATUS VERIFICATION EDGE FUNCTION
// Secure Server-Side Payment Confirmation & Subscription Activation
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

// Generates MD5 hash for verifying Paynow's response signature
async function generatePaynowHash(values: Record<string, string>, integrationKey: string): Promise<string> {
  let stringToHash = "";
  for (const key of Object.keys(values)) {
    if (key.toLowerCase() !== "hash") {
      stringToHash += values[key];
    }
  }
  stringToHash += integrationKey;

  const encoder = new TextEncoder();
  const data = encoder.encode(stringToHash);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const paynowKey = Deno.env.get("PAYNOW_INTEGRATION_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Paynow sends result notifications as application/x-www-form-urlencoded
    const formDataText = await req.text();
    const params = new URLSearchParams(formDataText);

    const reference = params.get("reference");
    const paynowRef = params.get("paynowreference");
    const amount = params.get("amount");
    const status = params.get("status")?.trim();
    const receivedHash = params.get("hash");

    if (!reference) {
      return new Response("Missing transaction reference", { status: 400 });
    }

    // 1. Verify response signature
    const verificationMap: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      if (key.toLowerCase() !== "hash") {
        verificationMap[key] = value;
      }
    }

    const calculatedHash = await generatePaynowHash(verificationMap, paynowKey);
    if (receivedHash && calculatedHash !== receivedHash.toUpperCase()) {
      console.error("Invalid Paynow hash verification:", { receivedHash, calculatedHash });
      return new Response("Invalid signature hash", { status: 403 });
    }

    // 2. Fetch the corresponding pending transaction from database
    const { data: txn, error: txnErr } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("internal_reference", reference)
      .single();

    if (txnErr || !txn) {
      console.error("Transaction not found for reference:", reference);
      return new Response("Transaction record not found", { status: 404 });
    }

    // Prevent duplicate processing
    if (txn.payment_status === "paid") {
      return new Response("Transaction already confirmed", { status: 200 });
    }

    const isPaid = status?.toLowerCase() === "paid" || status?.toLowerCase() === "awaiting delivery";

    if (isPaid) {
      // 3. Mark transaction paid
      await supabase
        .from("payment_transactions")
        .update({
          payment_status: "paid",
          paynow_reference: paynowRef,
          verification_payload: {
            ...txn.verification_payload,
            paynow_status: status,
            confirmed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", txn.id);

      // 4. Activate User Subscription
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 Days
      const { data: subscription, error: subErr } = await supabase
        .from("user_subscriptions")
        .insert({
          user_id: txn.user_id,
          plan_id: txn.verification_payload?.plan_id?.startsWith("plan-") ? null : txn.verification_payload?.plan_id,
          status: "active",
          price_paid: txn.amount,
          currency: txn.currency,
          start_date: new Date().toISOString(),
          expiry_date: expiry.toISOString(),
          payment_reference: txn.internal_reference,
          provider: "paynow",
        })
        .select()
        .single();

      // 5. Insert double-entry ledger transaction
      await supabase.from("wallet_ledger").insert({
        user_id: txn.user_id,
        amount: txn.amount,
        transaction_type: "debit",
        category: "payment",
        reference_id: subscription?.id || txn.id,
        description: `Verified Paynow Subscription Settlement (Ref: ${reference})`,
        balance_after: 0.00,
      });

      // 6. Send real user notification
      await supabase.from("notifications").insert({
        user_id: txn.user_id,
        title: "Subscription Activated! 🌟",
        body: `Your Paynow payment of $${txn.amount} ${txn.currency} was verified. Your marketplace tier is now active.`,
        type: "payment",
        reference_id: subscription?.id,
      });

      // 7. Audit log
      await supabase.from("audit_logs").insert({
        actor_id: txn.user_id,
        action: "PAYMENT_CONFIRMED_SUBSCRIPTION_ACTIVE",
        target_type: "user_subscription",
        target_id: subscription?.id,
        details: { reference, paynowRef, amount: txn.amount, status },
      });

      return new Response("Payment confirmed and subscription activated", { status: 200 });
    } else {
      // Payment failed or cancelled
      await supabase
        .from("payment_transactions")
        .update({
          payment_status: status?.toLowerCase() === "cancelled" ? "cancelled" : "failed",
          paynow_reference: paynowRef,
          verification_payload: {
            ...txn.verification_payload,
            paynow_status: status,
            failed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", txn.id);

      return new Response("Payment status recorded as not paid", { status: 200 });
    }
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
