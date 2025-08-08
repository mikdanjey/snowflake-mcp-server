/**
 * Logger implementation with structured logging capabilities
 */

import type { LogContext, LogLevel, LogEntry } from "../types/logger.js";

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private sensitiveKeys = new Set(["password", "token", "secret", "key", "auth", "credential", "pass", "pwd"]);

  constructor(logLevel: LogLevel = "info") {
    this.logLevel = logLevel;
  }

  /**
   * Get singleton instance of Logger
   */
  static getInstance(logLevel: LogLevel = "info"): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(logLevel);
    }
    return Logger.instance;
  }

  /**
   * Set the log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const errorInfo = error
      ? {
          name: error.name,
          message: error.message,
          ...(error.stack && { stack: error.stack }),
        }
      : undefined;

    this.log("error", message, context, errorInfo);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: LogEntry["error"]): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const sanitizedContext = context ? this.sanitizeContext(context) : undefined;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(sanitizedContext && { context: sanitizedContext }),
      ...(error && { error }),
    };

    this.output(logEntry);
  }

  /**
   * Check if message should be logged based on current log level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    return levels[level] >= levels[this.logLevel];
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context: LogContext): LogContext {
    const visited = new WeakSet();
    return this.sanitizeObjectWithCircularCheck(context, visited) as LogContext;
  }

  /**
   * Recursively sanitize nested objects with circular reference protection
   */
  private sanitizeObjectWithCircularCheck(obj: any, visited: WeakSet<object>): any {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    // Handle circular references
    if (visited.has(obj)) {
      return "[Circular Reference]";
    }

    visited.add(obj);

    try {
      if (Array.isArray(obj)) {
        return obj.map(item => (typeof item === "object" && item !== null ? this.sanitizeObjectWithCircularCheck(item, visited) : item));
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (this.isSensitiveKey(key)) {
          sanitized[key] = "[REDACTED]";
        } else if (typeof value === "object" && value !== null) {
          sanitized[key] = this.sanitizeObjectWithCircularCheck(value, visited);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    } catch (error) {
      // Fallback for any serialization issues
      return "[Serialization Error]";
    } finally {
      visited.delete(obj);
    }
  }

  /**
   * Check if a key contains sensitive information
   */
  private isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return Array.from(this.sensitiveKeys).some(sensitiveKey => lowerKey.includes(sensitiveKey));
  }

  /**
   * Output the log entry (can be overridden for testing)
   */
  protected output(logEntry: LogEntry): void {
    const formatted = this.formatLogEntry(logEntry);

    if (logEntry.level === "error") {
      console.error(formatted);
    } else if (logEntry.level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(logEntry: LogEntry): string {
    const { timestamp, level, message, context, error } = logEntry;

    let formatted = `[${timestamp}] ${level.toUpperCase()}: ${message}`;

    if (context) {
      formatted += ` | Context: ${JSON.stringify(context)}`;
    }

    if (error) {
      formatted += ` | Error: ${error.name}: ${error.message}`;
      if (error.stack && this.logLevel === "debug") {
        formatted += `\nStack: ${error.stack}`;
      }
    }

    return formatted;
  }
}

/**
 * Create a logger instance for a specific component
 */
export function createComponentLogger(component: string, logLevel?: LogLevel): ComponentLogger {
  return new ComponentLogger(component, logLevel);
}

/**
 * Component-specific logger that automatically includes component context
 */
export class ComponentLogger {
  private logger: Logger;
  private component: string;

  constructor(component: string, logLevel?: LogLevel) {
    this.logger = Logger.getInstance(logLevel);
    this.component = component;
  }

  info(message: string, context?: Omit<LogContext, "component">): void {
    this.logger.info(message, { component: this.component, ...context });
  }

  warn(message: string, context?: Omit<LogContext, "component">): void {
    this.logger.warn(message, { component: this.component, ...context });
  }

  error(message: string, error?: Error, context?: Omit<LogContext, "component">): void {
    this.logger.error(message, error, {
      component: this.component,
      ...context,
    });
  }

  debug(message: string, context?: Omit<LogContext, "component">): void {
    this.logger.debug(message, { component: this.component, ...context });
  }
}
