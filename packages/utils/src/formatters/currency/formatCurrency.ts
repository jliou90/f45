// ============================================================================
// CURRENCY FORMATTER
// ============================================================================

/**
 * Format number as currency
 * 
 * @param amount - The amount to format
 * @param currency - Currency code (default: USD)
 * @param locale - Locale for formatting (default: en-US)
 * @returns Formatted currency string
 * 
 * @example
 * formatCurrency(1234.56) // "$1,234.56"
 * formatCurrency(1234.56, 'EUR') // "€1,234.56"
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Fallback to simple formatting
    return `$${amount.toFixed(2)}`;
  }
}

/**
 * Parse currency string to number
 * 
 * @param value - Currency string to parse
 * @returns Parsed number
 * 
 * @example
 * parseCurrency("$1,234.56") // 1234.56
 * parseCurrency("€1.234,56") // 1234.56
 */
export function parseCurrency(value: string): number {
  // Remove currency symbols and separators
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format number as compact currency (K, M, B)
 * 
 * @param amount - The amount to format
 * @param currency - Currency code (default: USD)
 * @returns Compact formatted currency string
 * 
 * @example
 * formatCurrencyCompact(1234) // "$1.2K"
 * formatCurrencyCompact(1234567) // "$1.2M"
 */
export function formatCurrencyCompact(
  amount: number,
  currency: string = 'USD'
): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  
  const formatWithSuffix = (value: number, suffix: string) => {
    const formatted = formatCurrency(value, currency);
    // Remove decimal if it's .00
    const cleaned = formatted.replace(/\.00$/, '');
    return `${sign}${cleaned}${suffix}`;
  };
  
  if (absAmount >= 1e9) {
    return formatWithSuffix(absAmount / 1e9, 'B');
  } else if (absAmount >= 1e6) {
    return formatWithSuffix(absAmount / 1e6, 'M');
  } else if (absAmount >= 1e3) {
    return formatWithSuffix(absAmount / 1e3, 'K');
  }
  
  return formatCurrency(amount, currency);
}

/**
 * Calculate percentage and format as string
 * 
 * @param value - The value
 * @param total - The total
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 * 
 * @example
 * formatPercentage(25, 100) // "25.0%"
 * formatPercentage(1, 3, 2) // "33.33%"
 */
export function formatPercentage(
  value: number,
  total: number,
  decimals: number = 1
): string {
  if (total === 0) return '0%';
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Add two currency amounts with proper decimal handling
 * 
 * @param a - First amount
 * @param b - Second amount
 * @returns Sum
 */
export function addCurrency(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100;
}

/**
 * Subtract currency amounts with proper decimal handling
 * 
 * @param a - First amount
 * @param b - Second amount
 * @returns Difference
 */
export function subtractCurrency(a: number, b: number): number {
  return Math.round((a - b) * 100) / 100;
}

/**
 * Multiply currency by quantity with proper decimal handling
 * 
 * @param amount - Currency amount
 * @param quantity - Quantity
 * @returns Product
 */
export function multiplyCurrency(amount: number, quantity: number): number {
  return Math.round(amount * quantity * 100) / 100;
}

/**
 * Calculate tax amount
 * 
 * @param amount - Pre-tax amount
 * @param taxRate - Tax rate (e.g., 0.08 for 8%)
 * @returns Tax amount
 */
export function calculateTax(amount: number, taxRate: number): number {
  return Math.round(amount * taxRate * 100) / 100;
}

/**
 * Calculate discount amount
 * 
 * @param amount - Original amount
 * @param discountPercent - Discount percentage (e.g., 10 for 10%)
 * @returns Discount amount
 */
export function calculateDiscount(amount: number, discountPercent: number): number {
  return Math.round(amount * (discountPercent / 100) * 100) / 100;
}

/**
 * Apply discount to amount
 * 
 * @param amount - Original amount
 * @param discountPercent - Discount percentage
 * @returns Amount after discount
 */
export function applyDiscount(amount: number, discountPercent: number): number {
  const discount = calculateDiscount(amount, discountPercent);
  return subtractCurrency(amount, discount);
}
