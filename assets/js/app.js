// ==============================================================================
// TRANSMOVE SPA APPLICATION CONTROLLER & ROUTER
// Standardized Layout Shell: Left Sidebar + Top Header + Main Content
// ==============================================================================
import { AuthService } from "../../src/services/auth.js";
import { ThemeService } from "../../src/services/theme.js";
import { renderSidebar } from "../../src/components/Sidebar.js";
import { renderHeader } from "../../src/components/Header.js";
import { renderMobileNav } from "../../src/components/MobileNav.js";
import { openSupabaseConfigModal } from "../../src/components/Navbar.js";

// Views
import { HomeView } from "../../src/views/HomeView.js";
import { AuthView } from "../../src/views/AuthView.js";
import { CustomerView } from "../../src/views/CustomerView.js";
import { DriverView } from "../../src/views/DriverView.js";
import { CargoOwnerView } from "../../src/views/CargoOwnerView.js";
import { LogisticsView } from "../../src/views/LogisticsView.js";
import { VehicleOwnerView } from "../../src/views/VehicleOwnerView.js";
import { MachineryOwnerView } from "../../src/views/MachineryOwnerView.js";
import { MachineryHirerView } from "../../src/views/MachineryHirerView.js";
import { OwnerView } from "../../src/views/OwnerView.js";
import { AdminView } from "../../src/views/AdminView.js";
import { EquipmentView } from "../../src/views/EquipmentView.js";
import { SubscriptionsView } from "../../src/views/SubscriptionsView.js";
import { MessagesView } from "../../src/views/MessagesView.js";
import { ProfileView } from "../../src/views/ProfileView.js";
import { AdvertiseView } from "../../src/views/AdvertiseView.js";
import { ContactView } from "../../src/views/ContactView.js";
import { SupportView } from "../../src/views/SupportView.js";
import { LegalView } from "../../src/views/LegalView.js";
import { BusinessView } from "../../src/views/BusinessView.js";

class App {
  constructor() {
    this.currentProfile = null;
    this.currentRoute = "home";
    this.sidebarCollapsed = localStorage.getItem("transmove_sidebar_collapsed") === "true";
  }

