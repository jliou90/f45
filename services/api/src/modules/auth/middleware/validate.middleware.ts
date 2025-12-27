// ============================================================================
// VALIDATE MIDDLEWARE
// ============================================================================
// Validates request data against Zod schemas
// Provides type-safe validation at the API boundary
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from '@/shared/errors/ApiError';
import { logger } from '@/core/logging/logger';

/**
 * Request validation target
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validate request data against Zod schema
 * 
 * Usage:
 *   router.post('/login', validate(loginSchema), controller.login);
 *   router.get('/users', validate(searchSchema, 'query'), controller.search);
 *   router.get('/users/:id', validate(idParamSchema, 'params'), controller.getById);
 * 
 * @param schema - Zod schema to validate against
 * @param target - Which part of request to validate (body, query, params)
 * @returns Express middleware function
 */
export function validate(
  schema: ZodSchema,
  target: ValidationTarget = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Get the data to validate based on target
      const dataToValidate = req[target];

      // Validate with Zod schema
      const result = schema.safeParse(dataToValidate);

      if (!result.success) {
        // Format Zod errors into readable format
        const errors = formatZodErrors(result.error);

        logger.warn('Validation failed', {
          target,
          path: req.path,
          errors,
        });

        // Return validation error
        throw ApiError.validationError('Validation failed', errors);
      }

      // Replace request data with validated (and potentially transformed) data
      // This ensures type safety and applies any Zod transformations
      req[target] = result.data;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate multiple parts of request
 * 
 * Usage:
 *   router.put('/users/:id', validateAll({
 *     params: idParamSchema,
 *     body: updateUserSchema
 *   }), controller.update);
 * 
 * @param schemas - Object mapping targets to schemas
 * @returns Express middleware function
 */
export function validateAll(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const errors: Record<string, any> = {};

      // Validate each target
      for (const [target, schema] of Object.entries(schemas)) {
        if (!schema) continue;

        const dataToValidate = req[target as ValidationTarget];
        const result = schema.safeParse(dataToValidate);

        if (!result.success) {
          errors[target] = formatZodErrors(result.error);
        } else {
          // Replace with validated data
          req[target as ValidationTarget] = result.data;
        }
      }

      // If any validation failed, throw error
      if (Object.keys(errors).length > 0) {
        logger.warn('Multi-target validation failed', {
          path: req.path,
          errors,
        });

        throw ApiError.validationError('Validation failed', errors);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate with custom error handling
 * 
 * Usage:
 *   router.post('/custom', validateWithHandler(
 *     schema,
 *     (error) => ApiError.badRequest('Custom error: ' + error.message)
 *   ), controller.method);
 * 
 * @param schema - Zod schema
 * @param errorHandler - Custom error handler
 * @param target - Validation target
 * @returns Express middleware function
 */
export function validateWithHandler(
  schema: ZodSchema,
  errorHandler: (error: ZodError) => Error,
  target: ValidationTarget = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = req[target];
      const result = schema.safeParse(dataToValidate);

      if (!result.success) {
        throw errorHandler(result.error);
      }

      req[target] = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate and sanitize
 * Validates with schema and applies additional sanitization
 * 
 * Usage:
 *   router.post('/comment', validateAndSanitize(
 *     commentSchema,
 *     (data) => ({ ...data, content: sanitizeHtml(data.content) })
 *   ), controller.create);
 * 
 * @param schema - Zod schema
 * @param sanitizer - Function to sanitize validated data
 * @param target - Validation target
 * @returns Express middleware function
 */
export function validateAndSanitize<T>(
  schema: ZodSchema<T>,
  sanitizer: (data: T) => T,
  target: ValidationTarget = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = req[target];
      const result = schema.safeParse(dataToValidate);

      if (!result.success) {
        const errors = formatZodErrors(result.error);
        throw ApiError.validationError('Validation failed', errors);
      }

      // Apply sanitization to validated data
      req[target] = sanitizer(result.data);

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate array of items
 * Useful for bulk operations
 * 
 * Usage:
 *   router.post('/users/bulk', validateArray(createUserSchema), controller.bulkCreate);
 * 
 * @param itemSchema - Schema for each item
 * @param target - Validation target (body.items, etc)
 * @returns Express middleware function
 */
export function validateArray(
  itemSchema: ZodSchema,
  target: string = 'body.items'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Navigate to nested property (e.g., body.items)
      const parts = target.split('.');
      let data: any = req;
      
      for (const part of parts) {
        data = data[part];
        if (data === undefined) {
          throw ApiError.badRequest(`Missing required field: ${target}`);
        }
      }

      // Ensure it's an array
      if (!Array.isArray(data)) {
        throw ApiError.badRequest(`Field ${target} must be an array`);
      }

      // Validate each item
      const validatedItems = [];
      const errors: Record<number, any> = {};

      for (let i = 0; i < data.length; i++) {
        const result = itemSchema.safeParse(data[i]);
        
        if (!result.success) {
          errors[i] = formatZodErrors(result.error);
        } else {
          validatedItems.push(result.data);
        }
      }

      // If any items failed validation
      if (Object.keys(errors).length > 0) {
        throw ApiError.validationError('Array validation failed', {
          invalidItems: errors,
          totalItems: data.length,
          failedItems: Object.keys(errors).length,
        });
      }

      // Replace with validated data
      let current: any = req;
      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = validatedItems;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Format Zod validation errors into readable structure
 * 
 * @param error - Zod error object
 * @returns Formatted errors object
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const issue of error.errors) {
    const path = issue.path.join('.') || 'root';
    
    if (!formatted[path]) {
      formatted[path] = [];
    }
    
    formatted[path].push(issue.message);
  }

  return formatted;
}

/**
 * Get first validation error message
 * Useful for simple error responses
 * 
 * @param error - Zod error object
 * @returns First error message
 */
export function getFirstError(error: ZodError): string {
  return error.errors[0]?.message || 'Validation error';
}

/**
 * Create validation middleware for common patterns
 */
export const commonValidations = {
  /**
   * Validate ID parameter
   */
  id: validate(
    require('zod').object({
      id: require('zod').string().uuid('Invalid ID format'),
    }),
    'params'
  ),

  /**
   * Validate pagination query
   */
  pagination: validate(
    require('zod').object({
      page: require('zod').coerce.number().int().min(1).default(1),
      limit: require('zod').coerce.number().int().min(1).max(100).default(20),
      sortBy: require('zod').string().optional(),
      sortOrder: require('zod').enum(['asc', 'desc']).default('desc'),
    }),
    'query'
  ),

  /**
   * Validate search query
   */
  search: validate(
    require('zod').object({
      q: require('zod').string().min(1).optional(),
      page: require('zod').coerce.number().int().min(1).default(1),
      limit: require('zod').coerce.number().int().min(1).max(100).default(20),
    }),
    'query'
  ),
};
