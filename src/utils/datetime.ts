/**
 * Date and time utility functions
 */

/**
 * Add minutes to a date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

/**
 * Add hours to a date
 */
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3600000);
}

/**
 * Check if date1 is before date2
 */
export function isBefore(date1: Date, date2: Date): boolean {
  return date1.getTime() < date2.getTime();
}

/**
 * Check if date1 is after date2
 */
export function isAfter(date1: Date, date2: Date): boolean {
  return date1.getTime() > date2.getTime();
}

/**
 * Get minutes until a future date
 */
export function minutesUntil(futureDate: Date): number {
  const now = new Date();
  const diff = futureDate.getTime() - now.getTime();
  return Math.floor(diff / 60000);
}

/**
 * Format time remaining in a human-readable way
 */
export function formatTimeRemaining(futureDate: Date): string {
  const minutes = minutesUntil(futureDate);
  
  if (minutes < 0) return 'Expired';
  if (minutes === 0) return 'Now';
  if (minutes < 60) return `${minutes}min`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format a full date and time
 */
export function formatDateTime(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const time = formatTimestamp(date);
  return `${day}/${month}/${year} ${time}`;
}

/**
 * Convert ISO string to Date
 */
export function parseISODate(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Get current timestamp as ISO string
 */
export function now(): string {
  return new Date().toISOString();
}