  async init() {
    // 1. Initial auth state fetch & approved roles hydration
    try {
      this.currentProfile = await AuthService.getCurrentProfile();
      if (this.currentProfile) {
        this.currentProfile.approvedRoles = await AuthService.getApprovedRoles(this.currentProfile);
      }
    } catch (err) {
      console.warn("Auth initialization check:", err.message);
    }

    // 2. Listen to Auth State changes
    AuthService.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        this.currentProfile = await AuthService.getCurrentProfile();
        if (this.currentProfile) {
          this.currentProfile.approvedRoles = await AuthService.getApprovedRoles(this.currentProfile);
        }
        this.render();
      } else if (event === "SIGNED_OUT") {
        this.currentProfile = null;
        window.location.hash = "#home";
        this.render();
      }
    });

    // 3. Hash Change Listener
    window.addEventListener("hashchange", () => {
      this.handleRoute();
    });

    // 4. Stealth Keyboard Shortcut for Admin Access (Ctrl + Shift + A)
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        window.location.hash = "#admin";
      }
    });

    // 5. Global WhatsApp listener
    document.getElementById("btn-footer-whatsapp")?.addEventListener("click", () => {
      import("../../src/services/social.js").then(({ SocialService }) => {
        SocialService.launchWhatsAppSupport();
      });
    });

    // Initial Route
    this.handleRoute();
  }

  async handleRoute() {
    const rawHash = window.location.hash.slice(1);
    let route = rawHash.split("?")[0];

    // Normalize hyphenated route names to internal module keys
    const routeAliasMap = {
      passenger: "customer",
      "cargo-owner": "cargo_owner",
      "vehicle-owner": "vehicle_owner",
      "machinery-owner": "machinery_owner",
      "machinery-hirer": "machinery_hirer",
      advertiser: "advertise",
      "admin-login": "admin_login",
      "admin/login": "admin_login",
      terms: "legal",
      privacy: "legal"
    };

    route = routeAliasMap[route] || route;

    // Direct dashboard entry for logged-in users visiting root, home, or login
    if ((!rawHash || rawHash === "" || rawHash === "home" || route === "login") && this.currentProfile) {
      const primaryRole = AuthService.getPrimaryRole(this.currentProfile);
      const defaultRoleRoute = {
        driver: "driver",
        customer: "passenger",
        passenger: "passenger",
        cargo_owner: "cargo-owner",
        logistics_provider: "logistics",
        logistics: "logistics",
        vehicle_owner: "vehicle-owner",
        machinery_owner: "machinery-owner",
        machinery_hirer: "machinery-hirer",
        owner: "owner",
        business: "business",
        business_admin: "business",
        advertiser: "advertise",
        admin: "admin"
      }[primaryRole] || "passenger";

      window.location.hash = `#${defaultRoleRoute}`;
      return;
    }

    this.currentRoute = route || "home";

    // Unauthenticated protection for private dashboard routes
    const privateRoutes = [
      "customer",
      "driver",
      "cargo_owner",
      "logistics",
      "vehicle_owner",
      "machinery_owner",
      "machinery_hirer",
      "owner",
      "business",
      "admin",
      "profile",
      "messages"
    ];

    if (privateRoutes.includes(route) && !this.currentProfile) {
      window.location.hash = "#login";
      return;
    }

    // Strict role authorization verification for logged-in users
    if (this.currentProfile) {
      const userRoles = this.currentProfile.approvedRoles || [AuthService.getPrimaryRole(this.currentProfile)];
      const roleRouteMap = {
        customer: "passenger",
        driver: "driver",
        cargo_owner: "cargo_owner",
        logistics: "logistics_provider",
        vehicle_owner: "vehicle_owner",
        machinery_owner: "machinery_owner",
        machinery_hirer: "machinery_hirer",
        owner: "owner",
        business: "business_admin",
        advertise: "advertiser",
        admin: "admin"
      };

      const isDashboardRoute = Object.keys(roleRouteMap).includes(route);
      if (isDashboardRoute && route !== "admin") {
        const requiredRole = roleRouteMap[route];
        const hasAccess = userRoles.includes(requiredRole) || userRoles.includes("admin");
        if (!hasAccess) {
          alert(`Access Restricted: Your account does not have an active approved ${requiredRole.replace('_', ' ').toUpperCase()} role.`);
          const primaryRole = AuthService.getPrimaryRole(this.currentProfile);
          AuthService.setActiveRole(this.currentProfile, primaryRole);
          return;
        }
      }
    }

    if (route === "admin_login" && this.currentProfile?.role === "admin") {
      window.location.hash = "#admin";
      return;
    }

    if (route === "admin" && this.currentProfile?.role !== "admin") {
      window.location.hash = "#admin-login";
      return;
    }

    await this.render();
  }

  async render() {
    const sidebarMount = document.getElementById("sidebar-mount");
    const headerMount = document.getElementById("header-mount");
    const mobileNavMount = document.getElementById("mobile-nav-mount");
    const contentContainer = document.getElementById("app-root");
    const isAuthRoute = ["login", "register", "forgot-password", "reset-password", "verify-email"].includes(this.currentRoute);
    const isPassengerRoute = ["customer", "messages", "profile", "support", "help", "safety", "status"].includes(this.currentRoute)
      && ["customer", "passenger"].includes(this.currentProfile?.role);
    document.body.classList.toggle("auth-route", isAuthRoute);
    document.body.classList.toggle("passenger-route", isPassengerRoute);

    // Render Sidebar
    if (sidebarMount) {
      sidebarMount.innerHTML = renderSidebar(this.currentProfile, this.currentRoute, this.sidebarCollapsed);
      
      // Bind Sidebar Collapse Toggle
      document.getElementById("btn-toggle-sidebar")?.addEventListener("click", () => {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        localStorage.setItem("transmove_sidebar_collapsed", this.sidebarCollapsed);
        const sidebar = document.getElementById("app-sidebar");
        if (sidebar) sidebar.classList.toggle("collapsed", this.sidebarCollapsed);
        const btn = document.getElementById("btn-toggle-sidebar");
        if (btn) btn.innerText = this.sidebarCollapsed ? "❯" : "❮";
      });

      // Bind Sidebar Logout Button
      document.getElementById("btn-sidebar-logout")?.addEventListener("click", async (e) => {
        e.preventDefault();
        await AuthService.logout();
      });
    }

    // Render Top Header
    if (headerMount) {
      headerMount.innerHTML = renderHeader(this.currentProfile, this.currentRoute);

      // Role Switcher Listener
      document.getElementById("header-role-switcher")?.addEventListener("change", (e) => {
        const selectedRole = e.target.value;
        AuthService.setActiveRole(this.currentProfile, selectedRole);
      });

      // Theme Selector Listener
      document.getElementById("header-theme-selector")?.addEventListener("change", (e) => {
        ThemeService.setTheme(e.target.value);
      });

      // Mobile Menu Trigger Listener
      document.getElementById("btn-mobile-sidebar-trigger")?.addEventListener("click", () => {
        const sidebar = document.getElementById("app-sidebar");
        if (!sidebar) return;

        if (window.matchMedia("(max-width: 768px)").matches) {
          sidebar.classList.toggle("mobile-open");
        } else {
          document.getElementById("btn-toggle-sidebar")?.click();
        }
      });

      // Header Logout
      document.getElementById("btn-header-logout")?.addEventListener("click", async () => {
        await AuthService.logout();
      });

      // DB Setup trigger
      document.getElementById("btn-quick-setup-supabase")?.addEventListener("click", () => {
        openSupabaseConfigModal();
      });
    }

    // Render Mobile Bottom Navigation
    if (mobileNavMount) {
      mobileNavMount.innerHTML = renderMobileNav(this.currentProfile, this.currentRoute);
    }

    // Render Page Content
    let viewHtml = "";
    let activeViewModule = null;

    switch (this.currentRoute) {
      case "home":
        viewHtml = await HomeView.render();
        activeViewModule = HomeView;
        break;
      case "login":
        viewHtml = AuthView.render("login");
        activeViewModule = AuthView;
        break;
      case "register":
        viewHtml = AuthView.render("register");
        activeViewModule = AuthView;
        break;
      case "forgot-password":
        viewHtml = AuthView.render("forgot-password");
        activeViewModule = AuthView;
        break;
      case "reset-password":
        viewHtml = AuthView.render("reset-password");
        activeViewModule = AuthView;
        break;
      case "verify-email":
        viewHtml = AuthView.render("verify-email");
        activeViewModule = AuthView;
        break;
      case "customer":
        viewHtml = await CustomerView.render(this.currentProfile);
        activeViewModule = CustomerView;
        break;
      case "driver":
        viewHtml = await DriverView.render();
        activeViewModule = DriverView;
        break;
      case "cargo_owner":
        viewHtml = await CargoOwnerView.render();
        activeViewModule = CargoOwnerView;
        break;
      case "logistics":
        viewHtml = await LogisticsView.render();
        activeViewModule = LogisticsView;
        break;
      case "vehicle_owner":
        viewHtml = await VehicleOwnerView.render();
        activeViewModule = VehicleOwnerView;
        break;
      case "machinery_owner":
        viewHtml = await MachineryOwnerView.render();
        activeViewModule = MachineryOwnerView;
        break;
      case "machinery_hirer":
        viewHtml = await MachineryHirerView.render();
        activeViewModule = MachineryHirerView;
        break;
      case "owner":
        viewHtml = await OwnerView.render();
        activeViewModule = OwnerView;
        break;
      case "admin_login":
        viewHtml = AdminView.renderLogin();
        activeViewModule = { init: () => AdminView.initLogin() };
        break;
      case "admin":
        viewHtml = await AdminView.render();
        activeViewModule = AdminView;
        break;
      case "equipment":
        viewHtml = await EquipmentView.render();
        activeViewModule = EquipmentView;
        break;
      case "subscriptions":
        viewHtml = await SubscriptionsView.render();
        activeViewModule = SubscriptionsView;
        break;
      case "advertise":
        viewHtml = await AdvertiseView.render();
        activeViewModule = AdvertiseView;
        break;
      case "messages":
        viewHtml = await MessagesView.render(this.currentProfile);
        activeViewModule = MessagesView;
        break;
      case "profile":
        viewHtml = await ProfileView.render(this.currentProfile);
        activeViewModule = ProfileView;
        break;
      case "contact":
        viewHtml = await ContactView.render();
        activeViewModule = ContactView;
        break;
      case "support":
      case "safety":
      case "help":
      case "status":
        viewHtml = await SupportView.render(this.currentProfile);
        activeViewModule = SupportView;
        break;
      case "legal":
        viewHtml = await LegalView.render();
        activeViewModule = LegalView;
        break;
      case "business":
        viewHtml = await BusinessView.render();
        activeViewModule = BusinessView;
        break;
      default:
        viewHtml = await HomeView.render();
        activeViewModule = HomeView;
    }

    if (contentContainer) {
      contentContainer.innerHTML = viewHtml;

      if (activeViewModule && activeViewModule.init) {
        await activeViewModule.init(this.currentRoute);
      }
    }
  }
}

// Instantiate App
window.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init();
});
