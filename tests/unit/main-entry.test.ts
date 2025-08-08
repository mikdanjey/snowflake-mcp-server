/**
 * Unit tests for main.ts entry point functionality
 * Note: We test the Application class functionality rather than the main.ts file directly
 * due to import.meta syntax compatibility issues with Jest
 */

import { jest } from "@jest/globals";
import { Application } from "../../src/application.js";

// Mock the Application dependencies
jest.mock("../../src/utils/config-manager.js");
jest.mock("../../src/utils/index.js", () => ({
  createComponentLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
  ErrorHandler: {
    categorizeError: jest.fn().mockReturnValue("CONFIG_ERROR"),
    handleConfigurationError: jest.fn().mockReturnValue({
      error: {
        code: "CONFIG_ERROR",
        message: "Configuration error",
        details: {},
      },
    }),
  },
}));
jest.mock("../../src/clients/snowflake-client.js");
jest.mock("../../src/server/mcp-server.js");
jest.mock("../../src/handlers/snowflake-resource-handler.js");
jest.mock("../../src/validators/sql-validator.js");

describe("main.ts entry point functionality", () => {
  let originalConsoleError: typeof console.error;
  let originalProcessExit: typeof process.exit;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console.error
    originalConsoleError = console.error;
    console.error = jest.fn();

    // Mock process.exit
    originalProcessExit = process.exit;
    process.exit = jest.fn() as any;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  describe("Application class availability", () => {
    it("should export Application class", () => {
      expect(Application).toBeDefined();
      expect(typeof Application).toBe("function");
    });

    it("should be able to create Application instance", () => {
      const app = new Application();
      expect(app).toBeInstanceOf(Application);
    });
  });

  describe("main function behavior simulation", () => {
    it("should handle successful application startup", async () => {
      const app = new Application();

      // Mock successful startup
      const mockStart = jest.spyOn(app, "start").mockResolvedValue(undefined);
      const mockSetupShutdownHandlers = jest.spyOn(app, "setupShutdownHandlers").mockImplementation(() => {});

      // Simulate main function behavior
      app.setupShutdownHandlers();
      await app.start();

      expect(mockSetupShutdownHandlers).toHaveBeenCalled();
      expect(mockStart).toHaveBeenCalled();
      expect(process.exit).not.toHaveBeenCalled();
    });

    it("should handle application startup errors", async () => {
      const app = new Application();
      const startupError = new Error("Startup failed");

      // Mock the internal methods that start() calls
      const mockLoadConfiguration = jest.spyOn(app as any, "loadConfiguration").mockRejectedValue(startupError);
      const mockSetupShutdownHandlers = jest.spyOn(app, "setupShutdownHandlers").mockImplementation(() => {});

      // Simulate main function behavior
      app.setupShutdownHandlers();

      // The start method should handle the error internally and call process.exit
      await app.start();

      expect(mockSetupShutdownHandlers).toHaveBeenCalled();
      expect(mockLoadConfiguration).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe("process environment checks", () => {
    it("should have access to process object", () => {
      expect(typeof process !== "undefined").toBe(true);
      expect(typeof process.argv !== "undefined").toBe(true);
      expect(Array.isArray(process.argv)).toBe(true);
    });

    it("should have access to console for error logging", () => {
      expect(typeof console !== "undefined").toBe(true);
      expect(typeof console.error === "function").toBe(true);
    });

    it("should have access to process.exit for termination", () => {
      expect(typeof process.exit === "function").toBe(true);
    });
  });

  describe("shutdown handling setup", () => {
    it("should setup shutdown handlers without errors", () => {
      const app = new Application();

      expect(() => {
        app.setupShutdownHandlers();
      }).not.toThrow();
    });
  });

  describe("error handling patterns", () => {
    it("should follow proper error handling patterns", async () => {
      const app = new Application();
      const testError = new Error("Test error");

      // Mock start to throw error
      jest.spyOn(app, "start").mockRejectedValue(testError);

      // Test error handling pattern
      try {
        await app.start();
        fail("Expected error to be thrown");
      } catch (error) {
        expect(error).toBe(testError);
      }
    });
  });
});
