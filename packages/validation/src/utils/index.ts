// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

import { z } from 'zod';

/**
 * Format Zod validation errors
 * 
 * @param error - Zod error object
 * @returns Formatted error messages
 */
export function formatZodError(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(err.message);
  });
  
  return formatted;
}

/**
 * Get first error message from Zod error
 * 
 * @param error - Zod error object
 * @returns First error message
 */
export function getFirstError(error: z.ZodError): string {
  return error.errors[0]?.message || 'Validation error';
}

/**
 * Validate data against schema
 * 
 * @param schema - Zod schema
 * @param data - Data to validate
 * @returns Validation result
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    errors: formatZodError(result.error),
  };
}

/**
 * Create a pagination schema
 */
export function createPaginationSchema() {
  return z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  });
}

/**
 * Create a search schema
 */
export function createSearchSchema() {
  return z.object({
    q: z.string().optional(),
    ...createPaginationSchema().shape,
  });
}

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID');

/**
 * ID param validation schema
 */
export const idParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Date range schema
 */
export const dateRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
}).refine(
  (data) => new Date(data.start) <= new Date(data.end),
  {
    message: 'Start date must be before or equal to end date',
  }
);
