// ============================================================================
// PHONE FORMATTER
// ============================================================================

/**
 * Format phone number to standard US format
 * 
 * @param phone - Phone number to format
 * @returns Formatted phone number
 * 
 * @example
 * formatPhone("1234567890") // "(123) 456-7890"
 * formatPhone("123-456-7890") // "(123) 456-7890"
 */
export function formatPhone(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Handle different lengths
  if (cleaned.length === 10) {
    // (XXX) XXX-XXXX
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    // +1 (XXX) XXX-XXXX
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  // Return as-is if not standard format
  return phone;
}

/**
 * Format phone number to E.164 format (+1XXXXXXXXXX)
 * 
 * @param phone - Phone number to format
 * @returns E.164 formatted phone number
 * 
 * @example
 * formatPhoneE164("(123) 456-7890") // "+11234567890"
 */
export function formatPhoneE164(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+${cleaned}`;
  }
  
  return phone;
}

/**
 * Parse phone number to just digits
 * 
 * @param phone - Phone number to parse
 * @returns Digits only
 * 
 * @example
 * parsePhone("(123) 456-7890") // "1234567890"
 */
export function parsePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Validate US phone number
 * 
 * @param phone - Phone number to validate
 * @returns True if valid
 * 
 * @example
 * isValidPhone("(123) 456-7890") // true
 * isValidPhone("123-4567") // false
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned[0] === '1');
}

/**
 * Mask phone number for display
 * 
 * @param phone - Phone number to mask
 * @returns Masked phone number
 * 
 * @example
 * maskPhone("(123) 456-7890") // "(***) ***-7890"
 */
export function maskPhone(phone: string): string {
  const formatted = formatPhone(phone);
  return formatted.replace(/\d(?=\d{4})/g, '*');
}
