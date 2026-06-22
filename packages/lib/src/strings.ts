/**
 * Capitalize the first letter of a string.
 * e.g. "confirmed" → "Confirmed"
 */
export function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
