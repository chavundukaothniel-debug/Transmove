// ==============================================================================
// TRANSMOVE CORPORATE & BUSINESS ACCOUNTS SERVICE
// Business Accounts, Employee Management & Monthly Spending Limits
// ==============================================================================
import { getSupabase } from "../config/supabase.js";

export const CorporateService = {
  /**
   * Registers a new corporate account.
   */
  async createCorporateAccount(adminId, companyName, billingEmail, monthlyLimit = 1000) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client uninitialized.");

    const { data, error } = await supabase
      .from("corporate_accounts")
      .insert([
        {
          admin_id: adminId,
          company_name: companyName,
          billing_email: billingEmail,
          monthly_spending_limit: monthlyLimit
        }
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Update admin profile company_name and corporate_id
    await supabase.from("profiles").update({ company_name: companyName, corporate_id: data.id }).eq("id", adminId);

    return data;
  },

  /**
   * Fetches corporate account details for an admin.
   */
  async getCorporateAccount(adminId) {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("corporate_accounts")
      .select("*")
      .eq("admin_id", adminId)
      .maybeSingle();

    if (error) return null;
    return data;
  },

  /**
   * Adds an employee to corporate account by email.
   */
  async addEmployee(corporateId, employeeEmail, spendingLimit = 200) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client uninitialized.");

    // Find profile by email
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", employeeEmail)
      .single();

    if (profErr || !profile) throw new Error("Employee profile with this email was not found.");

    const { data, error } = await supabase
      .from("corporate_employees")
      .insert([{ corporate_id: corporateId, employee_id: profile.id, spending_limit: spendingLimit }])
      .select()
      .single();

    if (error) throw new Error(error.message);

    await supabase.from("profiles").update({ corporate_id: corporateId }).eq("id", profile.id);

    return data;
  },

  /**
   * Gets all corporate employees for a company.
   */
  async getEmployees(corporateId) {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("corporate_employees")
      .select("*, profiles:employee_id(full_name, email, phone_number)")
      .eq("corporate_id", corporateId);

    if (error) return [];
    return data || [];
  }
};
