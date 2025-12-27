// ============================================================================
// VALIDATORS
// ============================================================================

/**
 * Validate email address
 * 
 * @param email - Email to validate
 * @returns True if valid
 * 
 * @example
 * isValidEmail("user@example.com") // true
 * isValidEmail("invalid") // false
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate US phone number
 * 
 * @param phone - Phone number to validate
 * @returns True if valid
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned[0] === '1');
}

/**
 * Validate VIN (Vehicle Identification Number)
 * 
 * @param vin - VIN to validate
 * @returns True if valid
 * 
 * @example
 * isValidVIN("1HGBH41JXMN109186") // true
 * isValidVIN("123") // false
 */
export function isValidVIN(vin: string): boolean {
  if (!vin || vin.length !== 17) return false;
  
  // VIN uses all letters except I, O, Q
  const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i;
  if (!vinRegex.test(vin)) return false;
  
  // Check digit validation
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  const values: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
    J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
    0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
  };
  
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const char = vin[i].toUpperCase();
    const value = values[char];
    if (value === undefined) return false;
    sum += value * weights[i];
  }
  
  const checkDigit = sum % 11;
  const expectedCheckDigit = vin[8].toUpperCase();
  
  if (checkDigit === 10) {
    return expectedCheckDigit === 'X';
  }
  
  return checkDigit.toString() === expectedCheckDigit;
}

/**
 * Validate US ZIP code
 * 
 * @param zip - ZIP code to validate
 * @returns True if valid
 * 
 * @example
 * isValidZip("12345") // true
 * isValidZip("12345-6789") // true
 * isValidZip("123") // false
 */
export function isValidZip(zip: string): boolean {
  if (!zip) return false;
  
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zip);
}

/**
 * Validate URL
 * 
 * @param url - URL to validate
 * @returns True if valid
 */
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate credit card number (Luhn algorithm)
 * 
 * @param cardNumber - Card number to validate
 * @returns True if valid
 */
export function isValidCreditCard(cardNumber: string): boolean {
  if (!cardNumber) return false;
  
  const cleaned = cardNumber.replace(/\D/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) return false;
  
  let sum = 0;
  let isEven = false;
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

/**
 * Validate strong password
 * 
 * @param password - Password to validate
 * @param minLength - Minimum length (default: 8)
 * @returns Validation result with details
 */
export function validatePassword(
  password: string,
  minLength: number = 8
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!password) {
    errors.push('Password is required');
    return { valid: false, errors };
  }
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate username
 * 
 * @param username - Username to validate
 * @param minLength - Minimum length (default: 3)
 * @param maxLength - Maximum length (default: 50)
 * @returns True if valid
 */
export function isValidUsername(
  username: string,
  minLength: number = 3,
  maxLength: number = 50
): boolean {
  if (!username) return false;
  if (username.length < minLength || username.length > maxLength) return false;
  
  // Allow alphanumeric and underscores
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  return usernameRegex.test(username);
}

/**
 * Validate US Social Security Number
 * 
 * @param ssn - SSN to validate
 * @returns True if valid format
 */
export function isValidSSN(ssn: string): boolean {
  if (!ssn) return false;
  
  const cleaned = ssn.replace(/\D/g, '');
  if (cleaned.length !== 9) return false;
  
  // Basic format validation (XXX-XX-XXXX)
  const ssnRegex = /^\d{3}-?\d{2}-?\d{4}$/;
  return ssnRegex.test(ssn);
}

/**
 * Validate EIN (Employer Identification Number)
 * 
 * @param ein - EIN to validate
 * @returns True if valid format
 */
export function isValidEIN(ein: string): boolean {
  if (!ein) return false;
  
  // Format: XX-XXXXXXX
  const einRegex = /^\d{2}-?\d{7}$/;
  return einRegex.test(ein);
}
