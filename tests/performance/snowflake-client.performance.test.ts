/**
 * Performance tests for SnowflakeClient
 * Tests concurrency, timeout handling, and connection reuse
 */

import { SnowflakeClient, type QueryOptions } from "../../src/clients/snowflake-client.js";
import type { SnowflakeConfig } from "../../src/types/index.js";

// Mock the snowflake-sdk
jest.mock("snowflake-sdk", () => ({
  createConnection: jest.fn(),
}));

describe("SnowflakeClient Performance Tests", () => {
  let client: SnowflakeClient;
  let mockConnection: any;
  let mockSnowflake: any;

  const testConfig: SnowflakeConfig = {
    account: "test-account",
    username: "test-user",
    password: "test-password",
    database: "test-db",
    schema: "test-schema",
    warehouse: "test-warehouse",
    role: "test-role",
    authenticator: "snowflake",
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock connection
    mockConnection = {
      connect: jest.fn(),
      execute: jest.fn(),
      destroy: jest.fn(),
      getId: jest.fn().mockReturnValue("mock-connection-id"),
    };

    // Setup mock snowflake module
    mockSnowflake = require("snowflake-sdk");
    mockSnowflake.createConnection.mockReturnValue(mockConnection);

    client = new SnowflakeClient(testConfig);
  });

  describe("Connection Reuse and Performance", () => {
    beforeEach(() => {
      // Mock successful connection
      mockConnection.connect.mockImplementation((callback: any) => {
        setTimeout(() => callback(null, mockConnection), 10);
      });
    });

    test("should reuse existing healthy connections", async () => {
      // First connection
      await client.connect();
      expect(mockSnowflake.createConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.connect).toHaveBeenCalledTimes(1);

      // Second connection should reuse
      await client.connect();
      expect(mockSnowflake.createConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.connect).toHaveBeenCalledTimes(1);
    });

    test("should handle concurrent connection attempts efficiently", async () => {
      const startTime = Date.now();

      // Start multiple concurrent connection attempts
      const connectionPromises = Array.from({ length: 10 }, () => client.connect());

      await Promise.all(connectionPromises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete quickly (under 100ms for mocked connections)
      expect(totalTime).toBeLessThan(100);

      // Should only create one actual connection
      expect(mockSnowflake.createConnection).toHaveBeenCalledTimes(1);
      expect(mockConnection.connect).toHaveBeenCalledTimes(1);
    });

    test("should provide connection statistics", async () => {
      await client.connect();

      const stats = client.getConnectionStats();

      expect(stats).toMatchObject({
        isConnected: true,
        isConnecting: false,
        activeQueries: 0,
        lastUsed: expect.any(Number),
        timeSinceLastUse: expect.any(Number),
      });

      expect(stats.timeSinceLastUse).toBeLessThan(100); // Should be very recent
    });
  });

  describe("Query Execution Performance", () => {
    beforeEach(async () => {
      // Setup successful connection
      mockConnection.connect.mockImplementation((callback: any) => {
        setTimeout(() => callback(null, mockConnection), 10);
      });

      await client.connect();
    });

    test("should handle concurrent queries efficiently", async () => {
      // Mock query execution
      mockConnection.execute.mockImplementation((options: any) => {
        setTimeout(() => {
          options.complete(null, { getColumns: () => [] }, [{ id: 1, name: "test" }]);
        }, 50); // 50ms execution time
      });

      const startTime = Date.now();
      const queryCount = 5;

      // Execute multiple queries concurrently
      const queryPromises = Array.from({ length: queryCount }, (_, i) => client.execute(`SELECT ${i} as id`));

      const results = await Promise.all(queryPromises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete in roughly the time of one query (due to concurrency)
      // Allow some overhead for test execution
      expect(totalTime).toBeLessThan(200);

      // All queries should succeed
      expect(results).toHaveLength(queryCount);
      results.forEach((result, i) => {
        expect(result.rows).toEqual([{ id: 1, name: "test" }]);
        expect(result.rowCount).toBe(1);
      });
    });

    test("should respect query timeouts", async () => {
      // Mock slow query execution
      mockConnection.execute.mockImplementation((options: any) => {
        // Never call the callback to simulate hanging query
      });

      const timeout = 100; // 100ms timeout
      const startTime = Date.now();

      await expect(client.execute("SELECT * FROM slow_table", { timeout })).rejects.toThrow("Query execution timeout after 100ms");

      const endTime = Date.now();
      const actualTime = endTime - startTime;

      // Should timeout close to the specified timeout
      expect(actualTime).toBeGreaterThanOrEqual(timeout);
      expect(actualTime).toBeLessThan(timeout + 200); // Allow 50ms overhead
    });

    test("should track active queries correctly", async () => {
      let executeCallback: any;

      // Mock query that we can control completion
      mockConnection.execute.mockImplementation((options: any) => {
        executeCallback = options.complete;
      });

      // Start a query but don't complete it
      const queryPromise = client.execute("SELECT * FROM test");

      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that active query is tracked
      const stats = client.getConnectionStats();
      expect(stats.activeQueries).toBe(1);

      // Complete the query
      executeCallback(null, { getColumns: () => [] }, []);
      await queryPromise;

      // Check that active query count is back to 0
      const finalStats = client.getConnectionStats();
      expect(finalStats.activeQueries).toBe(0);
    });
  });

  describe("Memory and Resource Management", () => {
    test("should clean up resources on disconnect", async () => {
      // Setup connection
      mockConnection.connect.mockImplementation((callback: any) => {
        callback(null, mockConnection);
      });

      mockConnection.destroy.mockImplementation((callback: any) => {
        callback(null);
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);

      await client.disconnect();
      expect(client.isConnected()).toBe(false);
      expect(mockConnection.destroy).toHaveBeenCalledTimes(1);
    });

    test("should handle connection recovery", async () => {
      // Initial connection
      mockConnection.connect.mockImplementation((callback: any) => {
        callback(null, mockConnection);
      });

      mockConnection.destroy.mockImplementation((callback: any) => {
        callback(null);
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);

      // Force reconnection
      await client.reconnect();
      expect(client.isConnected()).toBe(true);

      // Should have called destroy and connect again
      expect(mockConnection.destroy).toHaveBeenCalledTimes(1);
      expect(mockConnection.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe("Startup Performance", () => {
    test("should initialize client quickly", () => {
      const startTime = Date.now();

      const newClient = new SnowflakeClient(testConfig);

      const endTime = Date.now();
      const initTime = endTime - startTime;

      // Client initialization should be very fast (< 10ms)
      expect(initTime).toBeLessThan(10);
      expect(newClient).toBeInstanceOf(SnowflakeClient);
    });

    test("should defer connection until needed", () => {
      const newClient = new SnowflakeClient(testConfig);

      // Should not be connected immediately
      expect(newClient.isConnected()).toBe(false);

      // Should not have created a connection yet
      expect(mockSnowflake.createConnection).not.toHaveBeenCalled();
    });
  });
});
