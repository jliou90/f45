// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Capitalize first letter of string
 * 
 * @param str - String to capitalize
 * @returns Capitalized string
 * 
 * @example
 * capitalize("hello world") // "Hello world"
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Capitalize first letter of each word
 * 
 * @param str - String to capitalize
 * @returns Title cased string
 * 
 * @example
 * titleCase("hello world") // "Hello World"
 */
export function titleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => capitalize(word))
    .join(' ');
}

/**
 * Convert string to camelCase
 * 
 * @param str - String to convert
 * @returns camelCase string
 * 
 * @example
 * camelCase("hello world") // "helloWorld"
 */
export function camelCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
}

/**
 * Convert string to snake_case
 * 
 * @param str - String to convert
 * @returns snake_case string
 * 
 * @example
 * snakeCase("helloWorld") // "hello_world"
 */
export function snakeCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Convert string to kebab-case
 * 
 * @param str - String to convert
 * @returns kebab-case string
 * 
 * @example
 * kebabCase("helloWorld") // "hello-world"
 */
export function kebabCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}

/**
 * Truncate string to max length
 * 
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add (default: '...')
 * @returns Truncated string
 * 
 * @example
 * truncate("Hello World", 8) // "Hello..."
 */
export function truncate(
  str: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Remove extra whitespace from string
 * 
 * @param str - String to clean
 * @returns Cleaned string
 * 
 * @example
 * cleanWhitespace("  hello   world  ") // "hello world"
 */
export function cleanWhitespace(str: string): string {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Generate slug from string
 * 
 * @param str - String to slugify
 * @returns Slug string
 * 
 * @example
 * slugify("Hello World!") // "hello-world"
 */
export function slugify(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extract initials from name
 * 
 * @param name - Full name
 * @param maxInitials - Maximum number of initials (default: 2)
 * @returns Initials
 * 
 * @example
 * getInitials("John Doe") // "JD"
 * getInitials("John Michael Doe", 3) // "JMD"
 */
export function getInitials(name: string, maxInitials: number = 2): string {
  if (!name) return '';
  
  const words = name.trim().split(/\s+/);
  const initials = words
    .slice(0, maxInitials)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  
  return initials;
}

/**
 * Mask string (for sensitive data)
 * 
 * @param str - String to mask
 * @param visibleChars - Number of visible characters at end (default: 4)
 * @param maskChar - Character to use for masking (default: '*')
 * @returns Masked string
 * 
 * @example
 * maskString("1234567890", 4) // "******7890"
 */
export function maskString(
  str: string,
  visibleChars: number = 4,
  maskChar: string = '*'
): string {
  if (!str || str.length <= visibleChars) return str;
  
  const masked = maskChar.repeat(str.length - visibleChars);
  const visible = str.slice(-visibleChars);
  
  return masked + visible;
}

/**
 * Check if string is empty or whitespace only
 * 
 * @param str - String to check
 * @returns True if empty
 */
export function isEmpty(str: string | null | undefined): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Check if string contains substring (case-insensitive)
 * 
 * @param str - String to search in
 * @param search - Substring to search for
 * @returns True if contains
 */
export function contains(str: string, search: string): boolean {
  if (!str || !search) return false;
  return str.toLowerCase().includes(search.toLowerCase());
}

/**
 * Generate random string
 * 
 * @param length - Length of string (default: 10)
 * @param charset - Character set to use (default: alphanumeric)
 * @returns Random string
 */
export function randomString(
  length: number = 10,
  charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Pluralize word based on count
 * 
 * @param count - Count
 * @param singular - Singular form
 * @param plural - Plural form (optional, defaults to singular + 's')
 * @returns Pluralized word
 * 
 * @example
 * pluralize(1, "car") // "car"
 * pluralize(2, "car") // "cars"
 * pluralize(2, "person", "people") // "people"
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  if (count === 1) return singular;
  return plural || `${singular}s`;
}

/**
 * Escape HTML special characters
 * 
 * @param str - String to escape
 * @returns Escaped string
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  
  return str.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

/**
 * Strip HTML tags from string
 * 
 * @param str - String with HTML
 * @returns Plain text
 */
export function stripHtml(str: string): string {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '');
}
