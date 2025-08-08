/**
 * Comprehensive error handling utility for the Snowflake MCP Server
 * Provides consistent error formatting and categorization across all components
 */

import { ZodError } from "zod";
import type { ErrorResponse, ValidationError } from "../types/index.js";
import { createComponentLogger } from "./logger.js";

/**
 * Error categories for consistent error handling
 */
export enum ErrorCategory {
  CONFIG = "CONFIG_ERROR",
  CONNECTION = "CONNECTION_ERROR",
  VALIDATION = "VALIDATION_ERROR",
  EXECUTION = "EXECUTION_ERROR",
  PROTOCOL = "PROTOCOL_ERROR",
  INTERNAL = "INTERNAL_ERROR",
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Structured error information
 */
export interface ErrorInfo {
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  details?: Record<string, any>;
  suggestion?: string;
  originalError?: Error;
}

/**
 * ErrorHandler utility class for consistent error formatting and categorization
 */
export class ErrorHandler {
  private static readonly logger = createComponentLogger("ErrorHandler");

  /**
   * Handle configuration errors (missing or invalid environment variables)
   */
  static handleConfigurationError(error: Error, context?: Record<string, any>): ErrorResponse {
    const errorInfo: ErrorInfo = {
      category: ErrorCategory.CONFIG,
      severity: ErrorSeverity.CRITICAL,
      code: ErrorCategory.CONFIG,
      message: "Configuration error occurred",
      details: {
        originalMessage: error.message,
        context,
      },
      suggestion: "Check environment variables and configuration settings",
      originalError: error,
    };

    this.logError(errorInfo);
    return this.formatErrorResponse(errorInfo);
  }

  /**
   * Handle connection errors (Snowflake authentication or network issues)
   */
  static handleConnectionError(error: Error, context?: Record<string, any>): ErrorResponse {
    const errorInfo: ErrorInfo = {
      category: ErrorCategory.CONNECTION,
      severity: ErrorSeverity.HIGH,
      code: ErrorCategory.CONNECTION,
      message: "Database connection error",
      details: {
        originalMessage: error.message,
        context,
      },
      suggestion: "Verify Snowflake credentials and network connectivity",
      originalError: error,
    };

    this.logError(errorInfo);
    return this.formatErrorResponse(errorInfo);
  }

  /**
   * Handle validation errors (invalid SQL input or schema violations)
   */
  static handleValidationError(error: ZodError | ValidationError, context?: Record<string, any>): ErrorResponse {
    let errorInfo: ErrorInfo;

    if (error instanceof ZodError) {
      const issues = error.errors.map((err: any) => {
        const path = err.path.join(".");
        return `${path}: ${err.message}`;
      });

      errorInfo = {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        code: ErrorCategory.VALIDATION,
        message: "Input validation failed",
        details: {
          issues,
          context,
          ...(error.errors[0]?.path.length && {
            field: error.errors[0].path.join("."),
          }),
        },
        suggestion: "Check input format and ensure all required fields are provided",
      };
    } else {
      errorInfo = {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        code: error.code,
        message: error.message,
        details: {
          ...error.details,
          context,
        },
        suggestion: "Verify input data format and constraints",
      };
    }

    this.logError(errorInfo);
    return this.formatErrorResponse(errorInfo);
  }

  /**
   * Handle execution errors (SQL syntax errors or runtime failures)
   */
  static handleExecutionError(error: Error, context?: Record<string, any>): ErrorResponse {
    const errorInfo: ErrorInfo = {
      category: ErrorCategory.EXECUTION,
      severity: ErrorSeverity.HIGH,
      code: ErrorCategory.EXECUTION,
      message: "SQL execution failed",
      details: {
        originalMessage: error.message,
        context,
      },
      suggestion: "Check SQL syntax and ensure the query is valid for Snowflake",
      originalError: error,
    };

    this.logError(errorInfo);
    return this.formatErrorResponse(errorInfo);
  }

  /**
   * Handle protocol errors (MCP communication issues)
   */
  static handleProtocolError(error: Error, context?: Record<string, any>): ErrorResponse {
    const errorInfo: ErrorInfo = {
      category: ErrorCategory.PROTOCOL,
      severity: ErrorSeverity.HIGH,
      code: ErrorCategory.PROTOCOL,
      message: "MCP protocol communication error",
      details: {
        originalMessage: error.message,
        context,
      },
      suggestion: "Check MCP client compatibility and communication channel",
      originalError: error,
    };

    this.logError(errorInfo);
    return this.formatErrorResponse(errorInfo);
  }

