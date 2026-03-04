// ============================================================================
// COMMON TYPES
// ============================================================================

/**
 * Pagination parameters for list endpoints
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: Record<string, any>;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  field?: string;
  statusCode?: number;
}

/**
 * Validation error for form fields
 */
export interface ValidationError {
  field: string;
  message: string;
  rule: string;
}

/**
 * Filter operators
 */
export type FilterOperator = 
  | 'eq'      // Equal
  | 'ne'      // Not equal
  | 'gt'      // Greater than
  | 'gte'     // Greater than or equal
  | 'lt'      // Less than
  | 'lte'     // Less than or equal
  | 'in'      // In array
  | 'nin'     // Not in array
  | 'like'    // SQL LIKE
  | 'ilike'   // Case-insensitive LIKE
  | 'between' // Between two values
  | 'null'    // Is null
  | 'nnull';  // Is not null

/**
 * Generic filter structure
 */
export interface Filter {
  field: string;
  operator: FilterOperator;
  value: any;
}

/**
 * Search parameters
 */
export interface SearchParams extends PaginationParams {
  q?: string;
  filters?: Filter[];
}

/**
 * Date range filter
 */
export interface DateRange {
  start: Date | string;
  end: Date | string;
}

/**
 * ID types
 */
export type UUID = string;
export type ID = string | number;

/**
 * Timestamp fields
 */
export interface Timestamps {
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Soft delete fields
 */
export interface SoftDelete {
  deletedAt?: Date | string | null;
  isDeleted?: boolean;
}

/**
 * Base entity with timestamps
 */
export interface BaseEntity extends Timestamps {
  id: UUID;
}

/**
 * Entity with soft delete
 */
export interface SoftDeleteEntity extends BaseEntity, SoftDelete {}

/**
 * File upload metadata
 */
export interface FileMetadata {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  path?: string;
}

/**
 * Address structure
 */
export interface Address {
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

/**
 * Contact information
 */
export interface ContactInfo {
  email?: string;
  phone?: string;
  altPhone?: string;
}

/**
 * Money/Currency type
 */
export interface Money {
  amount: number;
  currency: string; // ISO 4217 code (USD, EUR, etc.)
}

/**
 * Audit trail entry
 */
export interface AuditEntry {
  id: UUID;
  entityType: string;
  entityId: UUID;
  action: 'create' | 'update' | 'delete';
  userId: UUID;
  userName: string;
  changes: Record<string, { old: any; new: any }>;
  timestamp: Date | string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Notification structure
 */
export interface Notification {
  id: UUID;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date | string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Feature flag
 */
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Generic key-value pair
 */
export interface KeyValuePair<T = any> {
  key: string;
  value: T;
  label?: string;
}

/**
 * Select option (for dropdowns)
 */
export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Coordinate (for maps)
 */
export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Time slot (for scheduling)
 */
export interface TimeSlot {
  start: Date | string;
  end: Date | string;
  available: boolean;
  metadata?: Record<string, any>;
}

/**
 * Custom field definition
 */
export interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'textarea';
  required: boolean;
  options?: SelectOption[];
  defaultValue?: any;
  validation?: Record<string, any>;
}

/**
 * Settings group
 */
export interface SettingsGroup {
  key: string;
  label: string;
  description?: string;
  settings: Setting[];
}

/**
 * Individual setting
 */
export interface Setting {
  key: string;
  label: string;
  description?: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'json';
  value: any;
  defaultValue: any;
  required: boolean;
  options?: SelectOption[];
}
