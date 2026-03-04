// ============================================================================
// ROUTES CONSTANTS
// ============================================================================

/**
 * API Routes (Backend)
 */
export const API_ROUTES = {
  // Auth
  AUTH: {
    BASE: '/api/v1/auth',
    LOGIN: '/api/v1/auth/login',
    LOGOUT: '/api/v1/auth/logout',
    REGISTER: '/api/v1/auth/register',
    REFRESH: '/api/v1/auth/refresh',
    ME: '/api/v1/auth/me',
    CHANGE_PASSWORD: '/api/v1/auth/change-password',
    FORGOT_PASSWORD: '/api/v1/auth/forgot-password',
    RESET_PASSWORD: '/api/v1/auth/reset-password',
  },
  
  // Users
  USERS: {
    BASE: '/api/v1/users',
    DETAIL: (id: string) => `/api/v1/users/${id}`,
    PROFILE: '/api/v1/users/me',
  },
  
  // Customers
  CUSTOMERS: {
    BASE: '/api/v1/customers',
    DETAIL: (id: string) => `/api/v1/customers/${id}`,
    VEHICLES: (id: string) => `/api/v1/customers/${id}/vehicles`,
    HISTORY: (id: string) => `/api/v1/customers/${id}/history`,
  },
  
  // Vehicles
  VEHICLES: {
    BASE: '/api/v1/vehicles',
    DETAIL: (id: string) => `/api/v1/vehicles/${id}`,
    HISTORY: (id: string) => `/api/v1/vehicles/${id}/history`,
  },
  
  // Appointments
  APPOINTMENTS: {
    BASE: '/api/v1/appointments',
    DETAIL: (id: string) => `/api/v1/appointments/${id}`,
    CALENDAR: '/api/v1/appointments/calendar',
    AVAILABILITY: '/api/v1/appointments/availability',
    CONFIRM: (id: string) => `/api/v1/appointments/${id}/confirm`,
    CANCEL: (id: string) => `/api/v1/appointments/${id}/cancel`,
  },
  
  // Work Orders
  WORK_ORDERS: {
    BASE: '/api/v1/work-orders',
    DETAIL: (id: string) => `/api/v1/work-orders/${id}`,
    ITEMS: (id: string) => `/api/v1/work-orders/${id}/items`,
    APPROVE: (id: string) => `/api/v1/work-orders/${id}/approve`,
    COMPLETE: (id: string) => `/api/v1/work-orders/${id}/complete`,
    INVOICE: (id: string) => `/api/v1/work-orders/${id}/invoice`,
  },
  
  // Quotes
  QUOTES: {
    BASE: '/api/v1/quotes',
    DETAIL: (id: string) => `/api/v1/quotes/${id}`,
    SEND: (id: string) => `/api/v1/quotes/${id}/send`,
    APPROVE: (id: string) => `/api/v1/quotes/${id}/approve`,
    CONVERT: (id: string) => `/api/v1/quotes/${id}/convert`,
  },
  
  // Parts
  PARTS: {
    BASE: '/api/v1/parts',
    DETAIL: (id: string) => `/api/v1/parts/${id}`,
    SEARCH: '/api/v1/parts/search',
    TRANSACTIONS: (id: string) => `/api/v1/parts/${id}/transactions`,
  },
  
  // Vendors
  VENDORS: {
    BASE: '/api/v1/vendors',
    DETAIL: (id: string) => `/api/v1/vendors/${id}`,
  },
  
  // Purchase Orders
  PURCHASE_ORDERS: {
    BASE: '/api/v1/purchase-orders',
    DETAIL: (id: string) => `/api/v1/purchase-orders/${id}`,
    RECEIVE: (id: string) => `/api/v1/purchase-orders/${id}/receive`,
  },
  
  // Sales - Leads
  LEADS: {
    BASE: '/api/v1/leads',
    DETAIL: (id: string) => `/api/v1/leads/${id}`,
    CONVERT: (id: string) => `/api/v1/leads/${id}/convert`,
  },
  
  // Sales - Inventory
  INVENTORY: {
    BASE: '/api/v1/inventory',
    DETAIL: (id: string) => `/api/v1/inventory/${id}`,
  },
  
  // Sales - Deals
  DEALS: {
    BASE: '/api/v1/deals',
    DETAIL: (id: string) => `/api/v1/deals/${id}`,
    APPROVE: (id: string) => `/api/v1/deals/${id}/approve`,
    DELIVER: (id: string) => `/api/v1/deals/${id}/deliver`,
  },
  
  // F&I
  FI: {
    PRODUCTS: '/api/v1/fi/products',
    PRODUCT_DETAIL: (id: string) => `/api/v1/fi/products/${id}`,
    LENDERS: '/api/v1/fi/lenders',
    LENDER_DETAIL: (id: string) => `/api/v1/fi/lenders/${id}`,
  },
  
  // Communications
  COMMUNICATIONS: {
    BASE: '/api/v1/communications',
    DETAIL: (id: string) => `/api/v1/communications/${id}`,
    SEND_EMAIL: '/api/v1/communications/email',
    SEND_SMS: '/api/v1/communications/sms',
  },
  
  // Reports
  REPORTS: {
    BASE: '/api/v1/reports',
    SALES: '/api/v1/reports/sales',
    SERVICE: '/api/v1/reports/service',
    PARTS: '/api/v1/reports/parts',
    FINANCIAL: '/api/v1/reports/financial',
  },
  
  // Dashboard
  DASHBOARD: {
    STATS: '/api/v1/dashboard/stats',
    RECENT_ACTIVITY: '/api/v1/dashboard/activity',
    CHARTS: '/api/v1/dashboard/charts',
  },
  
  // Settings
  SETTINGS: {
    BASE: '/api/v1/settings',
    ORGANIZATION: '/api/v1/settings/organization',
    USERS: '/api/v1/settings/users',
    INTEGRATIONS: '/api/v1/settings/integrations',
  },
  
  // Health
  HEALTH: '/health',
} as const;

