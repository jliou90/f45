// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/**
 * API Configuration
 */
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

/**
 * Authentication Configuration
 */
export const AUTH_CONFIG = {
  TOKEN_KEY: 'dms_access_token',
  REFRESH_TOKEN_KEY: 'dms_refresh_token',
  TOKEN_EXPIRY: 3600, // 1 hour in seconds
  REFRESH_TOKEN_EXPIRY: 604800, // 7 days in seconds
} as const;

/**
 * Pagination Defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  AVAILABLE_LIMITS: [10, 20, 50, 100],
} as const;

/**
 * Date/Time Formats
 */
export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  DISPLAY_LONG: 'MMMM dd, yyyy',
  DISPLAY_WITH_TIME: 'MMM dd, yyyy h:mm a',
  INPUT: 'yyyy-MM-dd',
  TIME: 'h:mm a',
  TIME_24: 'HH:mm',
} as const;

/**
 * Currency Configuration
 */
export const CURRENCY = {
  DEFAULT: 'USD',
  SYMBOL: '$',
  DECIMAL_PLACES: 2,
} as const;

/**
 * File Upload Limits
 */
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
} as const;

/**
 * Validation Rules
 */
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 50,
  PHONE_PATTERN: /^\+?[1-9]\d{1,14}$/,
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  VIN_LENGTH: 17,
  ZIP_PATTERN: /^\d{5}(-\d{4})?$/,
} as const;

/**
 * Table/List Configuration
 */
export const TABLE = {
  DEFAULT_SORT_ORDER: 'desc',
  LOADING_ROWS: 5,
} as const;

/**
 * Toast/Notification Configuration
 */
export const TOAST = {
  DURATION: 5000, // 5 seconds
  POSITION: 'top-right',
} as const;

/**
 * Feature Flags
 */
export const FEATURES = {
  ENABLE_DARK_MODE: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_REAL_TIME: false,
  ENABLE_ANALYTICS: true,
  ENABLE_CHAT: false,
} as const;

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
  GENERIC: 'An error occurred. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION: 'Please check your input and try again.',
  SERVER: 'Server error. Please try again later.',
} as const;

/**
 * Success Messages
 */
export const SUCCESS_MESSAGES = {
  CREATED: 'Successfully created.',
  UPDATED: 'Successfully updated.',
  DELETED: 'Successfully deleted.',
  SAVED: 'Successfully saved.',
} as const;

/**
 * Appointment Configuration
 */
export const APPOINTMENT = {
  DEFAULT_DURATION: 60, // minutes
  SLOT_INTERVAL: 15, // minutes
  BUFFER_TIME: 15, // minutes between appointments
  MAX_ADVANCE_BOOKING: 90, // days
  REMINDER_HOURS: 24, // hours before appointment
} as const;

/**
 * Work Order Configuration
 */
export const WORK_ORDER = {
  RO_NUMBER_PREFIX: 'WO',
  LABOR_RATE_DEFAULT: 125.00, // per hour
  TAX_RATE_DEFAULT: 0.08, // 8%
} as const;

/**
 * Quote Configuration
 */
export const QUOTE = {
  NUMBER_PREFIX: 'Q',
  VALID_DAYS: 30, // days
} as const;

/**
 * Parts Configuration
 */
export const PARTS = {
  LOW_STOCK_THRESHOLD: 5,
  REORDER_MULTIPLIER: 2,
} as const;

/**
 * Purchase Order Configuration
 */
export const PURCHASE_ORDER = {
  NUMBER_PREFIX: 'PO',
} as const;

/**
 * Deal Configuration
 */
export const DEAL = {
  NUMBER_PREFIX: 'DEAL',
} as const;
