/**
 * Unit tests for ErrorHandler utility class
 */

import { ZodError, z } from "zod";
import { ErrorHandler, ErrorCategory, ErrorSeverity } from "../../../src/utils/error-handler.js";
import type { ValidationError } from "../../../src/types/index.js";

// Mock the logger to avoid actual logging during tests
jest.mock("../../../src/utils/logger.js", () => ({
  createComponentLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe("ErrorHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleConfigurationError", () => {
    it("should handle configuration errors correctly", () => {
      const error = new Error("Missing SNOWFLAKE_ACCOUNT environment variable");
      const context = { operation: "loadConfig" };

      const result = ErrorHandler.handleConfigurationError(error, context);

      expect(result).toEqual({
        error: {
          code: ErrorCategory.CONFIG,
          message: "Configuration error occurred",
          details: {
            originalMessage: error.message,
            context,
            category: ErrorCategory.CONFIG,
            severity: ErrorSeverity.CRITICAL,
            suggestion: "Check environment variables and configuration settings",
            timestamp: expect.any(String),
          },
        },
      });
    });

    it("should handle configuration errors without context", () => {
      const error = new Error("Invalid configuration");

      const result = ErrorHandler.handleConfigurationError(error);

      expect(result.error.code).toBe(ErrorCategory.CONFIG);
      expect(result.error.message).toBe("Configuration error occurred");
      expect(result.error.details?.originalMessage).toBe(error.message);
      expect(result.error.details?.category).toBe(ErrorCategory.CONFIG);
      expect(result.error.details?.severity).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe("handleConnectionError", () => {
    it("should handle connection errors correctly", () => {
      const error = new Error("Connection timeout");
      const context = { operation: "connect", account: "test-account" };

      const result = ErrorHandler.handleConnectionError(error, context);

      expect(result).toEqual({
        error: {
          code: ErrorCategory.CONNECTION,
          message: "Database connection error",
          details: {
            originalMessage: error.message,
            context,
            category: ErrorCategory.CONNECTION,
            severity: ErrorSeverity.HIGH,
            suggestion: "Verify Snowflake credentials and network connectivity",
            timestamp: expect.any(String),
          },
        },
      });
    });
  });

  describe("handleValidationError", () => {
    it("should handle ZodError correctly", () => {
      const schema = z.object({
        sql: z.string().min(1, "SQL cannot be empty"),
      });

      let zodError: ZodError;
      try {
        schema.parse({ sql: "" });
      } catch (error) {
        zodError = error as ZodError;
      }

      const context = { operation: "validateQuery" };
      const result = ErrorHandler.handleValidationError(zodError!, context);

      expect(result.error.code).toBe(ErrorCategory.VALIDATION);
      expect(result.error.message).toBe("Input validation failed");
      expect(result.error.details?.issues).toEqual(["sql: SQL cannot be empty"]);
      expect(result.error.details?.field).toBe("sql");
      expect(result.error.details?.category).toBe(ErrorCategory.VALIDATION);
      expect(result.error.details?.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it("should handle ValidationError correctly", () => {
      const validationError: ValidationError = {
        code: "VALIDATION_ERROR",
        message: "SQL validation failed",
        details: {
          field: "sql",
          value: "invalid sql",
          issues: ["Contains dangerous patterns"],
        },
      };

      const result = ErrorHandler.handleValidationError(validationError);

      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toBe("SQL validation failed");
      expect(result.error.details?.field).toBe("sql");
      expect(result.error.details?.issues).toEqual(["Contains dangerous patterns"]);
    });
  });

  describe("handleExecutionError", () => {
    it("should handle execution errors correctly", () => {
      const error = new Error("SQL syntax error near SELECT");
      const context = { operation: "executeQuery", sql: "SELECT * FROM" };

      const result = ErrorHandler.handleExecutionError(error, context);

      expect(result).toEqual({
        error: {
          code: ErrorCategory.EXECUTION,
          message: "SQL execution failed",
          details: {
            originalMessage: error.message,
            context,
            category: ErrorCategory.EXECUTION,
            severity: ErrorSeverity.HIGH,
            suggestion: "Check SQL syntax and ensure the query is valid for Snowflake",
            timestamp: expect.any(String),
          },
        },
      });
    });
  });

  describe("handleProtocolError", () => {
    it("should handle protocol errors correctly", () => {
      const error = new Error("MCP communication failed");
      const context = { operation: "handleRequest", requestType: "tool_call" };

      const result = ErrorHandler.handleProtocolError(error, context);

      expect(result).toEqual({
        error: {
          code: ErrorCategory.PROTOCOL,
          message: "MCP protocol communication error",
          details: {
            originalMessage: error.message,
            context,
            category: ErrorCategory.PROTOCOL,
            severity: ErrorSeverity.HIGH,
            suggestion: "Check MCP client compatibility and communication channel",
            timestamp: expect.any(String),
          },
        },
      });
    });
  });

  describe("handleInternalError", () => {
    it("should handle internal errors correctly", () => {
      const error = new Error("Unexpected error occurred");
      error.stack = "Error: Unexpected error occurred\n    at test";
      const context = { operation: "processRequest" };

      const result = ErrorHandler.handleInternalError(error, context);

      expect(result).toEqual({
        error: {
          code: ErrorCategory.INTERNAL,
          message: "An unexpected internal error occurred",
          details: {
            originalMessage: error.message,
            stack: error.stack,
            context,
            category: ErrorCategory.INTERNAL,
            severity: ErrorSeverity.CRITICAL,
            suggestion: "Please check the server logs for more details and contact support if the issue persists",
            timestamp: expect.any(String),
          },
        },
      });
    });
  });

  describe("createCustomError", () => {
    it("should create custom errors correctly", () => {
      const category = ErrorCategory.VALIDATION;
      const message = "Custom validation error";
      const details = { customField: "customValue" };
      const suggestion = "Custom suggestion";

      const result = ErrorHandler.createCustomError(category, message, details, suggestion);

      expect(result).toEqual({
        error: {
          code: category,
          message,
          details: {
            ...details,
            category,
            severity: ErrorSeverity.MEDIUM,
            suggestion,
            timestamp: expect.any(String),
          },
        },
      });
    });

    it("should create custom errors without optional parameters", () => {
      const category = ErrorCategory.CONNECTION;
      const message = "Simple connection error";

      const result = ErrorHandler.createCustomError(category, message);

      expect(result.error.code).toBe(category);
      expect(result.error.message).toBe(message);
      expect(result.error.details?.category).toBe(category);
      expect(result.error.details?.severity).toBe(ErrorSeverity.HIGH);
      expect(result.error.details?.suggestion).toBeUndefined();
    });
  });

  describe("isRetryableError", () => {
    it("should identify retryable connection errors", () => {
      const error = ErrorHandler.handleConnectionError(new Error("Network timeout"));
      expect(ErrorHandler.isRetryableError(error)).toBe(true);
    });

    it("should identify retryable execution errors", () => {
      const error = ErrorHandler.handleExecutionError(new Error("Temporary database error"));
      expect(ErrorHandler.isRetryableError(error)).toBe(true);
    });

    it("should identify non-retryable authentication errors", () => {
      const error = ErrorHandler.handleConnectionError(new Error("Authentication failed"));
      expect(ErrorHandler.isRetryableError(error)).toBe(false);
    });

    it("should identify non-retryable syntax errors", () => {
      const error = ErrorHandler.handleExecutionError(new Error("SQL syntax error"));
      expect(ErrorHandler.isRetryableError(error)).toBe(false);
    });

    it("should identify non-retryable validation errors", () => {
      const error = ErrorHandler.handleValidationError(new ZodError([]));
      expect(ErrorHandler.isRetryableError(error)).toBe(false);
    });

    it("should identify non-retryable configuration errors", () => {
      const error = ErrorHandler.handleConfigurationError(new Error("Missing config"));
      expect(ErrorHandler.isRetryableError(error)).toBe(false);
    });

    it("should identify non-retryable protocol errors", () => {
      const error = ErrorHandler.handleProtocolError(new Error("Protocol error"));
      expect(ErrorHandler.isRetryableError(error)).toBe(false);
    });

    it("should identify non-retryable internal errors", () => {
      const error = ErrorHandler.handleInternalError(new Error("Internal error"));
      expect(ErrorHandler.isRetryableError(error)).toBe(false);
    });
  });

  describe("categorizeError", () => {
    it("should categorize configuration errors", () => {
      const error = new Error("Configuration validation failed");
      expect(ErrorHandler.categorizeError(error)).toBe(ErrorCategory.CONFIG);
    });

    it("should categorize environment errors", () => {
      const error = new Error("Environment variable missing");
      expect(ErrorHandler.categorizeError(error)).toBe(ErrorCategory.CONFIG);
    });

    it("should categorize connection errors", () => {
      const error = new Error("Connection timeout occurred");
      expect(ErrorHandler.categorizeError(error)).toBe(ErrorCategory.CONNECTION);
    });

    it("should categorize network errors", () => {
      const error = new Error("Network unreachable");
      expect(ErrorHandler.categorizeError(error)).toBe(ErrorCategory.CONNECTION);
    });

    it("should categorize validation errors", () => {
      const error = new Error("Validation failed for input");
      expect(ErrorHandler.categorizeError(error)).toBe(ErrorCategory.VALIDATION);
    });

    it("should categorize invalid input errors", () => {
      const error = new Error("Invalid schema provided");
      expect(ErrorHandler.categorizeError(error)).toBe(ErrorCategory.VALIDATION);
    });

    it("should categorize SQL execution errors", () => {
      const error = new Error("SQL execution failed");
      expect(ErrorHandler.categorizeError(error)).toBe(ErrorCategory.EXECUTION);
    });

    it("should categorize query errors", () => {
      const error = new Error("Query timeout");
      expect(ErrorHandler.categorizeError(error)).toBe(ErrorCategory.EXECUTION);
    });

    it("should categorize protocol errors", () => {
      const error = new Error("MCP protocol error");
      expect(ErrorHandler.categorizeError(error)).toBe(ErrorCategory.PROTOCOL);
    });

    it("should categorize communication errors", () => {
      const error = new Error("Communication channel failed");
      expect(ErrorHandler.categorizeError(error)).toBe(ErrorCategory.PROTOCOL);
    });

    it("should categorize unknown errors as internal", () => {
      const error = new Error("Some unknown error");
      expect(ErrorHandler.categorizeError(error)).toBe(ErrorCategory.INTERNAL);
    });
  });

  describe("error response format", () => {
    it("should include timestamp in all error responses", () => {
      const error = new Error("Test error");
      const result = ErrorHandler.handleInternalError(error);

      expect(result.error.details?.timestamp).toBeDefined();
      expect(typeof result.error.details?.timestamp).toBe("string");
      expect(new Date(result.error.details?.timestamp as string)).toBeInstanceOf(Date);
    });

    it("should include category and severity in all error responses", () => {
      const error = new Error("Test error");
      const result = ErrorHandler.handleConfigurationError(error);

      expect(result.error.details?.category).toBe(ErrorCategory.CONFIG);
      expect(result.error.details?.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it("should include suggestion when provided", () => {
      const error = new Error("Test error");
      const result = ErrorHandler.handleConnectionError(error);

      expect(result.error.details?.suggestion).toBe("Verify Snowflake credentials and network connectivity");
    });
  });

  describe("error severity mapping", () => {
    it("should assign correct severity levels", () => {
      const configError = ErrorHandler.handleConfigurationError(new Error("Config error"));
      expect(configError.error.details?.severity).toBe(ErrorSeverity.CRITICAL);

      const connectionError = ErrorHandler.handleConnectionError(new Error("Connection error"));
      expect(connectionError.error.details?.severity).toBe(ErrorSeverity.HIGH);

      const validationError = ErrorHandler.handleValidationError(new ZodError([]));
      expect(validationError.error.details?.severity).toBe(ErrorSeverity.MEDIUM);

      const executionError = ErrorHandler.handleExecutionError(new Error("Execution error"));
      expect(executionError.error.details?.severity).toBe(ErrorSeverity.HIGH);

      const protocolError = ErrorHandler.handleProtocolError(new Error("Protocol error"));
      expect(protocolError.error.details?.severity).toBe(ErrorSeverity.HIGH);

      const internalError = ErrorHandler.handleInternalError(new Error("Internal error"));
      expect(internalError.error.details?.severity).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe("edge cases", () => {
    it("should handle errors with undefined messages", () => {
      const error = new Error();
      const result = ErrorHandler.handleInternalError(error);

      expect(result.error.details?.originalMessage).toBe("");
    });

    it("should handle null context gracefully", () => {
      const error = new Error("Test error");
      const result = ErrorHandler.handleConfigurationError(error, null as any);

      expect(result.error.details?.context).toBeNull();
    });

    it("should handle empty context objects", () => {
      const error = new Error("Test error");
      const result = ErrorHandler.handleConnectionError(error, {});

      expect(result.error.details?.context).toEqual({});
    });

    it("should handle unknown error categories in createCustomError", () => {
      // Test the default case in getSeverityForCategory
      const unknownCategory = "UNKNOWN_ERROR" as ErrorCategory;
      const result = ErrorHandler.createCustomError(unknownCategory, "Unknown error");

      expect(result.error.details?.severity).toBe(ErrorSeverity.MEDIUM);
      expect(result.error.code).toBe(unknownCategory);
    });

    it("should handle ZodError with multiple issues", () => {
      const schema = z.object({
        sql: z.string().min(1, "SQL cannot be empty"),
        timeout: z.number().min(1, "Timeout must be positive"),
      });

      let zodError: ZodError;
      try {
        schema.parse({ sql: "", timeout: -1 });
      } catch (error) {
        zodError = error as ZodError;
      }

      const result = ErrorHandler.handleValidationError(zodError!);

      expect(result.error.details?.issues).toHaveLength(2);
      expect(result.error.details?.issues).toContain("sql: SQL cannot be empty");
      expect(result.error.details?.issues).toContain("timeout: Timeout must be positive");
    });

    it("should handle ZodError with nested path", () => {
      const schema = z.object({
        config: z.object({
          database: z.string().min(1, "Database name required"),
        }),
      });

      let zodError: ZodError;
      try {
        schema.parse({ config: { database: "" } });
      } catch (error) {
        zodError = error as ZodError;
      }

      const result = ErrorHandler.handleValidationError(zodError!);

      expect(result.error.details?.field).toBe("config.database");
      expect(result.error.details?.issues).toContain("config.database: Database name required");
    });

    it("should handle isRetryableError with authentication failure in originalMessage", () => {
      const error = ErrorHandler.handleConnectionError(new Error("Authentication failed - invalid credentials"));

      expect(ErrorHandler.isRetryableError(error)).toBe(false);
    });

    it("should handle isRetryableError with combined message patterns", () => {
      // Test case where the pattern is in the main message
      const error1 = ErrorHandler.handleExecutionError(new Error("Some SQL syntax error occurred"));
      expect(ErrorHandler.isRetryableError(error1)).toBe(false);

      // Test case where the pattern is in the original message
      const error2 = ErrorHandler.handleConnectionError(new Error("Permission denied to access database"));
      expect(ErrorHandler.isRetryableError(error2)).toBe(false);
    });
  });
});
