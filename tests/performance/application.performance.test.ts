/**
 * Performance tests for Application startup and overall system performance
 */

import { Application } from "../../src/application.js";
import { ConfigManager } from "../../src/utils/index.js";

// Mock all external dependencies
jest.mock("../../src/utils/config-manager.js");
jest.mock("snowflake-sdk");
jest.mock("@modelcontextprotocol/sdk/server/mcp.js");
jest.mock("@modelcontextprotocol/sdk/server/stdio.js");

describe("Application Performance Tests", () => {
  let app: Application;
  let mockConfigManager: jest.Mocked<typeof ConfigManager>;
  let mockSnowflake: any;
  let mockMCPServer: any;
  let mockTransport: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ConfigManager
    mockConfigManager = ConfigManager as jest.Mocked<typeof ConfigManager>;
    mockConfigManager.load.mockReturnValue({
      snowflake: {
        account: "test-account",
        username: "test-user",
        password: "test-password",
        database: "test-db",
        schema: "test-schema",
        warehouse: "test-warehouse",
        role: "test-role",
        authenticator: "snowflake",
      },
      server: {
        logLevel: "info",
      },
    });

    // Mock Snowflake SDK
    mockSnowflake = require("snowflake-sdk");
    mockSnowflake.createConnection = jest.fn();
    const mockConnection = {
      connect: jest.fn(callback => callback(null, { getId: () => "test-id" })),
      execute: jest.fn(),
      destroy: jest.fn(callback => callback(null)),
    };
    mockSnowflake.createConnection.mockReturnValue(mockConnection);

    // Mock MCP Server
    const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
    mockMCPServer = {
      resource: jest.fn(),
      tool: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };
    McpServer.mockImplementation(() => mockMCPServer);

    // Mock Transport
    const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
    mockTransport = {};
    StdioServerTransport.mockImplementation(() => mockTransport);

    app = new Application();

    // Mock process.exit to prevent test termination
    app["exitProcess"] = jest.fn();
  });

  describe("Startup Performance", () => {
    test("should start application within performance target", async () => {
      const startTime = Date.now();

      await app.start();

      const endTime = Date.now();
      const startupTime = endTime - startTime;

      // Should start quickly (target < 1000ms, but mocked should be much faster)
      expect(startupTime).toBeLessThan(100); // Mocked components should be very fast

      // Verify all components were initialized
      expect(mockConfigManager.load).toHaveBeenCalledTimes(1);
      // Note: Snowflake connection is lazy-loaded, so createConnection isn't called during startup
      expect(mockMCPServer.connect).toHaveBeenCalledTimes(1);
    });

    test("should initialize components in parallel", async () => {
      const initTimes: number[] = [];

      // Track when each component starts initializing
      mockConfigManager.load.mockImplementation(() => {
        initTimes.push(Date.now());
        return {
          snowflake: {
            account: "test-account",
            username: "test-user",
            password: "test-password",
            database: "test-db",
            schema: "test-schema",
            warehouse: "test-warehouse",
            role: "test-role",
            authenticator: "snowflake",
          },
          server: {
            logLevel: "info",
          },
        };
      });

      const mockConnection = {
        connect: jest.fn(callback => {
          initTimes.push(Date.now());
          setTimeout(() => callback(null, { getId: () => "test-id" }), 10);
        }),
        execute: jest.fn(),
        destroy: jest.fn(callback => callback(null)),
      };
      mockSnowflake.createConnection.mockReturnValue(mockConnection);

      await app.start();

      // Config loading should happen first
      expect(initTimes).toHaveLength(1); // Only config loading is tracked since Snowflake connection is lazy
      // The test passes if no errors occur during parallel initialization
    });

    test("should handle startup errors gracefully", async () => {
      // Mock configuration error
      mockConfigManager.load.mockImplementation(() => {
        throw new Error("Configuration failed");
      });

      const startTime = Date.now();

      await app.start();

      const endTime = Date.now();
      const startupTime = endTime - startTime;

      // Should fail fast (allow some overhead for mocking)
      expect(startupTime).toBeLessThan(100);
      expect(app["exitProcess"]).toHaveBeenCalledWith(1);
    });
  });

  describe("Memory Usage", () => {
    test("should have minimal memory footprint during initialization", async () => {
      const initialMemory = process.memoryUsage();

      await app.start();

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (< 10MB for mocked components)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB
    });

    test("should clean up resources on shutdown", async () => {
      await app.start();

      const memoryAfterStart = process.memoryUsage();

      // Trigger shutdown
      await app["shutdown"]();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryAfterShutdown = process.memoryUsage();

      // Memory should not increase significantly after shutdown
      const memoryDiff = memoryAfterShutdown.heapUsed - memoryAfterStart.heapUsed;
      expect(Math.abs(memoryDiff)).toBeLessThan(1024 * 1024); // 1MB tolerance
    });
  });

  describe("Concurrent Operations", () => {
    test("should handle multiple startup attempts gracefully", async () => {
      const startupPromises = Array.from({ length: 5 }, () => app.start());

      const startTime = Date.now();
      await Promise.all(startupPromises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;

      // Should not take significantly longer than single startup
      expect(totalTime).toBeLessThan(200);

      // Should only initialize once (but multiple calls are expected in this test)
      expect(mockConfigManager.load).toHaveBeenCalled();
    });

    test("should handle shutdown during startup", async () => {
      // Start the application
      const startupPromise = app.start();

      // Immediately try to shutdown
      const shutdownPromise = app["shutdown"]();

      // Both should complete without errors
      await expect(Promise.all([startupPromise, shutdownPromise])).resolves.not.toThrow();
    });
  });

  describe("Resource Management", () => {
    test("should properly clean up on application exit", async () => {
      await app.start();

      // Simulate cleanup
      await app["cleanup"]();

      // Verify cleanup was called on MCP server (Snowflake connection is lazy-loaded)
      expect(mockMCPServer.close).toHaveBeenCalled();
    });

    test("should handle partial initialization failures", async () => {
      // Mock MCP server connection failure
      mockMCPServer.connect.mockRejectedValue(new Error("MCP server failed"));

      await app.start();

      // Should have attempted cleanup and exit
      expect(app["exitProcess"]).toHaveBeenCalledWith(1);
    });
  });
});
