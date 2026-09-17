// Verifies the Appwrite transaction shape used by accept_bid without creating
// Auth users. Every temporary database document is removed in finally.
import fs from "fs";
import path from "path";

const config = {};
for (const line of fs.readFileSync(path.resolve(process.cwd(), ".env.appwrite.setup"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (match) config[match[1]] = match[2];
}

const endpoint = config.APPWRITE_ENDPOINT;
const headers = {
  "X-Appwrite-Project": config.APPWRITE_PROJECT_ID,
  "X-Appwrite-Key": config.APPWRITE_API_KEY,
  "Content-Type": "application/json"
};
const database = "transmove";
const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const ids = {
  request: `tx_req_${suffix}`,
  bid: `tx_bid_${suffix}`,
  booking: `tx_booking_${suffix}`,
  duplicate: `tx_duplicate_${suffix}`
};

async function request(url, options = {}) {
  const response = await fetch(url, { headers, ...options });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `HTTP ${response.status}`);
  return body;
}

const documentUrl = (collection, id = "") =>
  `${endpoint}/databases/${database}/collections/${collection}/documents${id ? `/${id}` : ""}`;

async function remove(collection, id) {
  const response = await fetch(documentUrl(collection, id), { method: "DELETE", headers });
  if (![204, 404].includes(response.status)) throw new Error(`Cleanup failed for ${collection}/${id}: HTTP ${response.status}`);
}

try {
  const now = new Date().toISOString();
  await request(documentUrl("service_requests"), {
    method: "POST",
    body: JSON.stringify({
      documentId: ids.request,
      data: {
        passenger_id: "__test_passenger__",
        service_type: "ride",
        pickup_location: "Transaction Test Pickup",
        destination: "Transaction Test Destination",
        budget: 10,
        status: "open_for_bids",
        created_at: now,
        updated_at: now
      },
      permissions: []
    })
  });
  await request(documentUrl("bids"), {
    method: "POST",
    body: JSON.stringify({
      documentId: ids.bid,
      data: {
        request_id: ids.request,
        driver_id: "__test_driver__",
        vehicle_id: "__test_vehicle__",
        amount: 9,
        estimated_arrival_minutes: 12,
        status: "pending",
        created_at: now,
        updated_at: now
      },
      permissions: []
    })
  });

  const transaction = await request(`${endpoint}/databases/transactions`, {
    method: "POST",
    body: JSON.stringify({})
  });
  const transactionId = transaction.$id;
  const stage = (url, method, payload) => request(url, {
    method,
    body: JSON.stringify({ ...payload, transactionId })
  });

  await stage(documentUrl("bids", ids.bid), "PATCH", {
    data: { status: "accepted", updated_at: now }
  });
  await stage(documentUrl("service_requests", ids.request), "PATCH", {
    data: { status: "accepted", updated_at: now }
  });
  await stage(documentUrl("bookings"), "POST", {
    documentId: ids.booking,
    data: {
      request_id: ids.request,
      passenger_id: "__test_passenger__",
      driver_id: "__test_driver__",
      vehicle_id: "__test_vehicle__",
      accepted_bid_id: ids.bid,
      amount: 9,
      status: "confirmed",
      created_at: now,
      updated_at: now
    },
    permissions: []
  });

  const committed = await request(`${endpoint}/databases/transactions/${transactionId}`, {
    method: "PATCH",
    body: JSON.stringify({ commit: true })
  });
  if (committed.status !== "committed") throw new Error(`Transaction status was '${committed.status}'.`);

  const [requestDoc, bidDoc, bookingDoc] = await Promise.all([
    request(documentUrl("service_requests", ids.request)),
    request(documentUrl("bids", ids.bid)),
    request(documentUrl("bookings", ids.booking))
  ]);
  if (requestDoc.status !== "accepted") throw new Error(`Request status is '${requestDoc.status}'.`);
  if (bidDoc.status !== "accepted") throw new Error(`Bid status is '${bidDoc.status}'.`);
  if (bookingDoc.request_id !== ids.request) throw new Error("Booking does not reference the same request.");

  const duplicateResponse = await fetch(documentUrl("bookings"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      documentId: ids.duplicate,
      data: {
        request_id: ids.request,
        passenger_id: "__test_passenger__",
        driver_id: "__test_driver__",
        vehicle_id: "__test_vehicle__",
        accepted_bid_id: ids.bid,
        amount: 9,
        status: "confirmed",
        created_at: now,
        updated_at: now
      },
      permissions: []
    })
  });
  if (duplicateResponse.ok) throw new Error("Duplicate booking for one request was unexpectedly allowed.");

  console.log("PASS: atomic bid/request/booking transaction committed with request status accepted.");
  console.log("PASS: unique request constraint blocked a second booking.");
} finally {
  await remove("bookings", ids.duplicate);
  await remove("bookings", ids.booking);
  await remove("bids", ids.bid);
  await remove("service_requests", ids.request);
  console.log("PASS: transaction plumbing test data cleaned.");
}
