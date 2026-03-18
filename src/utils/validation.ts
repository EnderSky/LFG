import { CONFIG } from './constants.js';

/**
 * Validation utility functions
 */

/**
 * Validate player count
 */
export function isValidPlayerCount(count: number): boolean {
  return (
    Number.isInteger(count) &&
    count >= CONFIG.MIN_PLAYERS &&
    count <= CONFIG.MAX_PLAYERS
  );
}

/**
 * Validate that a scheduled time is not in the past
 */
export function isFutureDate(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Validate Telegram user ID
 */
export function isValidTelegramId(id: number): boolean {
  return Number.isInteger(id) && id > 0;
}

/**
 * Sanitize user input text
 */
export function sanitizeText(text: string, maxLength: number = 200): string {
  return text.trim().slice(0, maxLength);
}

/**
 * Validate group title
 */
export function isValidGroupTitle(title: string): boolean {
  const sanitized = sanitizeText(title);
  return sanitized.length >= 3 && sanitized.length <= 100;
}

/**
 * Validate resource name
 */
export function isValidResourceName(name: string): boolean {
  const sanitized = sanitizeText(name);
  return sanitized.length >= 2 && sanitized.length <= 50;
}

/**
 * Validate category name
 */
export function isValidCategoryName(name: string): boolean {
  const sanitized = sanitizeText(name);
  return sanitized.length >= 2 && sanitized.length <= 30;
}

/**
 * Validate emoji
 */
export function isValidEmoji(emoji: string): boolean {
  // Basic check for common emoji patterns
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  return emojiRegex.test(emoji) && emoji.length <= 4;
}
