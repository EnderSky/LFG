import { NextFunction } from 'grammy';
import { BotContext } from '../types/index.js';
import { log } from '../utils/logger.js';

/**
 * Rate limiting middleware to prevent spam and abuse
 */

interface RateLimitEntry {
  count: number;
  lastReset: number;
  lastRequest: number;
}

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
  cooldownMs?: number;  // Cooldown between requests
  skipSuccessfulAfter?: number;  // Skip rate limiting after N successful requests
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor() {
    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Register a rate limit configuration
   */
  register(key: string, config: RateLimitConfig): void {
    this.configs.set(key, config);
  }

  /**
   * Check if request should be rate limited
   */
  checkLimit(userId: number, key: string): { allowed: boolean; resetTime?: number } {
    const config = this.configs.get(key);
    if (!config) {
      // No rate limit configured for this key
      return { allowed: true };
    }

    const now = Date.now();
    const storeKey = `${userId}:${key}`;
    const entry = this.store.get(storeKey);

    if (!entry) {
      // First request
      this.store.set(storeKey, {
        count: 1,
        lastReset: now,
        lastRequest: now,
      });
      return { allowed: true };
    }

    // Check if window has expired
    if (now - entry.lastReset >= config.windowMs) {
      // Reset window
      this.store.set(storeKey, {
        count: 1,
        lastReset: now,
        lastRequest: now,
      });
      return { allowed: true };
    }

    // Check cooldown
    if (config.cooldownMs && now - entry.lastRequest < config.cooldownMs) {
      return { 
        allowed: false, 
        resetTime: entry.lastRequest + config.cooldownMs 
      };
    }

    // Check max requests
    if (entry.count >= config.maxRequests) {
      return { 
        allowed: false, 
        resetTime: entry.lastReset + config.windowMs 
      };
    }

    // Update entry
    entry.count++;
    entry.lastRequest = now;
    
    return { allowed: true };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      // Remove entries older than 1 hour
      if (now - entry.lastRequest > 60 * 60 * 1000) {
        expired.push(key);
      }
    }

    for (const key of expired) {
      this.store.delete(key);
    }

    if (expired.length > 0) {
      log.debug(`Cleaned up ${expired.length} expired rate limit entries`);
    }
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

// Register rate limits for different actions
rateLimiter.register('command', {
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 20,        // 20 commands per minute
  cooldownMs: 1000,       // 1 second between commands
});

rateLimiter.register('group_create', {
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 3,         // 3 groups per minute
  cooldownMs: 10 * 1000,  // 10 seconds between group creation
});

rateLimiter.register('resource_checkin', {
  windowMs: 30 * 1000,    // 30 seconds
  maxRequests: 2,         // 2 checkins per 30 seconds
  cooldownMs: 5 * 1000,   // 5 seconds between checkins
});

rateLimiter.register('admin_action', {
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 30,        // 30 admin actions per minute
  cooldownMs: 500,        // 0.5 seconds between admin actions
});

rateLimiter.register('callback', {
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 60,        // 60 callbacks per minute
  cooldownMs: 200,        // 0.2 seconds between callbacks
});

/**
 * Generic rate limiting middleware
 */
export function createRateLimitMiddleware(key: string) {
  return async (ctx: BotContext, next: NextFunction): Promise<void> => {
    const userId = ctx.from?.id;
    
    if (!userId) {
      // Skip rate limiting if no user ID
      return next();
    }

    const result = rateLimiter.checkLimit(userId, key);
    
    if (!result.allowed) {
      let message = '⚠️ You\'re doing that too often. Please slow down.';
      
      if (result.resetTime) {
        const waitTime = Math.ceil((result.resetTime - Date.now()) / 1000);
        if (waitTime > 0) {
          message += ` Try again in ${waitTime} seconds.`;
        }
      }

      log.securityEvent('Rate limit exceeded', undefined, userId, key);

      // For callback queries, answer to remove loading state
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery(message);
      } else {
        await ctx.reply(message);
      }
      return;
    }

    return next();
  };
}

/**
 * Command rate limiting middleware
 */
export const commandRateLimit = createRateLimitMiddleware('command');

/**
 * Callback rate limiting middleware  
 */
export const callbackRateLimit = createRateLimitMiddleware('callback');

/**
 * Admin action rate limiting middleware
 */
export const adminRateLimit = createRateLimitMiddleware('admin_action');

/**
 * Group creation rate limiting
 */
export const groupCreationRateLimit = createRateLimitMiddleware('group_create');

/**
 * Resource check-in rate limiting
 */
export const resourceRateLimit = createRateLimitMiddleware('resource_checkin');

/**
 * Manual rate limit check for specific actions
 */
export function checkRateLimit(userId: number, key: string): { allowed: boolean; resetTime?: number } {
  return rateLimiter.checkLimit(userId, key);
}