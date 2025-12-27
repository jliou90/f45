// ============================================================================
// ENUMS - Status Types and Constants
// ============================================================================

/**
 * User roles
 */
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  SERVICE_ADVISOR = 'service_advisor',
  TECHNICIAN = 'technician',
  PARTS_MANAGER = 'parts_manager',
  PARTS_COUNTER = 'parts_counter',
  SALESPERSON = 'salesperson',
  SALES_MANAGER = 'sales_manager',
  FI_MANAGER = 'fi_manager',
  RECEPTIONIST = 'receptionist',
  ACCOUNTANT = 'accountant',
}

/**
 * Organization types
 */
export enum OrganizationType {
  DEALERSHIP = 'dealership',
  SERVICE_SHOP = 'service_shop',
  PARTS_STORE = 'parts_store',
  BODY_SHOP = 'body_shop',
}

/**
 * Subscription plans
 */
export enum SubscriptionPlan {
  BASIC = 'basic',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

/**
 * Organization status
 */
export enum OrganizationStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
  TRIAL = 'trial',
}

/**
 * Customer types
 */
export enum CustomerType {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
}

/**
 * Preferred contact methods
 */
export enum ContactMethod {
  EMAIL = 'email',
  PHONE = 'phone',
  SMS = 'sms',
}

/**
 * Appointment statuses
 */
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  RESCHEDULED = 'rescheduled',
}

/**
 * Service types
 */
export enum ServiceType {
  MAINTENANCE = 'maintenance',
  REPAIR = 'repair',
  INSPECTION = 'inspection',
  DIAGNOSTIC = 'diagnostic',
  RECALL = 'recall',
  WARRANTY = 'warranty',
}

/**
 * Work order statuses
 */
export enum WorkOrderStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  WAITING_PARTS = 'waiting_parts',
  WAITING_APPROVAL = 'waiting_approval',
  COMPLETED = 'completed',
  INVOICED = 'invoiced',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

/**
 * Work order item types
 */
export enum WorkOrderItemType {
  LABOR = 'labor',
  PART = 'part',
  SUBLET = 'sublet',
  FEE = 'fee',
  DISCOUNT = 'discount',
  TAX = 'tax',
}

/**
 * Quote statuses
 */
export enum QuoteStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  VIEWED = 'viewed',
  APPROVED = 'approved',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CONVERTED = 'converted',
}

/**
 * Payment methods
 */
export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  CHECK = 'check',
  ACH = 'ach',
  FINANCING = 'financing',
  INSURANCE = 'insurance',
}

/**
 * Part categories
 */
export enum PartCategory {
  ENGINE = 'engine',
  TRANSMISSION = 'transmission',
  BRAKES = 'brakes',
  SUSPENSION = 'suspension',
  ELECTRICAL = 'electrical',
  BODY = 'body',
  INTERIOR = 'interior',
  EXHAUST = 'exhaust',
  COOLING = 'cooling',
  FUEL = 'fuel',
  FILTERS = 'filters',
  FLUIDS = 'fluids',
  ACCESSORIES = 'accessories',
  OTHER = 'other',
}

/**
 * Part transaction types
 */
export enum PartTransactionType {
  PURCHASE = 'purchase',
  SALE = 'sale',
  ADJUSTMENT = 'adjustment',
  TRANSFER = 'transfer',
  RETURN = 'return',
  DAMAGED = 'damaged',
  LOST = 'lost',
}

/**
 * Purchase order statuses
 */
export enum PurchaseOrderStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  CONFIRMED = 'confirmed',
  PARTIAL = 'partial',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

/**
 * Lead statuses
 */
export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  NEGOTIATING = 'negotiating',
  WON = 'won',
  LOST = 'lost',
}

/**
 * Lead sources
 */
export enum LeadSource {
  WEBSITE = 'website',
  PHONE = 'phone',
  WALK_IN = 'walk_in',
  REFERRAL = 'referral',
  SOCIAL_MEDIA = 'social_media',
  EMAIL = 'email',
  EVENT = 'event',
  ADVERTISEMENT = 'advertisement',
  OTHER = 'other',
}

/**
 * Vehicle inventory statuses
 */
export enum VehicleInventoryStatus {
  AVAILABLE = 'available',
  HOLD = 'hold',
  SOLD = 'sold',
  WHOLESALE = 'wholesale',
  TRADE = 'trade',
}

/**
 * Vehicle conditions
 */
export enum VehicleCondition {
  NEW = 'new',
  USED = 'used',
  CERTIFIED = 'certified',
}

/**
 * Deal statuses
 */
export enum DealStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  FUNDED = 'funded',
  DELIVERED = 'delivered',
  UNWOUND = 'unwound',
  CANCELLED = 'cancelled',
}

/**
 * Deal types
 */
export enum DealType {
  RETAIL = 'retail',
  LEASE = 'lease',
  WHOLESALE = 'wholesale',
  CASH = 'cash',
}

/**
 * F&I product categories
 */
export enum FIProductCategory {
  WARRANTY = 'warranty',
  GAP = 'gap',
  MAINTENANCE = 'maintenance',
  PROTECTION = 'protection',
  INSURANCE = 'insurance',
  THEFT = 'theft',
  TIRE_WHEEL = 'tire_wheel',
}

/**
 * Communication types
 */
export enum CommunicationType {
  EMAIL = 'email',
  SMS = 'sms',
  PHONE = 'phone',
  CHAT = 'chat',
  INTERNAL_NOTE = 'internal_note',
}

/**
 * Communication directions
 */
export enum CommunicationDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

/**
 * Communication statuses
 */
export enum CommunicationStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
  OPENED = 'opened',
  CLICKED = 'clicked',
}

/**
 * Customer touchpoint types
 */
export enum TouchpointType {
  WELCOME = 'welcome',
  SERVICE_REMINDER = 'service_reminder',
  BIRTHDAY = 'birthday',
  ANNIVERSARY = 'anniversary',
  REVIEW_REQUEST = 'review_request',
  FOLLOW_UP = 'follow_up',
  THANK_YOU = 'thank_you',
  REACTIVATION = 'reactivation',
}

/**
 * Touchpoint statuses
 */
export enum TouchpointStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  COMPLETED = 'completed',
}

/**
 * Permission resources
 */
export enum PermissionResource {
  USERS = 'users',
  CUSTOMERS = 'customers',
  VEHICLES = 'vehicles',
  APPOINTMENTS = 'appointments',
  WORK_ORDERS = 'work_orders',
  QUOTES = 'quotes',
  PARTS = 'parts',
  VENDORS = 'vendors',
  PURCHASE_ORDERS = 'purchase_orders',
  LEADS = 'leads',
  DEALS = 'deals',
  INVENTORY = 'inventory',
  FI_PRODUCTS = 'fi_products',
  COMMUNICATIONS = 'communications',
  REPORTS = 'reports',
  SETTINGS = 'settings',
}

/**
 * Permission actions
 */
export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXPORT = 'export',
  IMPORT = 'import',
}

/**
 * Notification types
 */
export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

/**
 * Days of week
 */
export enum DayOfWeek {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

/**
 * Time zones (common US zones)
 */
export enum TimeZone {
  EASTERN = 'America/New_York',
  CENTRAL = 'America/Chicago',
  MOUNTAIN = 'America/Denver',
  PACIFIC = 'America/Los_Angeles',
  ALASKA = 'America/Anchorage',
  HAWAII = 'Pacific/Honolulu',
}
