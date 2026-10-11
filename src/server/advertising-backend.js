import { randomUUID } from "crypto";
import { googleDriveStorage } from "./google-drive-storage.js";

const placements = ["home_banner", "driver_dashboard", "vehicle_owner_dashboard", "machinery_owner_dashboard", "passenger_dashboard", "machinery_hirer_dashboard", "cargo_owner_dashboard", "logistics_dashboard", "popup"];
export const paymentMetadata = (payment) => {
  try { const value = JSON.parse(payment.admin_notes || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; }
};
const normalizePlacement = (value) => String(value || "home_banner").toLowerCase();
const price = (data) => {
  const days = Number(data.duration_days || 7);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("Advertising duration must be between 1 and 365 days.");
  const placement = normalizePlacement(data.placement);
  if (!placements.includes(placement)) throw new Error("Invalid advertising placement.");
  return { duration_days: days, placement, daily_rate: 5, total_price: Math.round(5 * days * (data.is_targeted ? 1.2 : 1) * (data.is_featured ? 1.4 : 1) * 100) / 100, currency: "USD" };
};

// Campaigns and payments use the existing database schema; payment metadata links them.
export async function handleAdvertising({ engine, action, data, userId, requireAdmin, recordById }) {
  const read = async (table) => {
    if (!engine.supabaseAdmin) return engine.db[table === "advertising_campaigns" ? "ad_campaigns" : table] || [];
    const { data: rows, error } = await engine.supabaseAdmin.from(table).select("*");
    if (error) throw new Error(`Could not load ${table}: ${error.message}`);
    return rows || [];
  };
  const save = async (table, row, update = false) => {
    if (engine.supabaseAdmin) {
      const query = engine.supabaseAdmin.from(table);
      const { error } = await (update ? query.update(row).eq("id", row.id) : query.insert(row));
      if (error) throw new Error(`Could not save ${table}: ${error.message}`);
    }
    const key = table === "advertising_campaigns" ? "ad_campaigns" : table;
    const rows = engine.db[key] ||= [];
    const index = rows.findIndex(item => item.id === row.id);
    if (index < 0) rows.push(row); else rows[index] = { ...rows[index], ...row };
    engine._persistLocalDb();
    return row;
  };
  const decorate = (campaign, payments, profiles = []) => {
    const related = payments.filter(p => paymentMetadata(p).campaign_id === campaign.id).sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
    const payment = related.find(p => ["approved", "paid"].includes(p.status)) || related[0];
    const meta = payment ? paymentMetadata(payment) : {};
    const profile = profiles.find(p => p.id === campaign.user_id);
    return { ...campaign, $id: campaign.id, company_name: meta.business_name || profile?.full_name,
      contact_phone: profile?.phone, contact_email: profile?.email, description: meta.description || "",
      amount_expected: Number(campaign.budget || campaign.total_cost || 0),
      duration_days: meta.duration_days || Math.round((new Date(campaign.end_date)-new Date(campaign.start_date))/86400000) || 7,
      payment_status: payment?.status || "awaiting_payment", payment_id: payment?.id, proof_file_id: payment?.proof_file_id,
      image_url: campaign.image_file_id ? `/api/files/preview/${encodeURIComponent(campaign.image_file_id)}` : campaign.image_url,
      destination_url: campaign.target_url, rejection_reason: meta.rejection_reason || "" };
  };
  const activate = async (campaign, payment) => {
    const days = paymentMetadata(payment).duration_days || Math.round((new Date(campaign.end_date)-new Date(campaign.start_date))/86400000) || 7;
    const start = new Date();
    return save("advertising_campaigns", { ...campaign, status: "active", start_date: start.toISOString(), end_date: new Date(start.getTime()+days*86400000).toISOString(), updated_at: start.toISOString() }, true);
  };

  if (action === "list_ad_rate_cards") return { rate_cards: placements.map(placement => ({ placement, placement_label: placement.replace(/_/g," "), base_rate: 5, minimum_days: 1, maximum_days: 365, targeting_multiplier: 1.2, featured_multiplier: 1.4 })) };
  if (action === "list_ad_packages") return { packages: [] };
  if (action === "calculate_ad_price") return price(data);
  if (action === "submit_ad_campaign") {
    if (data.is_targeted || data.is_featured) throw new Error("City targeting and featured upgrades are not available yet. Submit a standard placement campaign.");
    const caller = await engine.getCallerProfile(userId);
    if (!caller || caller.account_status !== "active") throw new Error("An active account is required to submit an advertising campaign.");
    const quote = price(data);
    const title = String(data.title || "").trim();
    if (!title || title.length > 200) throw new Error("Enter an advertising title of up to 200 characters.");
    const target = String(data.destination_url || data.target_url || data.link_url || "").trim();
    if (target && !/^https?:\/\//i.test(target)) throw new Error("Advertising links must start with https:// or http://.");
    if (data.image_file_id) {
      const image = await googleDriveStorage.getFileMetadata(data.image_file_id);
      const meta = image?.metadata || image?.customMetadata || {};
      if (!image || !["image/jpeg", "image/png", "image/webp"].includes(image.mimeType) || meta.userId !== userId || meta.type !== "ad_creative") throw new Error("Use an advertising image uploaded by your account.");
    }
    const now = new Date();
    const campaign = await save("advertising_campaigns", { id: randomUUID(), user_id: userId, title, placement: quote.placement,
      status: "pending_review", budget: quote.total_price, start_date: now.toISOString(), end_date: new Date(now.getTime()+quote.duration_days*86400000).toISOString(),
      image_file_id: data.image_file_id || null, target_url: target || null, created_at: now.toISOString(), updated_at: now.toISOString() });
    return { ...campaign, $id: campaign.id };
  }
  if (action === "submit_ecocash_payment" && data.payment_type === "advertising") {
    const campaign = (await read("advertising_campaigns")).find(c => c.id === data.related_id);
    if (!campaign || campaign.user_id !== userId) throw new Error("Advertising campaign not found or not owned by you.");
    if (campaign.status === "rejected") throw new Error("This campaign was rejected. Submit a corrected campaign.");
    const payments = await read("payments");
    if (payments.some(p => paymentMetadata(p).campaign_id === campaign.id && ["pending_review","approved","paid"].includes(p.status))) throw new Error("A payment is already under review or approved for this campaign.");
    const dest = (await read("payment_destinations")).find(d => d.id === data.payment_destination_id && d.active);
    if (!dest) throw new Error("Invalid or inactive payment destination.");
    const reference = String(data.transaction_reference || "").trim();
    if (!reference || !data.proof_file_id) throw new Error("Transaction reference and payment proof are required.");
    if (payments.some(p => (p.provider_reference || p.reference) === reference && p.provider === (dest.provider || "ecocash"))) throw new Error("This transaction reference has already been submitted.");
    const proof = await googleDriveStorage.getFileMetadata(data.proof_file_id);
    if (!proof || !["image/jpeg","image/png","application/pdf"].includes(proof.mimeType) || Number(proof.size) <= 0 || Number(proof.size) > 5*1024*1024) throw new Error("Upload a valid JPG, PNG or PDF payment proof of up to 5MB.");
    const proofOwner = (proof.metadata || proof.customMetadata || {}).userId;
    if (proofOwner && proofOwner !== userId) throw new Error("Use payment proof uploaded by your account.");
    if (Number(data.amount_declared) !== Number(campaign.budget)) throw new Error("The declared payment must match the campaign price.");
    const now = new Date().toISOString();
    const payment = await save("payments", { id: randomUUID(), user_id: userId, payment_destination_id: dest.id, subscription_id: null,
      payment_type: "advertising", amount: Number(campaign.budget), currency: "USD", provider: dest.provider || "ecocash",
      reference, provider_reference: reference, sender_name: data.sender_name || "", sender_phone: data.sender_phone || "",
      proof_storage_provider: "google_drive", proof_file_id: data.proof_file_id, proof_filename: proof.name || "payment-proof",
      status: "pending_review", admin_notes: JSON.stringify({ campaign_id: campaign.id, duration_days: Math.round((new Date(campaign.end_date)-new Date(campaign.start_date))/86400000), business_name: data.business_name || "", description: data.description || "" }), created_at: now, updated_at: now });
    return { ...payment, $id: payment.id, payment };
  }
  if (action === "admin_list_ad_campaigns") {
    await requireAdmin();
    const [campaigns, payments, profiles, machineryAds] = await Promise.all([read("advertising_campaigns"), read("payments"), read("profiles"), read("machinery_advertisements")]);
    const rows = campaigns.map(c => decorate(c, payments, profiles));
    // Retain visibility of older drafts that were saved only in the server's local store.
    for (const old of engine.db.ad_campaigns || []) {
      if (!campaigns.some(c => c.id === old.id)) rows.push({ ...decorate(old, payments, profiles), legacy: true, payment_status: "resubmission_required" });
    }
    // Machinery requests are durable payment records, including requests submitted before this fix.
    for (const payment of payments.filter(p => p.payment_type === "machinery_advertisement")) {
      const meta = paymentMetadata(payment), profile = profiles.find(p => p.id === payment.user_id);
      const promotion = machineryAds.find(a => a.machinery_id === meta.machinery_id && a.status === "active" && new Date(a.end_at) > new Date() && Math.abs(new Date(a.start_at)-new Date(payment.paid_at)) < 5000);
      rows.push({ id: payment.id, $id: payment.id, kind: "machinery", payment_id: payment.id, title: meta.machinery_name || "Machinery promotion",
        placement: "machinery_marketplace", company_name: profile?.full_name, contact_phone: profile?.phone, contact_email: profile?.email,
        amount_expected: Number(payment.amount), duration_days: meta.duration_days, status: promotion ? "active" : payment.status,
        start_date: promotion?.start_at, end_date: promotion?.end_at, target_url: meta.machinery_id ? `#machinery?id=${encodeURIComponent(meta.machinery_id)}` : null,
        proof_file_id: payment.proof_file_id, payment_status: payment.status, created_at: payment.created_at, rejection_reason: meta.rejection_reason || "" });
    }
    return { campaigns: rows.filter(c => !data.status || c.status === data.status).sort((a,b) => new Date(b.created_at)-new Date(a.created_at)) };
  }
  if (["admin_approve_ad_content", "admin_reject_ad_content"].includes(action)) {
    await requireAdmin();
    const campaign = (await read("advertising_campaigns")).find(c => c.id === (data.campaign_id || data.ad_id));
    if (!campaign) throw new Error("This older draft was not saved to the shared database. Ask the advertiser to resubmit it using the updated advertising form.");
    if (campaign.status !== "pending_review") throw new Error("Only pending campaigns can be moderated.");
    const payments = await read("payments");
    if (action === "admin_reject_ad_content") {
      const reason = String(data.reason || data.rejection_reason || "").trim();
      if (!reason) throw new Error("A rejection reason is required.");
      for (const payment of payments.filter(p => paymentMetadata(p).campaign_id === campaign.id)) await save("payments", { ...payment, admin_notes: JSON.stringify({ ...paymentMetadata(payment), rejection_reason: reason }) }, true);
      return save("advertising_campaigns", { ...campaign, status: "rejected", updated_at: new Date().toISOString() }, true);
    }
    const paid = payments.find(p => paymentMetadata(p).campaign_id === campaign.id && ["approved","paid"].includes(p.status));
    return paid ? activate(campaign, paid) : save("advertising_campaigns", { ...campaign, status: "approved", updated_at: new Date().toISOString() }, true);
  }
  if (["admin_approve_payment", "approve_subscription_payment"].includes(action)) {
    const payment = await recordById("payments", data.payment_id);
    if (!["advertising", "machinery_advertisement"].includes(payment?.payment_type)) return undefined;
    await requireAdmin();
    if (payment.user_id === userId) throw new Error("Administrators cannot approve their own payments.");
    if (payment.status !== "pending_review") throw new Error("Only pending payments can be approved.");
    if (payment.payment_type === "machinery_advertisement") {
      const meta = paymentMetadata(payment), machine = await recordById("machinery", meta.machinery_id);
      if (!machine || machine.owner_id !== payment.user_id || !["approved", "verified"].includes(machine.verification_status)) throw new Error("The machinery listing must be verified and owned by the advertiser before publishing.");
      const hours = Number(meta.duration_hours || meta.duration_days * 24);
      if (!Number.isFinite(hours) || hours <= 0) throw new Error("Invalid promotion duration.");
      const existing = (await read("machinery_advertisements")).find(a => a.machinery_id === machine.id);
      const now = new Date(), end = new Date(now.getTime() + hours * 3600000);
      const approved = await save("payments", { ...payment, status: "approved", paid_at: now.toISOString(), updated_at: now.toISOString() }, true);
      try {
        const ad = await save("machinery_advertisements", { ...(existing || { id: randomUUID(), impressions: 0, clicks: 0, hire_requests_generated: 0, created_at: now.toISOString() }), machinery_id: machine.id, owner_id: payment.user_id, status: "active", start_at: now.toISOString(), end_at: end.toISOString(), updated_at: now.toISOString() }, Boolean(existing));
        return { ...approved, $id: approved.id, payment: approved, advertisement: ad };
      } catch (error) { await save("payments", { ...payment }, true); throw error; }
    }
    const campaign = (await read("advertising_campaigns")).find(c => c.id === paymentMetadata(payment).campaign_id);
    if (!campaign || campaign.status === "rejected") throw new Error("Campaign missing or content rejected.");
    const approved = await save("payments", { ...payment, status: "approved", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }, true);
    try { if (campaign.status === "approved") await activate(campaign, approved); }
    catch (error) { await save("payments", { ...payment }, true); throw error; }
    return { ...approved, $id: approved.id, payment: approved };
  }
  if (action === "list_active_ads_by_placement") {
    const [campaigns, payments] = await Promise.all([read("advertising_campaigns"), read("payments")]);
    return { ads: campaigns.filter(c => c.status === "active" && normalizePlacement(c.placement) === normalizePlacement(data.placement) && new Date(c.start_date) <= new Date() && new Date(c.end_date) > new Date()).map(c => decorate(c,payments)) };
  }
  if (["log_ad_impression", "log_ad_click"].includes(action)) {
    const campaign = (await read("advertising_campaigns")).find(c => c.id === data.campaign_id && c.status === "active" && new Date(c.end_date) > new Date());
    if (!campaign) throw new Error("This advertisement is no longer active.");
    await save(action === "log_ad_click" ? "advertising_clicks" : "advertising_impressions", { id: randomUUID(), campaign_id: campaign.id });
    return { success: true, destination_url: campaign.target_url };
  }
  return undefined;
}
