// ============================================================================
// AUTH MAPPERS
// ============================================================================
// Mappers convert between database entities and DTOs
// Benefits:
// - Separation of internal and external representations
// - Hide sensitive data (passwords, internal IDs)
// - Transform data shapes
// - Add computed fields
// ============================================================================

import type { User, Organization, Location, Session } from '@prisma/client';
import type {
  UserDto,
  OrganizationDto,
  LocationDto,
  SessionDto,
} from '../dto/auth.dto';

/**
 * User entity with relations
 */
type UserWithRelations = User & {
  organization: Organization;
  location: Location | null;
};

/**
 * Map User entity to UserDto
 * Removes sensitive data and formats for API response
 */
export function mapUserToDto(user: UserWithRelations): UserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    phone: user.phone || undefined,
    avatar: user.avatar || undefined,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt?.toISOString(),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    organization: mapOrganizationToDto(user.organization),
    location: user.location ? mapLocationToDto(user.location) : undefined,
  };
}

/**
 * Map Organization entity to OrganizationDto
 */
export function mapOrganizationToDto(org: Organization): OrganizationDto {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    type: org.type,
  };
}

/**
 * Map Location entity to LocationDto
 */
export function mapLocationToDto(location: Location): LocationDto {
  return {
    id: location.id,
    name: location.name,
    code: location.code || undefined,
  };
}

/**
 * Map Session entity to SessionDto
 */
export function mapSessionToDto(
  session: Session,
  currentToken?: string
): SessionDto {
  return {
    id: session.id,
    token: session.token,
    ipAddress: session.ipAddress || undefined,
    userAgent: session.userAgent || undefined,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    isCurrent: session.token === currentToken,
  };
}

/**
 * Map array of users to DTOs
 */
export function mapUsersToDto(users: UserWithRelations[]): UserDto[] {
  return users.map(mapUserToDto);
}

/**
 * Map array of sessions to DTOs
 */
export function mapSessionsToDto(
  sessions: Session[],
  currentToken?: string
): SessionDto[] {
  return sessions.map((session) => mapSessionToDto(session, currentToken));
}

/**
 * Sanitize user data (remove password and sensitive fields)
 * Used when we have a user object but don't have the full relations
 */
export function sanitizeUser(user: any): Partial<UserDto> {
  const { password, ...sanitized } = user;
  return {
    ...sanitized,
    fullName: `${user.firstName} ${user.lastName}`,
    lastLoginAt: user.lastLoginAt?.toISOString(),
    createdAt: user.createdAt?.toISOString(),
    updatedAt: user.updatedAt?.toISOString(),
  };
}
