// ==============================================================================
// TRANSMOVE SPA APPLICATION CONTROLLER & ROUTER
// Standardized Layout Shell: Left Sidebar + Top Header + Main Content
// ==============================================================================
import { AuthService } from "../../src/services/auth.js";
import { renderSidebar } from "../../src/components/Sidebar.js";
import { renderHeader, initHeaderNotifications, headerIcon } from "../../src/components/Header.js";
import { renderMobileNav } from "../../src/components/MobileNav.js";
import { ThemeService } from "../../src/services/theme.js";
import { DevicePermissionService } from "../../src/services/device-permissions.js";

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
import { OnboardingView } from "../../src/views/OnboardingView.js";

class App {
  constructor() {
    this.currentProfile = null;
    this.currentRoute = "home";
    this.sidebarCollapsed = localStorage.getItem("transmove_sidebar_collapsed") === "true";
    this.verificationUnsubscribe = null;
    this.verificationRefreshTimer = null;
    this.activeViewModule = null;
    this.onboardingActive = false;
  }

  async init() {
    // 1. Initial auth state fetch & approved roles hydration
    try {
      this.currentProfile = await AuthService.getCurrentProfile();
      if (this.currentProfile) {
        this.currentProfile.approvedRoles = await AuthService.getApprovedRoles(this.currentProfile);
        await this.startVerificationRealtime();
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
          await this.startVerificationRealtime();
        }
        if (["login", "register"].includes(this.currentRoute)) {
          if (sessionStorage.getItem("transmove_pending_request")) {
            window.location.hash = "#customer?tab=search";
          } else {
            window.location.hash = `#${this.getDefaultRoleRoute()}`;
          }
        } else if (this.currentRoute === "home" && sessionStorage.getItem("transmove_pending_request")) {
          window.location.hash = "#customer?tab=search";
        } else {
          this.render();
        }
      } else if (event === "SIGNED_OUT") {
        if (this.verificationUnsubscribe) this.verificationUnsubscribe();
        this.verificationUnsubscribe = null;
        this.currentProfile = null;
        this.currentRoute = "home";
        window.history.replaceState(null, "", "#home");
        await this.render();
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

    // 5. Global WhatsApp & Share listeners
    document.getElementById("btn-footer-whatsapp")?.addEventListener("click", () => {
      import("../../src/services/social.js").then(({ SocialService }) => {
        SocialService.launchWhatsAppSupport();
      });
    });

    document.getElementById("btn-footer-share")?.addEventListener("click", () => {
      import("../../src/services/social.js").then(({ SocialService }) => {
        SocialService.shareTransMove().then((res) => {
          if (res?.method === "clipboard") {
            alert("TransMove link copied to clipboard!");
          }
        });
      });
    });

    // Populate footer social links (only legitimately configured URLs)
    import("../../src/services/social.js").then(({ SocialService }) => {
      const socialContainer = document.getElementById("footer-social-links");
      if (socialContainer) {
        const links = SocialService.getSocialLinks();
        if (links.length > 0) {
          socialContainer.innerHTML = links.map(l => `
            <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" title="${l.label}">
              ${l.label}
            </a>
          `).join("");
        }
      }
    });

    // 6. Register PWA Service Worker
    if ("serviceWorker" in navigator && (window.location.protocol === "https:" || window.location.hostname === "localhost")) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("Notice: Service worker registration:", err.message);
      });
    }

    // 7. Global Theme Change Listener
    window.addEventListener("themechanged", (e) => {
      const theme = e.detail?.theme || ThemeService.getCurrentTheme();
      const btn = document.getElementById("btn-theme-toggle");
      if (btn) {
        btn.innerHTML = theme === "dark" ? headerIcon("sun", 20) : headerIcon("moon", 20);
        btn.setAttribute("title", theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode");
      }
    });

    // 8. Setup Android Back Button & Mobile Hardware Navigation
    this.setupAndroidBackButton();

    // 9. First-run permission onboarding. It is always skippable.
    if (!DevicePermissionService.hasSeenOnboarding()) {
      this.onboardingActive = true;
      const content = document.getElementById("app-root");
      if (content) {
        content.innerHTML = OnboardingView.render();
        const completion = new Promise((resolve) => {
          window.addEventListener("transmove:permissions-onboarding-complete", resolve, { once: true });
        });
        OnboardingView.init();
        await completion;
      } else {
        DevicePermissionService.markOnboardingSeen();
      }
      this.onboardingActive = false;
    }

    // Initial Route
    this.handleRoute();
  }

  setupAndroidBackButton() {
    if (typeof window === "undefined") return;

    const handleBack = () => {
      // 1. If mobile navigation drawer is open, close it
      const sidebar = document.getElementById("app-sidebar");
      const backdrop = document.getElementById("sidebar-mobile-backdrop");
      if (sidebar?.classList.contains("mobile-open")) {
        sidebar.classList.remove("mobile-open");
        backdrop?.classList.remove("active");
        return true;
      }

      // 2. If floating driver request card is open, dismiss it
      const driverCard = document.getElementById("driver-floating-request-card");
      if (driverCard) {
        const notInterestedBtn = document.getElementById("driver-btn-not-interested");
        if (notInterestedBtn) notInterestedBtn.click();
        else driverCard.remove();
        return true;
      }

      // 3. If smart sheet / popup modal is open, close it
      const smartBackdrop = document.getElementById("smart-popup-backdrop");
      if (smartBackdrop) {
        const closeBtn = smartBackdrop.querySelector(".smart-popup-close") || smartBackdrop.querySelector(".btn-outline");
        if (closeBtn) closeBtn.click();
        else smartBackdrop.remove();
        return true;
      }

      // 4. If any custom modal is open, close it
      const openModal = document.querySelector(".modal[style*='display: flex'], .modal[style*='display: block'], [id$='-modal'][style*='display: flex'], [id$='-modal'][style*='display: block']");
      if (openModal) {
        openModal.style.display = "none";
        return true;
      }

      // 5. If in a sub-view / query tab or details, return to main tab
      const currentHash = window.location.hash || "";
      if (currentHash.includes("?")) {
        window.location.hash = currentHash.split("?")[0];
        return true;
      }

      // 6. If on non-dashboard route, return to main view
      if (this.currentRoute !== "home" && this.currentRoute !== "customer" && this.currentRoute !== "driver") {
        window.location.hash = this.currentProfile?.role === "driver" ? "#driver" : "#customer";
        return true;
      }

      // 7. Normal Android exit
      if (window.Capacitor?.Plugins?.App?.exitApp) {
        window.Capacitor.Plugins.App.exitApp();
        return true;
      }
      return false;
    };

    if (window.Capacitor?.Plugins?.App) {
      window.Capacitor.Plugins.App.addListener("backButton", ({ canGoBack }) => {
        handleBack();
      });
    } else {
      window.addEventListener("ionBackButton", handleBack);
    }
  }

  getDefaultRoleRoute() {
    const primaryRole = AuthService.getPrimaryRole(this.currentProfile);
    return {
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
  }

  async startVerificationRealtime() {
    if (this.verificationUnsubscribe) this.verificationUnsubscribe();
    this.verificationUnsubscribe = null;
    if (!this.currentProfile) return;
    try {
      this.verificationUnsubscribe = await AuthService.subscribeToVerificationState(() => {
        clearTimeout(this.verificationRefreshTimer);
        this.verificationRefreshTimer = setTimeout(async () => {
          const latest = await AuthService.getCurrentProfile();
          if (!latest) return;
          latest.approvedRoles = await AuthService.getApprovedRoles(latest);
          this.currentProfile = latest;
          if (["profile", "driver", "vehicle_owner", "owner", "logistics"].includes(this.currentRoute)) {
            await this.render();
          }
        }, 150);
      });
    } catch (error) {
      console.warn("Verification realtime unavailable; navigation refresh remains active:", error.message);
    }
  }

  async handleRoute() {
    if (this.onboardingActive) return;
    const rawHash = window.location.hash.slice(1);
    let route = rawHash.split("?")[0];

    // Appwrite is the source of truth. Refresh the profile on navigation so
    // admin verification changes never depend on stale localStorage state.
    if (this.currentProfile) {
      const latestProfile = await AuthService.getCurrentProfile();
      if (latestProfile) {
        latestProfile.approvedRoles = await AuthService.getApprovedRoles(latestProfile);
        this.currentProfile = latestProfile;
      }
    }

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
      about: "contact",
      careers: "contact",
      partner: "business",
      terms: "legal",
      privacy: "legal"
    };

    route = routeAliasMap[route] || route;

    // Direct logout route handler
    if (route === "logout") {
      try {
        await AuthService.logout();
      } catch (_) {}
      this.currentProfile = null;
      this.currentRoute = "home";
      window.history.replaceState(null, "", "#home");
      await this.render();
      return;
    }

    // Direct dashboard entry for logged-in users visiting login or register
    if ((route === "login" || route === "register") && this.currentProfile) {
      if (sessionStorage.getItem("transmove_pending_request")) {
        window.location.hash = "#customer?tab=search";
      } else {
        window.location.hash = `#${this.getDefaultRoleRoute()}`;
      }
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
      "messages",
      "subscriptions"
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
          const targetHash = `#${this.getDefaultRoleRoute()}`;
          if (window.location.hash !== targetHash) {
            window.location.hash = targetHash;
          } else {
            await this.render();
          }
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
    if (this.activeViewModule?.destroy) {
      try {
        await this.activeViewModule.destroy();
      } catch (error) {
        console.warn("View cleanup notice:", error.message);
      }
    }
    this.activeViewModule = null;

    const sidebarMount = document.getElementById("sidebar-mount");
    const headerMount = document.getElementById("header-mount");
    const mobileNavMount = document.getElementById("mobile-nav-mount");
    const contentContainer = document.getElementById("app-root");
    const isAuthRoute = ["login", "register", "forgot-password", "reset-password", "verify-email"].includes(this.currentRoute);
    const isPassengerRoute = ["customer", "messages", "profile", "support", "help", "safety", "status"].includes(this.currentRoute)
      && ["customer", "passenger"].includes(this.currentProfile?.role);
    const isDriverRoute = ["driver", "messages", "profile", "subscriptions", "support", "help"].includes(this.currentRoute)
      && this.currentProfile?.role === "driver";
    document.body.classList.toggle("auth-route", isAuthRoute);
    document.body.classList.toggle("passenger-route", isPassengerRoute);
    document.body.classList.toggle("driver-route", isDriverRoute);

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

    const closeMobileSidebar = () => {
      document.getElementById("app-sidebar")?.classList.remove("mobile-open");
      document.getElementById("sidebar-mobile-backdrop")?.classList.remove("active");
      document.getElementById("btn-mobile-more")?.setAttribute("aria-expanded", "false");
      document.getElementById("btn-mobile-sidebar-trigger")?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("mobile-drawer-open");
    };

    const toggleMobileSidebar = () => {
      const sidebar = document.getElementById("app-sidebar");
      if (!sidebar || !window.matchMedia("(max-width: 768px)").matches) return;
      let backdrop = document.getElementById("sidebar-mobile-backdrop");
      if (!backdrop) {
        backdrop = document.createElement("div");
        backdrop.id = "sidebar-mobile-backdrop";
        backdrop.className = "sidebar-mobile-backdrop";
        backdrop.setAttribute("aria-hidden", "true");
        document.body.appendChild(backdrop);
        backdrop.addEventListener("click", closeMobileSidebar);
      }
      const isOpen = sidebar.classList.toggle("mobile-open");
      backdrop.classList.toggle("active", isOpen);
      document.getElementById("btn-mobile-more")?.setAttribute("aria-expanded", String(isOpen));
      document.getElementById("btn-mobile-sidebar-trigger")?.setAttribute("aria-expanded", String(isOpen));
      document.body.classList.toggle("mobile-drawer-open", isOpen);
      if (isOpen) document.getElementById("btn-close-mobile-sidebar")?.focus();
    };

    // Render Top Header
    if (headerMount) {
      headerMount.innerHTML = renderHeader(this.currentProfile, this.currentRoute);

      // Mobile Menu Trigger Listener
      document.getElementById("btn-mobile-sidebar-trigger")?.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 768px)").matches) {
          toggleMobileSidebar();
        } else {
          document.getElementById("btn-toggle-sidebar")?.click();
        }
      });

      // Close mobile drawer when clicking navigation links
      document.getElementById("app-sidebar")?.addEventListener("click", (e) => {
        if (e.target.closest("a") && window.matchMedia("(max-width: 768px)").matches) {
          closeMobileSidebar();
        }
      });

      document.getElementById("btn-close-mobile-sidebar")?.addEventListener("click", closeMobileSidebar);

      // Bind Global Theme Toggle
      document.getElementById("btn-theme-toggle")?.addEventListener("click", () => {
        const next = ThemeService.toggleTheme();
        const btn = document.getElementById("btn-theme-toggle");
        if (btn) {
          btn.innerHTML = next === "dark" ? headerIcon("sun", 20) : headerIcon("moon", 20);
          btn.setAttribute("title", next === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode");
        }
      });

      initHeaderNotifications(this.currentProfile);
    }

    // Render Mobile Bottom Navigation
    if (mobileNavMount) {
      mobileNavMount.innerHTML = renderMobileNav(this.currentProfile, this.currentRoute);
      document.getElementById("btn-mobile-more")?.addEventListener("click", toggleMobileSidebar);
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
      this.activeViewModule = activeViewModule;

      if (activeViewModule && activeViewModule.init) {
        await activeViewModule.init(this.currentRoute, this.currentProfile);
      }
    }
  }
}

// Instantiate App
window.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  window.__transmove_app = app;
  app.init();
});
