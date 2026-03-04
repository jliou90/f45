// ============================================================================
// MODEL TYPES - User & Organization
// ============================================================================

import type { BaseEntity, Address, ContactInfo } from '../common';
import type { 
  UserRole, 
  OrganizationType, 
  OrganizationStatus,
  SubscriptionPlan 
} from '../enums';

/**
 * Organization (Dealership/Shop)
 */
export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  type: OrganizationType;
  
  // Contact
  email?: string;
  phone?: string;
  website?: string;
  
  // Address
  address?: Address;
  
  // Business info
  taxId?: string;
  
  // Subscription
  plan: SubscriptionPlan;
  status: OrganizationStatus;
  trialEndsAt?: Date | string;
  subscriptionEndsAt?: Date | string;
  
  // Settings
  settings?: OrganizationSettings;
  
  // Relations (populated when needed)
  locations?: Location[];
  users?: User[];
}

/**
 * Organization settings
 */
export interface OrganizationSettings {
  // Business hours
  businessHours?: BusinessHours;
  
  // Features enabled
  features?: {
    service?: boolean;
    parts?: boolean;
    sales?: boolean;
    fi?: boolean;
  };
  
  // Integrations
  integrations?: {
    accounting?: IntegrationConfig;
    email?: IntegrationConfig;
    sms?: IntegrationConfig;
    payment?: IntegrationConfig;
  };
  
  // Branding
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  
  // Preferences
  preferences?: {
    timezone?: string;
    locale?: string;
    currency?: string;
    dateFormat?: string;
    timeFormat?: string;
  };
}

/**
 * Business hours configuration
 */
export interface BusinessHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

/**
 * Hours for a single day
 */
export interface DayHours {
  isOpen: boolean;
  openTime?: string; // HH:mm format
  closeTime?: string; // HH:mm format
  breaks?: TimeRange[];
}

/**
 * Time range
 */
export interface TimeRange {
  start: string; // HH:mm format
  end: string; // HH:mm format
}

/**
 * Integration configuration
 */
export interface IntegrationConfig {
  enabled: boolean;
  provider?: string;
  credentials?: Record<string, any>;
  settings?: Record<string, any>;
}

/**
 * Location (for multi-location organizations)
 */
export interface Location extends BaseEntity {
  organizationId: string;
  
  name: string;
  code?: string;
  
  // Contact
  email?: string;
  phone?: string;
  
  // Address
  address?: Address;
  
  // Operations
  timezone: string;
  businessHours?: BusinessHours;
  
  // Status
  isActive: boolean;
  
  // Relations
  organization?: Organization;
}

/**
 * User (Staff/Employee)
 */
export interface User extends BaseEntity {
  organizationId: string;
  locationId?: string;
  
  // Auth
  username: string;
  email: string;
  
  // Profile
  firstName: string;
  lastName: string;
  fullName?: string; // Computed: firstName + lastName
  phone?: string;
  avatar?: string;
  
  // Role
  role: UserRole;
  permissions?: string[];
  
  // Status
  isActive: boolean;
  emailVerified: boolean;
  
  // Metadata
  lastLoginAt?: Date | string;
  
  // Relations
  organization?: Organization;
  location?: Location;
}

/**
 * User with password (used only in auth flows)
 */
export interface UserWithPassword extends User {
  password: string;
}

/**
 * User profile (public-facing)
 */
export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  organization?: {
    id: string;
    name: string;
  };
}

/**
 * Session
 */
export interface Session extends BaseEntity {
  userId: string;
  token: string;
  expiresAt: Date | string;
  ipAddress?: string;
  userAgent?: string;
  
  // Relations
  user?: User;
}

/**
 * Refresh Token
 */
export interface RefreshToken extends BaseEntity {
  userId: string;
  token: string;
  expiresAt: Date | string;
  isRevoked: boolean;
  
  // Relations
  user?: User;
}

/**
 * Permission
 */
export interface Permission extends BaseEntity {
  name: string;
  description?: string;
  resource: string;
  action: string;
}

/**
 * Role
 */
export interface Role extends BaseEntity {
  name: string;
  description?: string;
  isSystem: boolean;
  
  // Relations
  permissions?: Permission[];
}

/**
 * Role with permission IDs (for assignment)
 */
export interface RoleWithPermissions extends Role {
  permissionIds: string[];
}
