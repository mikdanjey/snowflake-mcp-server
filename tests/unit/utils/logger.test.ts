/**
 * Unit tests for Logger class
 */

import { Logger, ComponentLogger, createComponentLogger } from "../../../src/utils/logger.js";
import type { LogContext, LogLevel, LogEntry } from "../../../src/types/logger.js";

// Mock console methods
const mockConsoleLog = jest.spyOn(console, "log").mockImplementation();
const mockConsoleError = jest.spyOn(console, "error").mockImplementation();
const mockConsoleWarn = jest.spyOn(console, "warn").mockImplementation();

// Test Logger class that exposes protected methods for testing
class TestLogger extends Logger {
  public testOutput(logEntry: LogEntry): void {
    this.output(logEntry);
  }
}

describe("Logger", () => {
  let logger: Logger;

  beforeEach(() => {
    // Reset singleton instance
    (Logger as any).instance = undefined;
    logger = new Logger("debug");
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleWarn.mockRestore();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance when called multiple times", () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should initialize with default log level", () => {
      const instance = Logger.getInstance();
      expect(instance).toBeInstanceOf(Logger);
    });
  });

  describe("Log Level Management", () => {
    it("should set and respect log levels", () => {
      logger.setLogLevel("error");

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(mockConsoleLog).not.toHaveBeenCalled();
      expect(mockConsoleWarn).not.toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalledTimes(1);
    });

    it("should log all levels when set to debug", () => {
      logger.setLogLevel("debug");

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(mockConsoleLog).toHaveBeenCalledTimes(2); // debug and info
      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledTimes(1);
    });

    it("should respect info log level", () => {
      logger.setLogLevel("info");

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(mockConsoleLog).toHaveBeenCalledTimes(1); // only info
      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).toHaveBeenCalledTimes(1);
    });
  });

  describe("Structured Logging", () => {
    it("should log with context information", () => {
      const context: LogContext = {
        component: "TestComponent",
        operation: "testOperation",
        userId: "12345",
      };

      logger.info("Test message", context);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("INFO: Test message"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Context: {"component":"TestComponent","operation":"testOperation","userId":"12345"}'));
    });

    it("should log without context", () => {
      logger.info("Simple message");

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: Simple message$/));
    });

    it("should include error information in error logs", () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test";

      logger.error("Error occurred", error);

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Error: Error: Test error"));
    });

    it("should include stack trace in debug mode", () => {
      logger.setLogLevel("debug");
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test";

      logger.error("Error occurred", error);

      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Stack: Error: Test error\n    at test"));
    });
  });

  describe("Sensitive Data Protection", () => {
    it("should redact password fields", () => {
      const context: LogContext = {
        component: "Auth",
        password: "secret123",
        username: "user",
      };

      logger.info("Login attempt", context);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"password":"[REDACTED]"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"username":"user"'));
    });

    it("should redact various sensitive key patterns", () => {
      const context: LogContext = {
        component: "Config",
        apiKey: "key123",
        authToken: "token456",
        secret: "secret789",
        credential: "cred000",
        normalField: "safe",
      };

      logger.info("Configuration loaded", context);

      const logCall = mockConsoleLog.mock.calls[0][0];
      expect(logCall).toContain('"apiKey":"[REDACTED]"');
      expect(logCall).toContain('"authToken":"[REDACTED]"');
      expect(logCall).toContain('"secret":"[REDACTED]"');
      expect(logCall).toContain('"credential":"[REDACTED]"');
      expect(logCall).toContain('"normalField":"safe"');
    });

    it("should redact sensitive data in nested objects", () => {
      const context: LogContext = {
        component: "Database",
        config: {
          host: "localhost",
          password: "dbpass123",
          nested: {
            token: "nested-token",
            value: "safe-value",
          },
        },
      };

      logger.info("Database connection", context);

      const logCall = mockConsoleLog.mock.calls[0][0];
      expect(logCall).toContain('"password":"[REDACTED]"');
      expect(logCall).toContain('"token":"[REDACTED]"');
      expect(logCall).toContain('"host":"localhost"');
      expect(logCall).toContain('"value":"safe-value"');
    });

    it("should handle arrays with sensitive data", () => {
      const context: LogContext = {
        component: "Users",
        users: [
          { name: "John", password: "pass1" },
          { name: "Jane", password: "pass2" },
        ],
      };

      logger.info("User list", context);

      const logCall = mockConsoleLog.mock.calls[0][0];
      expect(logCall).toContain('"password":"[REDACTED]"');
      expect(logCall).toContain('"name":"John"');
      expect(logCall).toContain('"name":"Jane"');
    });
  });

  describe("Log Formatting", () => {
    it("should format log entries with timestamp", () => {
      logger.info("Test message");

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: Test message$/));
    });

    it("should format different log levels correctly", () => {
      logger.debug("Debug message");
      logger.info("Info message");
      logger.warn("Warn message");
      logger.error("Error message");

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("DEBUG: Debug message"));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("INFO: Info message"));
      expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("WARN: Warn message"));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("ERROR: Error message"));
    });
  });

  describe("Edge Cases", () => {
    it("should handle null context gracefully", () => {
      logger.info("Test message", null as any);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("INFO: Test message"));
    });

    it("should handle undefined context gracefully", () => {
      logger.info("Test message", undefined);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("INFO: Test message"));
    });

    it("should handle circular references in context", () => {
      const circular: any = { component: "Test" };
      circular.self = circular;

      // Should not throw an error
      expect(() => {
        logger.info("Circular test", circular);
      }).not.toThrow();
    });

    it("should handle empty messages", () => {
      logger.info("");
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining("INFO: "));
    });
  });
});

describe("ComponentLogger", () => {
  let componentLogger: ComponentLogger;

  beforeEach(() => {
    (Logger as any).instance = undefined;
    componentLogger = new ComponentLogger("TestComponent", "debug");
    jest.clearAllMocks();
  });

  it("should automatically include component in context", () => {
    componentLogger.info("Test message", { operation: "test" });

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"component":"TestComponent"'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"operation":"test"'));
  });

  it("should work with all log levels", () => {
    componentLogger.debug("Debug message");
    componentLogger.info("Info message");
    componentLogger.warn("Warn message");
    componentLogger.error("Error message");

    expect(mockConsoleLog).toHaveBeenCalledTimes(2);
    expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
    expect(mockConsoleError).toHaveBeenCalledTimes(1);
  });

  it("should handle error logging with error objects", () => {
    const error = new Error("Component error");
    componentLogger.error("Something went wrong", error, {
      operation: "process",
    });

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('"component":"TestComponent"'));
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('"operation":"process"'));
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Error: Component error"));
  });
});

describe("createComponentLogger", () => {
  beforeEach(() => {
    (Logger as any).instance = undefined;
    jest.clearAllMocks();
  });

  it("should create a component logger with specified component name", () => {
    const logger = createComponentLogger("MyComponent");
    logger.info("Test message");

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"component":"MyComponent"'));
  });

  it("should create a component logger with custom log level", () => {
    const logger = createComponentLogger("MyComponent", "error");

    logger.debug("Debug message");
    logger.info("Info message");
    logger.error("Error message");

    expect(mockConsoleLog).not.toHaveBeenCalled();
    expect(mockConsoleError).toHaveBeenCalledTimes(1);
  });
});