  /**
   * Handle unexpected internal errors
   */
  static handleInternalError(error: Error, context?: Record<string, any>): ErrorResponse {
    const errorInfo: ErrorInfo = {
      category: ErrorCategory.INTERNAL,
      severity: ErrorSeverity.CRITICAL,
      code: ErrorCategory.INTERNAL,
      message: "An unexpected internal error occurred",
      details: {
        originalMessage: error.message,
        stack: error.stack,
        context,
      },
      suggestion: "Please check the server logs for more details and contact support if the issue persists",
      originalError: error,
    };

    this.logError(errorInfo);
    return this.formatErrorResponse(errorInfo);
  }

  /**
   * Create a custom error response with specific details
   */
  static createCustomError(category: ErrorCategory, message: string, details?: Record<string, any>, suggestion?: string): ErrorResponse {
    const errorInfo: ErrorInfo = {
      category,
      severity: this.getSeverityForCategory(category),
      code: category,
      message,
      details: details || {},
      ...(suggestion && { suggestion }),
    };

    this.logError(errorInfo);
    return this.formatErrorResponse(errorInfo);
  }

  /**
   * Check if an error is retryable based on its category and details
   */
  static isRetryableError(error: ErrorResponse): boolean {
    const retryableCategories = [
      ErrorCategory.CONNECTION,
      ErrorCategory.EXECUTION, // Some SQL errors might be temporary
    ];

    const category = error.error.code as ErrorCategory;
    if (!retryableCategories.includes(category)) {
      return false;
    }

    // Check for specific non-retryable patterns in both message and original message
    const message = error.error.message.toLowerCase();
    const originalMessage = (error.error.details?.["originalMessage"] as string)?.toLowerCase() || "";
    const combinedMessage = `${message} ${originalMessage}`;

    const nonRetryablePatterns = ["authentication failed", "invalid credentials", "syntax error", "permission denied", "access denied", "invalid sql"];

    return !nonRetryablePatterns.some(pattern => combinedMessage.includes(pattern));
  }

  /**
   * Extract error category from error message or type
   */
  static categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();

    if (message.includes("config") || message.includes("environment")) {
      return ErrorCategory.CONFIG;
    }
    if (message.includes("validation") || message.includes("invalid") || message.includes("schema")) {
      return ErrorCategory.VALIDATION;
    }
    if (message.includes("sql") || message.includes("execution") || message.includes("query")) {
      return ErrorCategory.EXECUTION;
    }
    if (message.includes("connect") || message.includes("network") || message.includes("timeout")) {
      return ErrorCategory.CONNECTION;
    }
    if (message.includes("protocol") || message.includes("mcp") || message.includes("communication")) {
      return ErrorCategory.PROTOCOL;
    }

    return ErrorCategory.INTERNAL;
  }

  /**
   * Format error response according to MCP standards
   */
  private static formatErrorResponse(errorInfo: ErrorInfo): ErrorResponse {
    return {
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
        details: {
          ...errorInfo.details,
          category: errorInfo.category,
          severity: errorInfo.severity,
          ...(errorInfo.suggestion && { suggestion: errorInfo.suggestion }),
          timestamp: new Date().toISOString(),
        },
      },
    };
  }

  /**
   * Log error information with appropriate level
   */
  private static logError(errorInfo: ErrorInfo): void {
    const logContext = {
      category: errorInfo.category,
      severity: errorInfo.severity,
      code: errorInfo.code,
    };

    if (errorInfo.severity === ErrorSeverity.CRITICAL) {
      this.logger.error(errorInfo.message, errorInfo.originalError, logContext);
    } else if (errorInfo.severity === ErrorSeverity.HIGH) {
      this.logger.error(errorInfo.message, errorInfo.originalError, logContext);
    } else {
      this.logger.info(`${errorInfo.message} (${errorInfo.severity})`, logContext);
    }
  }

  /**
   * Get default severity for error category
   */
  private static getSeverityForCategory(category: ErrorCategory): ErrorSeverity {
    switch (category) {
      case ErrorCategory.CONFIG:
        return ErrorSeverity.CRITICAL;
      case ErrorCategory.CONNECTION:
        return ErrorSeverity.HIGH;
      case ErrorCategory.VALIDATION:
        return ErrorSeverity.MEDIUM;
      case ErrorCategory.EXECUTION:
        return ErrorSeverity.HIGH;
      case ErrorCategory.PROTOCOL:
        return ErrorSeverity.HIGH;
      case ErrorCategory.INTERNAL:
        return ErrorSeverity.CRITICAL;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }
}
