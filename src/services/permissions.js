// ==============================================================================
// TRANSMOVE CENTRALIZED PERMISSION MATRIX SERVICE
// Enforces Role-Based Access Control (RBAC) across all 15 TransMove platform roles
// ==============================================================================

export const PERMISSIONS = {
  // Passenger Permissions
  PASSENGER_REQUEST_CREATE: "transport.request.create",
  PASSENGER_REQUEST_VIEW: "transport.request.view_own",
  PASSENGER_OFFER_RECEIVE: "transport.offer.receive",
  PASSENGER_OFFER_ACCEPT: "transport.offer.accept",
  PASSENGER_TRIP_VIEW: "trip.view_own",
  PASSENGER_PAYMENT_MAKE: "payment.make",
  PASSENGER_REVIEW_CREATE: "review.create",

  // Driver Permissions
  DRIVER_FEED_VIEW: "driver.feed.view",
  DRIVER_OFFER_SUBMIT: "driver.offer.submit",
  DRIVER_TRIP_UPDATE: "driver.trip.update_status",
  DRIVER_VEHICLE_MANAGE: "driver.vehicle.manage",
  DRIVER_DOCUMENT_UPLOAD: "driver.document.upload",
  DRIVER_EARNINGS_VIEW: "driver.earnings.view",

  // Cargo & Logistics Permissions
  CARGO_REQUEST_CREATE: "cargo.request.create",
  LOGISTICS_FLEET_MANAGE: "logistics.fleet.manage",
  LOGISTICS_OFFER_SUBMIT: "logistics.offer.submit",

  // Owner Permissions
  VEHICLE_RENTAL_MANAGE: "vehicle.rental.manage",
  MACHINERY_RENTAL_MANAGE: "machinery.rental.manage",
  MACHINERY_LIST: "machinery.list",
  MACHINERY_IMAGE_UPLOAD: "machinery.image.upload",
  MACHINERY_AVAILABILITY_MANAGE: "machinery.availability.manage",
  MACHINERY_BOOKINGS_RECEIVE: "machinery.bookings.receive",
  MACHINERY_DASHBOARD_ACCESS: "machinery.dashboard.access",

  // Business Permissions
  BUSINESS_MANAGE: "business.manage",
  BUSINESS_DISPATCH: "business.dispatch",
  BUSINESS_FINANCE_VIEW: "business.finance.view",

  // Advertiser Permissions
  ADVERTISER_CAMPAIGN_MANAGE: "advertiser.campaign.manage",

  // Admin Permissions
  ADMIN_ACCESS: "admin.access",
  ADMIN_USERS_MANAGE: "admin.users.manage",
  ADMIN_VERIFICATION_MANAGE: "admin.verification.manage",
  ADMIN_PAYMENTS_MANAGE: "admin.payments.manage"
};

const ROLE_PERMISSIONS_MAP = {
  passenger: [
    PERMISSIONS.PASSENGER_REQUEST_CREATE,
    PERMISSIONS.PASSENGER_REQUEST_VIEW,
    PERMISSIONS.PASSENGER_OFFER_RECEIVE,
    PERMISSIONS.PASSENGER_OFFER_ACCEPT,
    PERMISSIONS.PASSENGER_TRIP_VIEW,
    PERMISSIONS.PASSENGER_PAYMENT_MAKE,
    PERMISSIONS.PASSENGER_REVIEW_CREATE
  ],
  driver: [
    PERMISSIONS.DRIVER_FEED_VIEW,
    PERMISSIONS.DRIVER_OFFER_SUBMIT,
    PERMISSIONS.DRIVER_TRIP_UPDATE,
    PERMISSIONS.DRIVER_VEHICLE_MANAGE,
    PERMISSIONS.DRIVER_DOCUMENT_UPLOAD,
    PERMISSIONS.DRIVER_EARNINGS_VIEW,
    PERMISSIONS.PASSENGER_TRIP_VIEW
  ],
  cargo_owner: [
    PERMISSIONS.CARGO_REQUEST_CREATE,
    PERMISSIONS.PASSENGER_OFFER_RECEIVE,
    PERMISSIONS.PASSENGER_OFFER_ACCEPT,
    PERMISSIONS.PASSENGER_PAYMENT_MAKE
  ],
  logistics_provider: [
    PERMISSIONS.LOGISTICS_FLEET_MANAGE,
    PERMISSIONS.LOGISTICS_OFFER_SUBMIT,
    PERMISSIONS.DRIVER_EARNINGS_VIEW,
    PERMISSIONS.DRIVER_DOCUMENT_UPLOAD
  ],
  vehicle_owner: [
    PERMISSIONS.VEHICLE_RENTAL_MANAGE,
    PERMISSIONS.DRIVER_EARNINGS_VIEW
  ],
  machinery_owner: [
    PERMISSIONS.MACHINERY_LIST,
    PERMISSIONS.MACHINERY_IMAGE_UPLOAD,
    PERMISSIONS.MACHINERY_AVAILABILITY_MANAGE,
    PERMISSIONS.MACHINERY_BOOKINGS_RECEIVE,
    PERMISSIONS.MACHINERY_RENTAL_MANAGE,
    PERMISSIONS.MACHINERY_DASHBOARD_ACCESS,
    PERMISSIONS.DRIVER_EARNINGS_VIEW,
    PERMISSIONS.DRIVER_DOCUMENT_UPLOAD
  ],
  machinery_hirer: [
    PERMISSIONS.CARGO_REQUEST_CREATE,
    PERMISSIONS.PASSENGER_PAYMENT_MAKE
  ],
  business_owner: [
    PERMISSIONS.BUSINESS_MANAGE,
    PERMISSIONS.BUSINESS_DISPATCH,
    PERMISSIONS.BUSINESS_FINANCE_VIEW,
    PERMISSIONS.CARGO_REQUEST_CREATE
  ],
  business_admin: [
    PERMISSIONS.BUSINESS_MANAGE,
    PERMISSIONS.BUSINESS_DISPATCH
  ],
  business_dispatcher: [
    PERMISSIONS.BUSINESS_DISPATCH
  ],
  business_finance: [
    PERMISSIONS.BUSINESS_FINANCE_VIEW
  ],
  business_employee: [
    PERMISSIONS.PASSENGER_REQUEST_CREATE
  ],
  advertiser: [
    PERMISSIONS.ADVERTISER_CAMPAIGN_MANAGE
  ],
  admin: Object.values(PERMISSIONS) // Admin possesses all platform permissions
};

export const PermissionService = {
  /**
   * Evaluates if a role or user profile possesses a specific permission.
   */
  can(userProfileOrRole, permissionKey) {
    if (!userProfileOrRole) return false;

    let role = typeof userProfileOrRole === "string" ? userProfileOrRole : userProfileOrRole.role;
    
    // Normalize customer alias
    if (role === "customer") role = "passenger";
    if (role === "owner") role = "machinery_owner";
    if (role === "business") role = "business_owner";
    if (role === "logistics") role = "logistics_provider";

    // Admin bypass
    if (role === "admin") return true;

    const allowedPermissions = ROLE_PERMISSIONS_MAP[role] || [];
    return allowedPermissions.includes(permissionKey);
  }
};
