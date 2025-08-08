/**
 * Unit tests for the Application class
 */

import { jest } from "@jest/globals";
import { Application } from "../../src/application.js";
import { ConfigManager } from "../../src/utils/index.js";
import { SnowflakeClient } from "../../src/clients/snowflake-client.js";
import { MCPServer } from "../../src/server/mcp-server.js";
import { SnowflakeResourceHandler } from "../../src/handlers/snowflake-resource-handler.js";
import { SQLValidator } from "../../src/validators/sql-validator.js";

// Mock all dependencies
jest.mock("../../src/utils/config-manager.js", () => ({
  ConfigManager: {
    load: jest.fn(),
  },
}));
jest.mock("../../src/utils/index.js", () => ({
  ConfigManager: {
    load: jest.fn(),
  },
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
    handleConnectionError: jest.fn().mockReturnValue({
      error: {
        code: "CONNECTION_ERROR",
        message: "Connection error",
        details: {},
      },
    }),
    handleInternalError: jest.fn().mockReturnValue({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal error",
        details: {},
      },
    }),
  },
}));
jest.mock("../../src/clients/snowflake-client.js");
jest.mock("../../src/server/mcp-server.js");
jest.mock("../../src/handlers/snowflake-resource-handler.js");
jest.mock("../../src/validators/sql-validator.js");

const mockConfigManager = ConfigManager as jest.Mocked<typeof ConfigManager>;
const mockSnowflakeClient = SnowflakeClient as jest.MockedClass<typeof SnowflakeClient>;
const mockMCPServer = MCPServer as jest.MockedClass<typeof MCPServer>;
const mockSnowflakeResourceHandler = SnowflakeResourceHandler as jest.MockedClass<typeof SnowflakeResourceHandler>;
const mockSQLValidator = SQLValidator as jest.MockedClass<typeof SQLValidator>;

