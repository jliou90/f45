// ============================================================================
// ROLES & PERMISSIONS CONSTANTS
// ============================================================================

import { UserRole, PermissionResource, PermissionAction } from '@dms/types';

/**
 * Role definitions with display labels
 */
export const ROLES = {
  [UserRole.ADMIN]: {
    value: UserRole.ADMIN,
    label: 'Administrator',
    description: 'Full system access',
  },
  [UserRole.MANAGER]: {
    value: UserRole.MANAGER,
    label: 'Manager',
    description: 'Department management access',
  },
  [UserRole.SERVICE_ADVISOR]: {
    value: UserRole.SERVICE_ADVISOR,
    label: 'Service Advisor',
    description: 'Service department access',
  },
  [UserRole.TECHNICIAN]: {
    value: UserRole.TECHNICIAN,
    label: 'Technician',
    description: 'Work order execution',
  },
  [UserRole.PARTS_MANAGER]: {
    value: UserRole.PARTS_MANAGER,
    label: 'Parts Manager',
    description: 'Parts department management',
  },
  [UserRole.PARTS_COUNTER]: {
    value: UserRole.PARTS_COUNTER,
    label: 'Parts Counter',
    description: 'Parts sales and lookups',
  },
  [UserRole.SALESPERSON]: {
    value: UserRole.SALESPERSON,
    label: 'Salesperson',
    description: 'Sales department access',
  },
  [UserRole.SALES_MANAGER]: {
    value: UserRole.SALES_MANAGER,
    label: 'Sales Manager',
    description: 'Sales department management',
  },
  [UserRole.FI_MANAGER]: {
    value: UserRole.FI_MANAGER,
    label: 'F&I Manager',
    description: 'Finance & Insurance management',
  },
  [UserRole.RECEPTIONIST]: {
    value: UserRole.RECEPTIONIST,
    label: 'Receptionist',
    description: 'Front desk operations',
  },
  [UserRole.ACCOUNTANT]: {
    value: UserRole.ACCOUNTANT,
    label: 'Accountant',
    description: 'Financial operations',
  },
} as const;

/**
 * Permission matrix: Role → Resources → Actions
 */
