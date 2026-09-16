// ==============================================================================
// TRANSMOVE PAYNOW INITIATION EDGE FUNCTION (Deno / Supabase Edge Runtime)
// Secure Server-Side Paynow Payment Request Creation
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generates MD5 hash for Paynow API security verification
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const paynowId = Deno.env.get("PAYNOW_INTEGRATION_ID") ?? "";
    const paynowKey = Deno.env.get("PAYNOW_INTEGRATION_KEY") ?? "";
    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:8080";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { planId, amount, currency, purpose } = await req.json();

    const internalReference = `TM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // 1. Create pending transaction in database
    const { data: txn, error: txnError } = await supabase
      .from("payment_transactions")
      .insert({
        user_id: user.id,
        amount: amount,
        currency: currency || "USD",
        payment_provider: "paynow",
        internal_reference: internalReference,
        payment_status: "pending",
        purpose: purpose || "subscription",
        verification_payload: {
          plan_id: planId,
          user_email: user.email,
          initiated_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (txnError) throw txnError;

    // 2. Prepare Paynow initiation payload
    const resultUrl = `${supabaseUrl}/functions/v1/paynow-webhook`;
    const returnUrl = `${siteUrl}/#subscriptions?ref=${internalReference}`;

    const paynowPayload: Record<string, string> = {
      id: paynowId,
      reference: internalReference,
      amount: Number(amount).toFixed(2),
      additionalinfo: `TransMove ${purpose || "Subscription"} - Plan #${planId}`,
      returnurl: returnUrl,
      resulturl: resultUrl,
      authemail: user.email ?? "",
      status: "Message",
    };

    const hash = await generatePaynowHash(paynowPayload, paynowKey);
    paynowPayload.hash = hash;

    // 3. Initiate payment with Paynow API
    const formData = new URLSearchParams(paynowPayload);
    const paynowResponse = await fetch("https://www.paynow.co.zw/interface/initiatetransaction", {
      method: "POST",
      body: formData,
    });

    const responseText = await paynowResponse.text();
    const responseParams = new URLSearchParams(responseText);
    const status = responseParams.get("status");
    const browserUrl = responseParams.get("browserurl");
    const pollUrl = responseParams.get("pollurl");

    if (status?.toLowerCase() === "ok" && browserUrl) {
      // Update transaction with Paynow poll URL
      await supabase
        .from("payment_transactions")
        .update({
          verification_payload: {
            ...txn.verification_payload,
            poll_url: pollUrl,
            browser_url: browserUrl,
          },
        })
        .eq("id", txn.id);

      return new Response(
        JSON.stringify({
          success: true,
          internalReference,
          transactionId: txn.id,
          browserUrl,
          pollUrl,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      const errorMsg = responseParams.get("error") || "Failed to initiate transaction with Paynow";
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, raw: responseText }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