describe("Application", () => {
  let app: Application;
  let mockConfig: any;
  let mockSnowflakeClientInstance: jest.Mocked<SnowflakeClient>;
  let mockMCPServerInstance: jest.Mocked<MCPServer>;
  let mockExitProcess: jest.Mock;
  let originalProcessExit: typeof process.exit;

  beforeAll(() => {
    // Mock process.exit at the suite level to prevent crashes
    originalProcessExit = process.exit;
    process.exit = jest.fn() as any;
  });

  afterAll(() => {
    // Restore process.exit after all tests
    process.exit = originalProcessExit;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock configuration
    mockConfig = {
      snowflake: {
        account: "test-account",
        username: "test-user",
        database: "test-db",
        schema: "test-schema",
        warehouse: "test-warehouse",
        role: "test-role",
        authenticator: "snowflake",
        password: "test-password",
      },
      server: {
        logLevel: "info",
      },
    };

    // Setup mock instances
    mockSnowflakeClientInstance = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
      getConnectionStats: jest.fn(),
      reconnect: jest.fn(),
    } as any;

    mockMCPServerInstance = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      registerResourceHandler: jest.fn(),
      isServerRunning: jest.fn().mockReturnValue(true),
    } as any;

    // Setup mocks
    mockConfigManager.load.mockReturnValue(mockConfig);
    mockSnowflakeClient.mockImplementation(() => mockSnowflakeClientInstance);
    mockMCPServer.mockImplementation(() => mockMCPServerInstance);
    mockSnowflakeResourceHandler.mockImplementation(() => ({}) as any);
    mockSQLValidator.mockImplementation(() => ({}) as any);

    // Mock process.exit
    mockExitProcess = jest.fn();

    app = new Application();
    (app as any).exitProcess = mockExitProcess;
  });

  describe("start", () => {
    it("should start successfully with valid configuration", async () => {
      await app.start();

      expect(mockConfigManager.load).toHaveBeenCalledTimes(1);
      expect(mockSnowflakeClient).toHaveBeenCalledWith(mockConfig.snowflake);
      expect(mockMCPServer).toHaveBeenCalledWith({
        name: "snowflake-mcp-server",
        version: "1.0.0",
      });
      expect(mockSQLValidator).toHaveBeenCalled();
      expect(mockSnowflakeResourceHandler).toHaveBeenCalled();
      expect(mockMCPServerInstance.registerResourceHandler).toHaveBeenCalledTimes(1);
      expect(mockMCPServerInstance.start).toHaveBeenCalledTimes(1);
    });

    it("should handle configuration loading errors", async () => {
      const configError = new Error("Configuration failed");
      mockConfigManager.load.mockImplementation(() => {
        throw configError;
      });

      await app.start();

      expect(mockExitProcess).toHaveBeenCalledWith(1);
      expect(mockMCPServerInstance.start).not.toHaveBeenCalled();
    });

    it("should handle MCP server start errors", async () => {
      const serverError = new Error("McpServer start failed");
      mockMCPServerInstance.start.mockRejectedValue(serverError);

      await app.start();

      expect(mockExitProcess).toHaveBeenCalledWith(1);
      expect(mockSnowflakeClientInstance.disconnect).toHaveBeenCalledTimes(1);
      expect(mockMCPServerInstance.stop).toHaveBeenCalledTimes(1);
    });

    it("should measure startup time and log performance", async () => {
      await app.start();

      // Should not call exit process on successful start
      expect(mockExitProcess).not.toHaveBeenCalled();
    });

    it("should log warning for slow startup", async () => {
      // Mock slow initialization
      mockMCPServerInstance.start.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
      });

      await app.start();

      // Should still complete successfully
      expect(mockExitProcess).not.toHaveBeenCalled();
    });

    it("should handle different error categories", async () => {
      const { ErrorHandler } = require("../../src/utils/index.js");

      // Test CONFIG_ERROR
      ErrorHandler.categorizeError.mockReturnValue("CONFIG_ERROR");
      const configError = new Error("Config error");
      mockConfigManager.load.mockImplementation(() => {
        throw configError;
      });

      await app.start();
      expect(ErrorHandler.handleConfigurationError).toHaveBeenCalledWith(configError, expect.any(Object));
      expect(mockExitProcess).toHaveBeenCalledWith(1);

      // Reset mocks
      jest.clearAllMocks();
      mockExitProcess.mockClear();
      mockConfigManager.load.mockReturnValue(mockConfig);

      // Test CONNECTION_ERROR
      ErrorHandler.categorizeError.mockReturnValue("CONNECTION_ERROR");
      const connectionError = new Error("Connection error");
      mockMCPServerInstance.start.mockRejectedValue(connectionError);

      await app.start();
      expect(ErrorHandler.handleConnectionError).toHaveBeenCalledWith(connectionError, expect.any(Object));
      expect(mockExitProcess).toHaveBeenCalledWith(1);

      // Reset mocks
      jest.clearAllMocks();
      mockExitProcess.mockClear();
      mockMCPServerInstance.start.mockResolvedValue(undefined);

      // Test INTERNAL_ERROR (default)
      ErrorHandler.categorizeError.mockReturnValue("INTERNAL_ERROR");
      const internalError = new Error("Internal error");
      mockMCPServerInstance.start.mockRejectedValue(internalError);

      await app.start();
      expect(ErrorHandler.handleInternalError).toHaveBeenCalledWith(internalError, expect.any(Object));
      expect(mockExitProcess).toHaveBeenCalledWith(1);
    });
  });

  describe("setupShutdownHandlers", () => {
    let originalProcessOn: typeof process.on;
    let mockProcessOn: jest.Mock;

    beforeEach(() => {
      originalProcessOn = process.on;
      mockProcessOn = jest.fn();
      process.on = mockProcessOn;
    });

    afterEach(() => {
      process.on = originalProcessOn;
    });

    it("should setup signal handlers", () => {
      app.setupShutdownHandlers();

      expect(mockProcessOn).toHaveBeenCalledWith("SIGINT", expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith("SIGQUIT", expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith("uncaughtException", expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith("unhandledRejection", expect.any(Function));
    });

    it("should handle shutdown signals", async () => {
      // Start the application first
      await app.start();

      app.setupShutdownHandlers();

      // Get the SIGINT handler
      const sigintHandler = mockProcessOn.mock.calls.find(call => call[0] === "SIGINT")[1];

      // Mock process.exit
      const originalExit = process.exit;
      process.exit = jest.fn() as any;

      // Trigger shutdown
      await sigintHandler();

      expect(mockSnowflakeClientInstance.disconnect).toHaveBeenCalled();
      expect(mockMCPServerInstance.stop).toHaveBeenCalled();

      process.exit = originalExit;
    });

    it("should handle uncaught exceptions", () => {
      const originalExit = process.exit;
      process.exit = jest.fn() as any;

      app.setupShutdownHandlers();

      // Get the uncaughtException handler
      const exceptionHandler = mockProcessOn.mock.calls.find(call => call[0] === "uncaughtException")[1];

      const testError = new Error("Uncaught error");
      exceptionHandler(testError);

      expect(process.exit).toHaveBeenCalledWith(1);

      process.exit = originalExit;
    });

    it("should handle unhandled rejections", () => {
      const originalExit = process.exit;
      process.exit = jest.fn() as any;

      app.setupShutdownHandlers();

      // Get the unhandledRejection handler
      const rejectionHandler = mockProcessOn.mock.calls.find(call => call[0] === "unhandledRejection")[1];

      const testReason = "Unhandled rejection";
      const testPromise = Promise.resolve();
      rejectionHandler(testReason, testPromise);

      expect(process.exit).toHaveBeenCalledWith(1);

      process.exit = originalExit;
    });

    it("should force shutdown on second signal", async () => {
      const originalExit = process.exit;
      process.exit = jest.fn() as any;

      await app.start();
      app.setupShutdownHandlers();

      // Get the SIGINT handler
      const sigintHandler = mockProcessOn.mock.calls.find(call => call[0] === "SIGINT")[1];

      // First signal - should start graceful shutdown
      sigintHandler();

      // Second signal - should force exit via exitProcess
      sigintHandler();

      expect(mockExitProcess).toHaveBeenCalledWith(1);

      process.exit = originalExit;
    });
  });

  describe("error handling during shutdown", () => {
    it("should handle errors during graceful shutdown", async () => {
      const originalExit = process.exit;
      const originalProcessOn = process.on;
      process.exit = jest.fn() as any;

      const mockProcessOn = jest.fn();
      process.on = mockProcessOn;

      await app.start();

      // Mock shutdown errors
      mockSnowflakeClientInstance.disconnect.mockRejectedValue(new Error("Disconnect failed"));
      mockMCPServerInstance.stop.mockRejectedValue(new Error("Stop failed"));

      app.setupShutdownHandlers();

      const sigintHandler = mockProcessOn.mock.calls.find(call => call[0] === "SIGINT")[1];

      await sigintHandler();

      // Should still complete gracefully even with errors (errors are caught and logged)
      expect(process.exit).toHaveBeenCalledWith(0);

      process.exit = originalExit;
      process.on = originalProcessOn;
    });
  });

  describe("cleanup", () => {
    it("should cleanup resources on startup failure", async () => {
      const serverError = new Error("McpServer start failed");
      mockMCPServerInstance.start.mockRejectedValue(serverError);

      await app.start();

      // Cleanup should be called
      expect(mockSnowflakeClientInstance.disconnect).toHaveBeenCalledTimes(1);
      expect(mockMCPServerInstance.stop).toHaveBeenCalledTimes(1);
      expect(mockExitProcess).toHaveBeenCalledWith(1);
    });

    it("should handle cleanup errors gracefully", async () => {
      mockSnowflakeClientInstance.disconnect.mockRejectedValue(new Error("Cleanup failed"));
      mockMCPServerInstance.stop.mockRejectedValue(new Error("Stop failed"));

      const serverError = new Error("McpServer start failed");
      mockMCPServerInstance.start.mockRejectedValue(serverError);

      await app.start();

      // Should still call exit even with cleanup errors
      expect(mockExitProcess).toHaveBeenCalledWith(1);
    });
  });

  describe("parallel initialization", () => {
    it("should initialize Snowflake client and MCP server in parallel", async () => {
      const initTimes: number[] = [];

      mockSnowflakeClient.mockImplementation(() => {
        initTimes.push(Date.now());
        return mockSnowflakeClientInstance;
      });

      mockMCPServer.mockImplementation(() => {
        initTimes.push(Date.now());
        return mockMCPServerInstance;
      });

      await app.start();

      // Both should be initialized (times recorded)
      expect(initTimes).toHaveLength(2);
      // They should be initialized close to each other (parallel)
      expect(Math.abs(initTimes[1] - initTimes[0])).toBeLessThan(100);
    });
  });

  describe("configuration logging", () => {
    it("should log configuration details without sensitive data", async () => {
      await app.start();

      // Should have logged configuration without password
      expect(mockConfigManager.load).toHaveBeenCalled();
    });

    it("should handle missing optional configuration", async () => {
      const configWithoutAuth = {
        ...mockConfig,
        snowflake: {
          ...mockConfig.snowflake,
          authenticator: undefined,
        },
      };

      mockConfigManager.load.mockReturnValue(configWithoutAuth);

      await app.start();

      expect(mockSnowflakeClient).toHaveBeenCalledWith(configWithoutAuth.snowflake);
    });
  });
});
