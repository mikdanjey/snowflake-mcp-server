/**
 * Example usage of the Logger class
 */

import { Logger, createComponentLogger } from "../utils/logger.js";
import type { LogContext } from "../types/logger.js";

// Example 1: Basic logger usage
function basicLoggerExample() {
  console.log("\n=== Basic Logger Example ===");

  const logger = Logger.getInstance("debug");

  // Simple logging
  logger.info("Application started");
  logger.debug("Debug information");
  logger.warn("This is a warning");

  // Logging with context
  const context: LogContext = {
    component: "DatabaseConnection",
    operation: "connect",
    host: "localhost",
    port: 5432,
  };

  logger.info("Connecting to database", context);

  // Error logging
  try {
    throw new Error("Connection failed");
  } catch (error) {
    logger.error("Database connection error", error as Error, context);
  }
}

// Example 2: Component logger usage
function componentLoggerExample() {
  console.log("\n=== Component Logger Example ===");

  const dbLogger = createComponentLogger("DatabaseService", "info");
  const authLogger = createComponentLogger("AuthService", "debug");

  // Database operations
  dbLogger.info("Initializing database connection");
  dbLogger.info("Query executed successfully", {
    operation: "SELECT",
    table: "users",
    duration: 45,
  });

  // Authentication operations
  authLogger.debug("Processing login request", {
    operation: "login",
    userId: "user123",
  });
  authLogger.info("User authenticated successfully");
}

// Example 3: Sensitive data protection
function sensitiveDataExample() {
  console.log("\n=== Sensitive Data Protection Example ===");

  const logger = Logger.getInstance("info");

  // This will automatically redact sensitive information
  const userContext: LogContext = {
    component: "UserService",
    operation: "createUser",
    userData: {
      username: "john_doe",
      email: "john@example.com",
      password: "secret123", // This will be redacted
      apiKey: "key_abc123", // This will be redacted
      profile: {
        name: "John Doe",
        token: "auth_token_xyz", // This will be redacted
      },
    },
  };

  logger.info("Creating new user", userContext);
}

// Example 4: Different log levels
function logLevelExample() {
  console.log("\n=== Log Level Example ===");

  // Create logger with 'warn' level - only warn and error messages will be shown
  const logger = Logger.getInstance("warn");

  logger.debug("This debug message will not be shown");
  logger.info("This info message will not be shown");
  logger.warn("This warning message will be shown");
  logger.error("This error message will be shown");
}

// Run examples
if (import.meta.url === `file://${process.argv[1]}`) {
  basicLoggerExample();
  componentLoggerExample();
  sensitiveDataExample();
  logLevelExample();
}
