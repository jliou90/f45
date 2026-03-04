// ============================================================================
// API ERROR
// ============================================================================

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a 400 Bad Request error
   */
  static badRequest(message: string, details?: any): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  /**
   * Create a 401 Unauthorized error
   */
  static unauthorized(message: string = 'Unauthorized'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  /**
   * Create a 403 Forbidden error
   */
  static forbidden(message: string = 'Forbidden'): ApiError {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  /**
   * Create a 404 Not Found error
   */
  static notFound(resource: string = 'Resource'): ApiError {
    return new ApiError(404, 'NOT_FOUND', `${resource} not found`);
  }

  /**
   * Create a 409 Conflict error
   */
  static conflict(message: string): ApiError {
    return new ApiError(409, 'CONFLICT', message);
  }

  /**
   * Create a 422 Unprocessable Entity error
   */
  static validationError(message: string, details?: any): ApiError {
    return new ApiError(422, 'VALIDATION_ERROR', message, details);
  }

  /**
   * Create a 500 Internal Server Error
   */
  static internal(message: string = 'Internal server error'): ApiError {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}
