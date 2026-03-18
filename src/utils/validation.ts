import { log } from './logger.js';

/**
 * Input validation utilities
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Validate and sanitize text input
 */
export function validateText(
  input: string,
  options: {
    minLength?: number;
    maxLength?: number;
    allowEmpty?: boolean;
    trimWhitespace?: boolean;
    allowSpecialChars?: boolean;
    customPattern?: RegExp;
  } = {}
): ValidationResult {
  const {
    minLength = 0,
    maxLength = 1000,
    allowEmpty = false,
    trimWhitespace = true,
    allowSpecialChars = true,
    customPattern,
  } = options;

  try {
    // Basic sanitization
    let sanitized = input;
    if (trimWhitespace) {
      sanitized = sanitized.trim();
    }

    // Check if empty
    if (!allowEmpty && sanitized.length === 0) {
      return { isValid: false, error: 'Input cannot be empty' };
    }

    // Length validation
    if (sanitized.length < minLength) {
      return { 
        isValid: false, 
        error: `Input must be at least ${minLength} characters long` 
      };
    }

    if (sanitized.length > maxLength) {
      return { 
        isValid: false, 
        error: `Input must be no more than ${maxLength} characters long` 
      };
    }

    // Special characters check (basic security)
    if (!allowSpecialChars) {
      const dangerousChars = /[<>'"&]/;
      if (dangerousChars.test(sanitized)) {
        return { 
          isValid: false, 
          error: 'Input contains invalid characters' 
        };
      }
    }

    // Custom pattern validation
    if (customPattern && !customPattern.test(sanitized)) {
      return { 
        isValid: false, 
        error: 'Input format is invalid' 
      };
    }

    // Additional sanitization for HTML
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    return { isValid: true, sanitized };
  } catch (error) {
    log.error('Error validating text input', { error: error as Error });
    return { isValid: false, error: 'Validation failed' };
  }
}

/**
 * Validate group title
 */
export function validateGroupTitle(title: string): ValidationResult {
  return validateText(title, {
    minLength: 3,
    maxLength: 100,
    allowEmpty: false,
    trimWhitespace: true,
  });
}

/**
 * Validate group description
 */
export function validateGroupDescription(description: string): ValidationResult {
  return validateText(description, {
    minLength: 0,
    maxLength: 500,
    allowEmpty: true,
    trimWhitespace: true,
  });
}

/**
 * Validate resource name
 */
export function validateResourceName(name: string): ValidationResult {
  return validateText(name, {
    minLength: 2,
    maxLength: 50,
    allowEmpty: false,
    trimWhitespace: true,
  });
}

/**
 * Validate resource description
 */
export function validateResourceDescription(description: string): ValidationResult {
  return validateText(description, {
    minLength: 0,
    maxLength: 200,
    allowEmpty: true,
    trimWhitespace: true,
  });
}

/**
 * Validate category name
 */
export function validateCategoryName(name: string): ValidationResult {
  return validateText(name, {
    minLength: 2,
    maxLength: 30,
    allowEmpty: false,
    trimWhitespace: true,
  });
}

/**
 * Validate category icon (emoji)
 */
export function validateCategoryIcon(icon: string): ValidationResult {
  const emojiPattern = /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]$/u;
  
  if (!icon || icon.length === 0) {
    return { isValid: false, error: 'Icon cannot be empty' };
  }

  if (icon.length > 2) {
    return { isValid: false, error: 'Icon must be a single emoji' };
  }

  if (!emojiPattern.test(icon)) {
    return { isValid: false, error: 'Icon must be a valid emoji' };
  }

  return { isValid: true, sanitized: icon };
}

/**
 * Validate UUID
 */
export function validateUUID(uuid: string): ValidationResult {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuid || uuid.length === 0) {
    return { isValid: false, error: 'ID cannot be empty' };
  }

  if (!uuidPattern.test(uuid)) {
    return { isValid: false, error: 'Invalid ID format' };
  }

  return { isValid: true, sanitized: uuid.toLowerCase() };
}

/**
 * Validate Telegram username
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || username.length === 0) {
    return { isValid: false, error: 'Username cannot be empty' };
  }

  // Remove @ if present
  let cleanUsername = username.startsWith('@') ? username.slice(1) : username;

  // Telegram username rules:
  // - 5-32 characters
  // - Can contain a-z, 0-9 and underscores
  // - Must start with a letter
  // - Cannot end with underscore
  // - Cannot have two consecutive underscores
  const usernamePattern = /^[a-zA-Z][a-zA-Z0-9_]{3,30}[a-zA-Z0-9]$/;
  
  if (cleanUsername.length < 5 || cleanUsername.length > 32) {
    return { isValid: false, error: 'Username must be between 5-32 characters' };
  }

  if (!usernamePattern.test(cleanUsername)) {
    return { isValid: false, error: 'Invalid username format (must start with letter, contain only letters/numbers/underscores)' };
  }

  if (cleanUsername.includes('__')) {
    return { isValid: false, error: 'Username cannot contain consecutive underscores' };
  }

  return { isValid: true, sanitized: cleanUsername };
}

/**
 * Validate number within range
 */
export function validateNumber(
  value: string | number,
  min?: number,
  max?: number
): ValidationResult {
  try {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;

    if (isNaN(num)) {
      return { isValid: false, error: 'Must be a valid number' };
    }

    if (min !== undefined && num < min) {
      return { 
        isValid: false, 
        error: `Number must be at least ${min}` 
      };
    }

    if (max !== undefined && num > max) {
      return { 
        isValid: false, 
        error: `Number must be at most ${max}` 
      };
    }

    return { isValid: true, sanitized: num.toString() };
  } catch (error) {
    log.error('Error validating number input', { error: error as Error });
    return { isValid: false, error: 'Invalid number' };
  }
}

/**
 * Validate telegram channel ID
 */
export function validateTelegramChannel(channelId: string): ValidationResult {
  // Telegram channel IDs can be:
  // - Numeric (e.g., "-1001234567890")
  // - Username (e.g., "@mychannel" or "mychannel")
  
  if (!channelId || channelId.length === 0) {
    return { isValid: false, error: 'Channel ID cannot be empty' };
  }

  let sanitized = channelId.trim();

  // Numeric channel ID
  if (sanitized.match(/^-?\d+$/)) {
    return { isValid: true, sanitized };
  }

  // Username format
  if (sanitized.startsWith('@')) {
    sanitized = sanitized.slice(1);
  }

  // Username validation (5-32 characters, alphanumeric + underscore)
  const usernamePattern = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/;
  if (!usernamePattern.test(sanitized)) {
    return { 
      isValid: false, 
      error: 'Channel username must be 5-32 characters, start with a letter, and contain only letters, numbers, and underscores' 
    };
  }

  return { isValid: true, sanitized: `@${sanitized}` };
}

/**
 * Sanitize input for safe display in Telegram messages
 */
export function sanitizeForTelegram(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\n{3,}/g, '\n\n')  // Limit consecutive newlines
    .trim();
}

/**
 * Validate and sanitize search query
 */
export function validateSearchQuery(query: string): ValidationResult {
  return validateText(query, {
    minLength: 1,
    maxLength: 100,
    allowEmpty: false,
    trimWhitespace: true,
  });
}