/**
 * Frontend Routes (Pages)
 */
export const APP_ROUTES = {
  // Auth
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  
  // Dashboard
  HOME: '/',
  DASHBOARD: '/dashboard',
  
  // Customers
  CUSTOMERS: '/customers',
  CUSTOMER_DETAIL: (id: string) => `/customers/${id}`,
  CUSTOMER_NEW: '/customers/new',
  CUSTOMER_EDIT: (id: string) => `/customers/${id}/edit`,
  
  // Service
  SERVICE_SCHEDULER: '/service/scheduler',
  SERVICE_QUOTES: '/service/quotes',
  SERVICE_QUOTE_DETAIL: (id: string) => `/service/quotes/${id}`,
  SERVICE_QUOTE_NEW: '/service/quotes/new',
  SERVICE_WORK_ORDERS: '/service/work-orders',
  SERVICE_WORK_ORDER_DETAIL: (id: string) => `/service/work-orders/${id}`,
  SERVICE_WORK_ORDER_NEW: '/service/work-orders/new',
  
  // Parts
  PARTS_INVENTORY: '/parts/inventory',
  PARTS_INVENTORY_DETAIL: (id: string) => `/parts/inventory/${id}`,
  PARTS_INVENTORY_NEW: '/parts/inventory/new',
  PARTS_VENDORS: '/parts/vendors',
  PARTS_VENDOR_DETAIL: (id: string) => `/parts/vendors/${id}`,
  PARTS_PURCHASE_ORDERS: '/parts/purchase-orders',
  PARTS_PURCHASE_ORDER_DETAIL: (id: string) => `/parts/purchase-orders/${id}`,
  
  // Sales
  SALES_LEADS: '/sales/leads',
  SALES_LEAD_DETAIL: (id: string) => `/sales/leads/${id}`,
  SALES_INVENTORY: '/sales/inventory',
  SALES_INVENTORY_DETAIL: (id: string) => `/sales/inventory/${id}`,
  SALES_DEALS: '/sales/deals',
  SALES_DEAL_DETAIL: (id: string) => `/sales/deals/${id}`,
  
  // F&I
  FI_PRODUCTS: '/fi/products',
  FI_LENDERS: '/fi/lenders',
  FI_DEALS: '/fi/deals',
  
  // Communications
  COMMUNICATIONS: '/communications',
  COMMUNICATION_DETAIL: (id: string) => `/communications/${id}`,
  
  // Reports
  REPORTS: '/reports',
  REPORTS_SALES: '/reports/sales',
  REPORTS_SERVICE: '/reports/service',
  REPORTS_FINANCIAL: '/reports/financial',
  
  // Users
  USERS: '/users',
  USER_DETAIL: (id: string) => `/users/${id}`,
  USER_NEW: '/users/new',
  
  // Settings
  SETTINGS: '/settings',
  SETTINGS_GENERAL: '/settings/general',
  SETTINGS_ORGANIZATION: '/settings/organization',
  SETTINGS_LOCATIONS: '/settings/locations',
  SETTINGS_USERS: '/settings/users',
  SETTINGS_ROLES: '/settings/roles',
  SETTINGS_SECURITY: '/settings/security',
  SETTINGS_INTEGRATIONS: '/settings/integrations',
  SETTINGS_NOTIFICATIONS: '/settings/notifications',
  SETTINGS_BILLING: '/settings/billing',
  
  // Profile
  PROFILE: '/profile',
} as const;

/**
 * Navigation menu structure
 */
export const NAVIGATION = [
  {
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    href: APP_ROUTES.HOME,
  },
  {
    label: 'Customers',
    icon: 'Users',
    href: APP_ROUTES.CUSTOMERS,
  },
  {
    label: 'Service',
    icon: 'Wrench',
    items: [
      { label: 'Scheduler', href: APP_ROUTES.SERVICE_SCHEDULER },
      { label: 'Quotes', href: APP_ROUTES.SERVICE_QUOTES },
      { label: 'Work Orders', href: APP_ROUTES.SERVICE_WORK_ORDERS },
    ],
  },
  {
    label: 'Parts',
    icon: 'Package',
    items: [
      { label: 'Inventory', href: APP_ROUTES.PARTS_INVENTORY },
      { label: 'Vendors', href: APP_ROUTES.PARTS_VENDORS },
      { label: 'Purchase Orders', href: APP_ROUTES.PARTS_PURCHASE_ORDERS },
    ],
  },
  {
    label: 'Sales',
    icon: 'TrendingUp',
    items: [
      { label: 'Leads', href: APP_ROUTES.SALES_LEADS },
      { label: 'Inventory', href: APP_ROUTES.SALES_INVENTORY },
      { label: 'Deals', href: APP_ROUTES.SALES_DEALS },
    ],
  },
  {
    label: 'F&I',
    icon: 'DollarSign',
    items: [
      { label: 'Products', href: APP_ROUTES.FI_PRODUCTS },
      { label: 'Lenders', href: APP_ROUTES.FI_LENDERS },
      { label: 'Deals', href: APP_ROUTES.FI_DEALS },
    ],
  },
  {
    label: 'Communications',
    icon: 'MessageSquare',
    href: APP_ROUTES.COMMUNICATIONS,
  },
  {
    label: 'Reports',
    icon: 'BarChart',
    href: APP_ROUTES.REPORTS,
  },
  {
    label: 'Settings',
    icon: 'Settings',
    href: APP_ROUTES.SETTINGS,
  },
] as const;
