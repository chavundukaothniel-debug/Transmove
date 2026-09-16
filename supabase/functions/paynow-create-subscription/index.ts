// ==============================================================================
// TRANSMOVE PAYNOW SUBSCRIPTION INITIATION EDGE FUNCTION
// Supabase Edge Function: paynow-create-subscription
// Strictly Server-Side Price Enforced ($15.00 USD), SHA-512 Hashed, Role Guarded
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Generates an uppercase SHA-512 hex hash according to official Paynow specifications.
 * Concatenates raw field values in exact order, appends integration key, UTF-8 encodes, SHA-512 hashes.
 */
async function generatePaynowSHA512Hash(
  fields: Array<{ name: string; value: string }>,
  integrationKey: string
): Promise<string> {
  let concatenated = "";
  for (const field of fields) {
    if (field.name.toLowerCase() !== "hash") {
      concatenated += field.value;
    }
  }
  concatenated += integrationKey;

  const encoder = new TextEncoder();
  const data = encoder.encode(concatenated);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Verifies an inbound Paynow response SHA-512 hash against calculated hash.
 */
async function verifyPaynowResponseHash(
  responseParams: URLSearchParams,
  integrationKey: string
): Promise<boolean> {
  const returnedHash = responseParams.get("hash");
  if (!returnedHash) return false;

  const fields: Array<{ name: string; value: string }> = [];
  for (const [key, value] of responseParams.entries()) {
    if (key.toLowerCase() !== "hash") {
      fields.push({ name: key, value });
    }
  }

  const calculatedHash = await generatePaynowSHA512Hash(fields, integrationKey);
  return calculatedHash.toUpperCase() === returnedHash.trim().toUpperCase();
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Fetch Environment Variables & Server Secrets
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const paynowId = Deno.env.get("PAYNOW_INTEGRATION_ID") ?? "";
    const paynowKey = Deno.env.get("PAYNOW_INTEGRATION_KEY") ?? "";

    if (!paynowId || !paynowKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Paynow server integration keys not configured in Edge Function secrets.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Authenticate Supabase User via Bearer Token (Do NOT trust user_id from browser body)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired authentication session." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Inspect User Profile & Enforce Role Guard (Only Paid Provider Roles Allowed)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: "User profile record not found." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userRole = (profile.role || "customer").toLowerCase();
    const isPassenger = userRole === "customer" || userRole === "passenger";

    if (isPassenger) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Passengers enjoy 100% free access and cannot initiate paid subscriptions.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Fixed Server-Side Subscription Definition (IGNORE any price sent by browser)
    const PLAN_NAME = "TransMove Professional";
    const FIXED_AMOUNT = "15.00"; // Enforced server-side
    const CURRENCY = "USD";
    const BILLING_PERIOD = "Monthly";

    // 5. Generate Unique Payment Reference: TM-SUB-{USER_SHORT_ID}-{UNIQUE_ID}
    const userShortId = user.id.replace(/-/g, "").substring(0, 6).toUpperCase();
    const uniqueId = `${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const reference = `TM-SUB-${userShortId}-${uniqueId}`;

    // 6. Insert PENDING Payment Record into Database before calling Paynow
    const { data: txn, error: txnError } = await supabase
      .from("payment_transactions")
      .insert({
        user_id: user.id,
        amount: parseFloat(FIXED_AMOUNT),
        currency: CURRENCY,
        payment_provider: "PAYNOW",
        internal_reference: reference,
        payment_status: "pending",
        purpose: `${PLAN_NAME} ${BILLING_PERIOD} Subscription`,
        payment_type: "SUBSCRIPTION",
        poll_url: null,
        verification_payload: {
          plan_name: PLAN_NAME,
          price: FIXED_AMOUNT,
          currency: CURRENCY,
          user_email: user.email || "",
          user_role: userRole,
          initiated_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (txnError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Database transaction creation failed: ${txnError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 7. Construct Paynow Initiation Request Parameters
    const originHeader = req.headers.get("origin") || req.headers.get("referer") || "http://localhost:8080";
    let baseUrl = "http://localhost:8080";
    try {
      const parsed = new URL(originHeader);
      baseUrl = parsed.origin;
    } catch (_e) {
      baseUrl = "http://localhost:8080";
    }

    const returnUrl = `${baseUrl}/subscription/payment-result?ref=${reference}`;
    const resultUrl = `${supabaseUrl}/functions/v1/paynow-result`;
    const userEmail = user.email || "";

    // Official Paynow message fields array in required order for initiation
    const paynowFields: Array<{ name: string; value: string }> = [
      { name: "id", value: paynowId },
      { name: "reference", value: reference },
      { name: "amount", value: FIXED_AMOUNT },
      { name: "additionalinfo", value: `${PLAN_NAME} Monthly Subscription` },
      { name: "returnurl", value: returnUrl },
      { name: "resulturl", value: resultUrl },
    ];

    if (userEmail) {
      paynowFields.push({ name: "authemail", value: userEmail });
    }

    paynowFields.push({ name: "status", value: "Message" });

    // Compute SHA-512 Outbound Hash
    const hash = await generatePaynowSHA512Hash(paynowFields, paynowKey);

    // Build URL-encoded form data payload
    const formData = new URLSearchParams();
    for (const field of paynowFields) {
      formData.append(field.name, field.value);
    }
    formData.append("hash", hash);

    // 8. Send Initiation POST Request to Paynow
    const paynowResponse = await fetch("https://www.paynow.co.zw/interface/initiatetransaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!paynowResponse.ok) {
      await supabase
        .from("payment_transactions")
        .update({
          payment_status: "failed",
          verification_payload: {
            ...txn.verification_payload,
            error: `Paynow HTTP ${paynowResponse.status} ${paynowResponse.statusText}`,
          },
        })
        .eq("id", txn.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Paynow HTTP connection error (${paynowResponse.status}).`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const responseText = await paynowResponse.text();
    const responseParams = new URLSearchParams(responseText);

    const statusParam = (responseParams.get("status") || "").toLowerCase().trim();
    const browserUrl = responseParams.get("browserurl");
    const pollUrl = responseParams.get("pollurl");
    const paynowRef = responseParams.get("paynowreference") || responseParams.get("paynow_reference");

    // 9. If status is Ok, verify Response Hash BEFORE trusting redirect/poll URLs
    if (statusParam === "ok" && browserUrl) {
      const isHashValid = await verifyPaynowResponseHash(responseParams, paynowKey);
      
      if (!isHashValid) {
        await supabase
          .from("payment_transactions")
          .update({
            payment_status: "failed",
            verification_payload: {
              ...txn.verification_payload,
              error: "Inbound Paynow hash verification failed.",
              raw_response: responseText,
            },
          })
          .eq("id", txn.id);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Paynow security verification failed (Response Hash Mismatch).",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Save poll_url and paynow_reference in PENDING payment record
      await supabase
        .from("payment_transactions")
        .update({
          poll_url: pollUrl,
          paynow_reference: paynowRef || null,
          verification_payload: {
            ...txn.verification_payload,
            poll_url: pollUrl,
            browser_url: browserUrl,
            paynow_reference: paynowRef,
          },
        })
        .eq("id", txn.id);

      // Return success JSON with reference and Paynow redirect URL
      return new Response(
        JSON.stringify({
          success: true,
          reference: reference,
          redirect_url: browserUrl,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      // Paynow returned status=Error or missing browserurl
      const paynowErrorMsg = responseParams.get("error") || "Paynow transaction initiation was declined.";

      await supabase
        .from("payment_transactions")
        .update({
          payment_status: "failed",
          verification_payload: {
            ...txn.verification_payload,
            paynow_error: paynowErrorMsg,
            raw_response: responseText,
          },
        })
        .eq("id", txn.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: paynowErrorMsg,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Internal server error occurred.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
