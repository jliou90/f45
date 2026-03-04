// ============================================================================
// CUSTOMER VALIDATION SCHEMAS
// ============================================================================

import { z } from 'zod';

/**
 * Create customer schema
 */
export const createCustomerSchema = z.object({
  type: z.enum(['individual', 'business']),
  
  // Individual fields
  firstName: z.string().min(1, 'First name is required').max(50).optional(),
  lastName: z.string().min(1, 'Last name is required').max(50).optional(),
  
  // Business fields
  companyName: z.string().min(1, 'Company name is required').max(100).optional(),
  
  // Contact info
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().optional(),
  altPhone: z.string().optional(),
  
  // Address
  address1: z.string().max(100).optional(),
  address2: z.string().max(100).optional(),
  city: z.string().max(50).optional(),
  state: z.string().length(2, 'State must be 2 characters').optional(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code').optional(),
  
  // Business info
  taxId: z.string().optional(),
  
  // Preferences
  preferredContactMethod: z.enum(['email', 'phone', 'sms']).optional(),
  language: z.string().optional(),
  marketingOptIn: z.boolean().optional(),
  
  // Notes
  notes: z.string().optional(),
  customFields: z.record(z.any()).optional(),
}).refine(
  (data) => {
    if (data.type === 'individual') {
      return data.firstName && data.lastName;
    }
    if (data.type === 'business') {
      return data.companyName;
    }
    return false;
  },
  {
    message: 'For individuals, first and last name are required. For businesses, company name is required.',
  }
);

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

/**
 * Update customer schema (all fields optional)
 */
export const updateCustomerSchema = createCustomerSchema.partial();

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

/**
 * Create vehicle schema
 */
export const createVehicleSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  
  // Vehicle identification
  vin: z
    .string()
    .length(17, 'VIN must be 17 characters')
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/i, 'Invalid VIN format')
    .optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 2),
  make: z.string().min(1, 'Make is required').max(50),
  model: z.string().min(1, 'Model is required').max(50),
  trim: z.string().max(50).optional(),
  
  // Engine & transmission
  engine: z.string().max(50).optional(),
  transmission: z.string().max(50).optional(),
  drivetrain: z.string().max(50).optional(),
  
  // Details
  color: z.string().max(50).optional(),
  mileage: z.number().int().min(0).optional(),
  licensePlate: z.string().max(20).optional(),
  licenseState: z.string().length(2).optional(),
  
  // Ownership
  purchaseDate: z.string().datetime().optional(),
  purchasePrice: z.number().min(0).optional(),
  
  // Notes
  notes: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

/**
 * Update vehicle schema
 */
export const updateVehicleSchema = createVehicleSchema.partial().omit({ customerId: true });

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

/**
 * Customer search schema
 */
export const searchCustomersSchema = z.object({
  q: z.string().optional(),
  type: z.enum(['individual', 'business']).optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type SearchCustomersInput = z.infer<typeof searchCustomersSchema>;
