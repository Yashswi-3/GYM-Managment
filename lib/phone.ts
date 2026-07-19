/**
 * Normalizes a phone number to a stable comparison/storage key: digits only,
 * last 10 digits kept (drops a country code like +91 if present). This is
 * what makes "9876543210", "+91 98765 43210", and "091-9876543210" all
 * recognized as the same member at check-in, regardless of how it was
 * typed the first time vs. how it's typed today.
 */
export function normalizeMobile(input: string): string {
  const digitsOnly = input.replace(/\D/g, "");
  return digitsOnly.slice(-10);
}
