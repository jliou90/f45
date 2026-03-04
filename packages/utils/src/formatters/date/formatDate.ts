// ============================================================================
// DATE FORMATTER
// ============================================================================

import { format, parseISO, formatDistance, formatRelative, isValid } from 'date-fns';

/**
 * Format date to display format
 * 
 * @param date - Date to format
 * @param formatString - Format string (default: 'MMM dd, yyyy')
 * @returns Formatted date string
 * 
 * @example
 * formatDate(new Date('2024-01-15')) // "Jan 15, 2024"
 * formatDate('2024-01-15', 'yyyy-MM-dd') // "2024-01-15"
 */
export function formatDate(
  date: Date | string | number,
  formatString: string = 'MMM dd, yyyy'
): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    if (!isValid(dateObj)) return 'Invalid date';
    return format(dateObj, formatString);
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Format date with time
 * 
 * @param date - Date to format
 * @returns Formatted date-time string
 * 
 * @example
 * formatDateTime(new Date('2024-01-15T14:30:00')) // "Jan 15, 2024 2:30 PM"
 */
export function formatDateTime(date: Date | string | number): string {
  return formatDate(date, 'MMM dd, yyyy h:mm a');
}

/**
 * Format time only
 * 
 * @param date - Date to format
 * @param use24Hour - Use 24-hour format (default: false)
 * @returns Formatted time string
 * 
 * @example
 * formatTime(new Date('2024-01-15T14:30:00')) // "2:30 PM"
 * formatTime(new Date('2024-01-15T14:30:00'), true) // "14:30"
 */
export function formatTime(
  date: Date | string | number,
  use24Hour: boolean = false
): string {
  const formatString = use24Hour ? 'HH:mm' : 'h:mm a';
  return formatDate(date, formatString);
}

/**
 * Format date for input field (yyyy-MM-dd)
 * 
 * @param date - Date to format
 * @returns ISO date string
 * 
 * @example
 * formatDateInput(new Date('2024-01-15')) // "2024-01-15"
 */
export function formatDateInput(date: Date | string | number): string {
  return formatDate(date, 'yyyy-MM-dd');
}

/**
 * Format time for input field (HH:mm)
 * 
 * @param date - Date to format
 * @returns Time string
 * 
 * @example
 * formatTimeInput(new Date('2024-01-15T14:30:00')) // "14:30"
 */
export function formatTimeInput(date: Date | string | number): string {
  return formatDate(date, 'HH:mm');
}

/**
 * Format relative time (e.g., "2 hours ago")
 * 
 * @param date - Date to format
 * @param baseDate - Base date to compare against (default: now)
 * @returns Relative time string
 * 
 * @example
 * formatRelativeTime(new Date('2024-01-15T12:00:00')) // "2 hours ago"
 */
export function formatRelativeTime(
  date: Date | string | number,
  baseDate: Date = new Date()
): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    if (!isValid(dateObj)) return 'Invalid date';
    return formatDistance(dateObj, baseDate, { addSuffix: true });
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Format relative date (e.g., "yesterday at 2:30 PM")
 * 
 * @param date - Date to format
 * @param baseDate - Base date to compare against (default: now)
 * @returns Relative date string
 * 
 * @example
 * formatRelativeDate(new Date('2024-01-14')) // "yesterday at 12:00 AM"
 */
export function formatRelativeDate(
  date: Date | string | number,
  baseDate: Date = new Date()
): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    if (!isValid(dateObj)) return 'Invalid date';
    return formatRelative(dateObj, baseDate);
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Parse date string to Date object
 * 
 * @param dateString - Date string to parse
 * @returns Date object or null if invalid
 */
export function parseDate(dateString: string): Date | null {
  try {
    const date = parseISO(dateString);
    return isValid(date) ? date : null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if date is valid
 * 
 * @param date - Date to check
 * @returns True if valid
 */
export function isValidDate(date: Date | string | number): boolean {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isValid(dateObj);
  } catch (error) {
    return false;
  }
}

/**
 * Get start of day
 * 
 * @param date - Date
 * @returns Date at 00:00:00
 */
export function startOfDay(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const result = new Date(dateObj);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day
 * 
 * @param date - Date
 * @returns Date at 23:59:59.999
 */
export function endOfDay(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const result = new Date(dateObj);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Add days to date
 * 
 * @param date - Date
 * @param days - Number of days to add
 * @returns New date
 */
export function addDays(date: Date | string, days: number): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
  const result = new Date(dateObj);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Subtract days from date
 * 
 * @param date - Date
 * @param days - Number of days to subtract
 * @returns New date
 */
export function subtractDays(date: Date | string, days: number): Date {
  return addDays(date, -days);
}

/**
 * Get difference in days between two dates
 * 
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Difference in days
 */
export function differenceInDays(
  date1: Date | string,
  date2: Date | string
): number {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if date is today
 * 
 * @param date - Date to check
 * @returns True if today
 */
export function isToday(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const today = new Date();
  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if date is in the past
 * 
 * @param date - Date to check
 * @returns True if in the past
 */
export function isPast(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return dateObj < new Date();
}

/**
 * Check if date is in the future
 * 
 * @param date - Date to check
 * @returns True if in the future
 */
export function isFuture(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return dateObj > new Date();
}
