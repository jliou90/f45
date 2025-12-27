// ============================================================================
// AUTH DTOs (Data Transfer Objects)
// ============================================================================
// DTOs define the shape of data coming in/out of the API
// Benefits:
// - Clear contract for API consumers
// - Type safety
// - Validation at the boundary
// - Hide internal implementation details
// ============================================================================

/**
 * Login Request DTO
 */
export interface LoginRequestDto {
  username: string;
  password: string;
}

/**
 * Login Response DTO
 */
export interface LoginResponseDto {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
}

/**
 * Register Request DTO
 */
export interface RegisterRequestDto {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  organizationId: string;
  locationId?: string;
  role: string;
}

/**
 * Register Response DTO
 */
export interface RegisterResponseDto {
  user: UserDto;
  message: string;
}

/**
 * User DTO (safe for external consumption - no password!)
 */
export interface UserDto {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  avatar?: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  organization: OrganizationDto;
  location?: LocationDto;
}

/**
 * Organization DTO (minimal)
 */
export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  type: string;
}

/**
 * Location DTO (minimal)
 */
export interface LocationDto {
  id: string;
  name: string;
  code?: string;
}

/**
 * Refresh Token Request DTO
 */
export interface RefreshTokenRequestDto {
  refreshToken: string;
}

/**
 * Refresh Token Response DTO
 */
export interface RefreshTokenResponseDto {
  accessToken: string;
  refreshToken: string;
}

/**
 * Change Password Request DTO
 */
export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
}

/**
 * Forgot Password Request DTO
 */
export interface ForgotPasswordRequestDto {
  email: string;
}

/**
 * Reset Password Request DTO
 */
export interface ResetPasswordRequestDto {
  token: string;
  password: string;
}

/**
 * Verify Email Request DTO
 */
export interface VerifyEmailRequestDto {
  token: string;
}

/**
 * Session DTO
 */
export interface SessionDto {
  id: string;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

/**
 * List Sessions Response DTO
 */
export interface ListSessionsResponseDto {
  sessions: SessionDto[];
  total: number;
}

/**
 * Revoke Session Request DTO
 */
export interface RevokeSessionRequestDto {
  sessionId: string;
}

/**
 * Update Profile Request DTO
 */
export interface UpdateProfileRequestDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
}

/**
 * Resend Verification Email Request DTO
 */
export interface ResendVerificationEmailRequestDto {
  email: string;
}