export const ROLE_PERMISSIONS: Record<UserRole, Partial<Record<PermissionResource, PermissionAction[]>>> = {
  [UserRole.ADMIN]: {
    // Full access to everything
    [PermissionResource.USERS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.CUSTOMERS]: ['create', 'read', 'update', 'delete', 'export', 'import'],
    [PermissionResource.VEHICLES]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.APPOINTMENTS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.WORK_ORDERS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.QUOTES]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.PARTS]: ['create', 'read', 'update', 'delete', 'export', 'import'],
    [PermissionResource.VENDORS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.PURCHASE_ORDERS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.LEADS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.DEALS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.INVENTORY]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.FI_PRODUCTS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.COMMUNICATIONS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.REPORTS]: ['read', 'export'],
    [PermissionResource.SETTINGS]: ['read', 'update'],
  },
  
  [UserRole.MANAGER]: {
    [PermissionResource.USERS]: ['read'],
    [PermissionResource.CUSTOMERS]: ['create', 'read', 'update', 'export'],
    [PermissionResource.VEHICLES]: ['create', 'read', 'update'],
    [PermissionResource.APPOINTMENTS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.WORK_ORDERS]: ['create', 'read', 'update'],
    [PermissionResource.QUOTES]: ['create', 'read', 'update'],
    [PermissionResource.PARTS]: ['read', 'update'],
    [PermissionResource.REPORTS]: ['read', 'export'],
    [PermissionResource.COMMUNICATIONS]: ['create', 'read'],
  },
  
  [UserRole.SERVICE_ADVISOR]: {
    [PermissionResource.CUSTOMERS]: ['create', 'read', 'update'],
    [PermissionResource.VEHICLES]: ['create', 'read', 'update'],
    [PermissionResource.APPOINTMENTS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.WORK_ORDERS]: ['create', 'read', 'update'],
    [PermissionResource.QUOTES]: ['create', 'read', 'update'],
    [PermissionResource.PARTS]: ['read'],
    [PermissionResource.COMMUNICATIONS]: ['create', 'read'],
  },
  
  [UserRole.TECHNICIAN]: {
    [PermissionResource.CUSTOMERS]: ['read'],
    [PermissionResource.VEHICLES]: ['read'],
    [PermissionResource.APPOINTMENTS]: ['read'],
    [PermissionResource.WORK_ORDERS]: ['read', 'update'],
    [PermissionResource.PARTS]: ['read'],
  },
  
  [UserRole.PARTS_MANAGER]: {
    [PermissionResource.CUSTOMERS]: ['read'],
    [PermissionResource.PARTS]: ['create', 'read', 'update', 'delete', 'export', 'import'],
    [PermissionResource.VENDORS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.PURCHASE_ORDERS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.WORK_ORDERS]: ['read'],
    [PermissionResource.REPORTS]: ['read', 'export'],
  },
  
  [UserRole.PARTS_COUNTER]: {
    [PermissionResource.CUSTOMERS]: ['read'],
    [PermissionResource.PARTS]: ['read', 'update'],
    [PermissionResource.VENDORS]: ['read'],
    [PermissionResource.PURCHASE_ORDERS]: ['read'],
    [PermissionResource.WORK_ORDERS]: ['read'],
  },
  
  [UserRole.SALESPERSON]: {
    [PermissionResource.CUSTOMERS]: ['create', 'read', 'update'],
    [PermissionResource.VEHICLES]: ['read'],
    [PermissionResource.LEADS]: ['create', 'read', 'update'],
    [PermissionResource.DEALS]: ['create', 'read', 'update'],
    [PermissionResource.INVENTORY]: ['read'],
    [PermissionResource.COMMUNICATIONS]: ['create', 'read'],
  },
  
  [UserRole.SALES_MANAGER]: {
    [PermissionResource.CUSTOMERS]: ['create', 'read', 'update', 'export'],
    [PermissionResource.VEHICLES]: ['read'],
    [PermissionResource.LEADS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.DEALS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.INVENTORY]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.FI_PRODUCTS]: ['read'],
    [PermissionResource.COMMUNICATIONS]: ['create', 'read'],
    [PermissionResource.REPORTS]: ['read', 'export'],
  },
  
  [UserRole.FI_MANAGER]: {
    [PermissionResource.CUSTOMERS]: ['read'],
    [PermissionResource.DEALS]: ['read', 'update'],
    [PermissionResource.FI_PRODUCTS]: ['create', 'read', 'update', 'delete'],
    [PermissionResource.REPORTS]: ['read', 'export'],
  },
  
  [UserRole.RECEPTIONIST]: {
    [PermissionResource.CUSTOMERS]: ['create', 'read', 'update'],
    [PermissionResource.VEHICLES]: ['create', 'read'],
    [PermissionResource.APPOINTMENTS]: ['create', 'read', 'update'],
    [PermissionResource.COMMUNICATIONS]: ['create', 'read'],
  },
  
  [UserRole.ACCOUNTANT]: {
    [PermissionResource.CUSTOMERS]: ['read'],
    [PermissionResource.WORK_ORDERS]: ['read'],
    [PermissionResource.DEALS]: ['read'],
    [PermissionResource.PARTS]: ['read'],
    [PermissionResource.PURCHASE_ORDERS]: ['read'],
    [PermissionResource.REPORTS]: ['read', 'export'],
    [PermissionResource.SETTINGS]: ['read'],
  },
};

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): string[] {
  const permissions: string[] = [];
  const rolePerms = ROLE_PERMISSIONS[role];
  
  if (!rolePerms) return permissions;
  
  for (const [resource, actions] of Object.entries(rolePerms)) {
    for (const action of actions) {
      permissions.push(`${resource}:${action}`);
    }
  }
  
  return permissions;
}

/**
 * Check if role has specific permission
 */
export function hasPermission(
  role: UserRole,
  resource: PermissionResource,
  action: PermissionAction
): boolean {
  const rolePerms = ROLE_PERMISSIONS[role];
  if (!rolePerms) return false;
  
  const resourceActions = rolePerms[resource];
  if (!resourceActions) return false;
  
  return resourceActions.includes(action);
}

/**
 * Role hierarchy (higher number = more access)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.ADMIN]: 100,
  [UserRole.MANAGER]: 80,
  [UserRole.SALES_MANAGER]: 70,
  [UserRole.PARTS_MANAGER]: 70,
  [UserRole.FI_MANAGER]: 70,
  [UserRole.SERVICE_ADVISOR]: 50,
  [UserRole.SALESPERSON]: 40,
  [UserRole.PARTS_COUNTER]: 40,
  [UserRole.TECHNICIAN]: 30,
  [UserRole.RECEPTIONIST]: 20,
  [UserRole.ACCOUNTANT]: 20,
};

/**
 * Check if one role is higher than another
 */
export function isRoleHigher(role1: UserRole, role2: UserRole): boolean {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2];
}
