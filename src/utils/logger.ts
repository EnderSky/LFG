/**
 * Logging utility for the LFG bot
 * Provides structured logging with different levels
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogContext {
  userId?: string;
  telegramId?: number;
  command?: string;
  handler?: string;
  groupId?: string;
  resourceId?: string;
  error?: Error;
  [key: string]: any;
}

class Logger {
  private level: LogLevel;

  constructor() {
    // Set log level based on environment
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'DEBUG':
        this.level = LogLevel.DEBUG;
        break;
      case 'INFO':
        this.level = LogLevel.INFO;
        break;
      case 'WARN':
        this.level = LogLevel.WARN;
        break;
      case 'ERROR':
        this.level = LogLevel.ERROR;
        break;
      default:
        this.level = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level}: ${message}${contextStr}`;
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formatted = this.formatMessage('ERROR', message, context);
      console.error(formatted);
      
      // In production, you might want to send to external service
      if (process.env.NODE_ENV === 'production' && context?.error) {
        // TODO: Send to error tracking service (Sentry, etc.)
      }
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formatted = this.formatMessage('WARN', message, context);
      console.warn(formatted);
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage('INFO', message, context);
      console.info(formatted);
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = this.formatMessage('DEBUG', message, context);
      console.debug(formatted);
    }
  }

  // Specialized logging methods for common use cases
  
  userAction(message: string, userId: string, telegramId: number, action?: string): void {
    this.info(message, {
      userId,
      telegramId,
      action,
      type: 'user_action',
    });
  }

  adminAction(message: string, adminId: string, telegramId: number, action?: string): void {
    this.info(message, {
      userId: adminId,
      telegramId,
      action,
      type: 'admin_action',
    });
  }

  dbOperation(message: string, operation: string, table?: string, recordId?: string): void {
    this.debug(message, {
      operation,
      table,
      recordId,
      type: 'db_operation',
    });
  }

  apiCall(message: string, method: string, endpoint?: string): void {
    this.debug(message, {
      method,
      endpoint,
      type: 'api_call',
    });
  }

  securityEvent(message: string, userId?: string, telegramId?: number, event?: string): void {
    this.warn(message, {
      userId,
      telegramId,
      event,
      type: 'security_event',
    });
  }
}

// Create singleton instance
export const logger = new Logger();

// Export convenience functions
export const log = {
  error: (message: string, context?: LogContext) => logger.error(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  userAction: (message: string, userId: string, telegramId: number, action?: string) => 
    logger.userAction(message, userId, telegramId, action),
  adminAction: (message: string, adminId: string, telegramId: number, action?: string) => 
    logger.adminAction(message, adminId, telegramId, action),
  dbOperation: (message: string, operation: string, table?: string, recordId?: string) => 
    logger.dbOperation(message, operation, table, recordId),
  apiCall: (message: string, method: string, endpoint?: string) => 
    logger.apiCall(message, method, endpoint),
  securityEvent: (message: string, userId?: string, telegramId?: number, event?: string) => 
    logger.securityEvent(message, userId, telegramId, event),
};