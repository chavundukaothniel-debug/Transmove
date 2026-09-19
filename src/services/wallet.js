// ==============================================================================
// TRANSMOVE WALLET & LEDGER SERVICE
// Balance, Earnings, Withdrawals & Ledger Audit
// ==============================================================================
import { getTrustedApiEndpoint } from "../config/appwrite.js";
import { getAuthJwt } from "../config/supabase.js";

async function trustedCall(action, data = {}) {
  const jwt = await getAuthJwt();
  const headers = { "Content-Type": "application/json" };
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;

  const response = await fetch(getTrustedApiEndpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({ action, data, jwt })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Trusted API error (HTTP ${response.status})`);
  return result;
}

export const WalletService = {
  /**
   * Retrieves the wallet balance for a user.
   */
  async getBalance(userId) {
    const result = await trustedCall("get_wallet_balance", userId ? { user_id: userId } : {});
    return Number.parseFloat(result.balance || 0);
  },

  /**
   * Fetches full transaction history / wallet ledger.
   */
  async getTransactionHistory(userId) {
    const result = await trustedCall("list_wallet_transactions", userId ? { user_id: userId } : {});
    return result.transactions || [];
  },

  /**
   * Records a ledger entry (credit or debit).
   */
  async recordTransaction(userId, amount, type, category, description, referenceId = null) {
    throw new Error("Wallet ledger writes are server-only and are not available from the browser.");
  },

  /**
   * Driver earnings metrics (Today, This Week, This Month).
   */
  async getDriverEarnings(driverId) {
    return trustedCall("get_driver_earnings", driverId ? { driver_id: driverId } : {});
  }
};
