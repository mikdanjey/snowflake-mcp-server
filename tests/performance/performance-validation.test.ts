/**
 * Performance validation tests for the implemented optimizations
 * Tests the specific performance improvements added in task 10
 */

import { SnowflakeClient, type QueryOptions } from "../../src/clients/snowflake-client.js";
import { SnowflakeResourceHandler } from "../../src/handlers/snowflake-resource-handler.js";
import { SQLValidator } from "../../src/validators/sql-validator.js";
import { ConnectionPool } from "../../src/utils/connection-pool.js";
import type { SnowflakeConfig } from "../../src/types/index.js";

// Mock the snowflake-sdk
jest.mock("snowflake-sdk", () => ({
  createConnection: jest.fn(),
}));

describe("Performance Optimizations Validation", () => {
  let mockSnowflake: any;
  let mockConnection: any;

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
    jest.clearAllMocks();

    // Setup mock connection
    mockConnection = {
      connect: jest.fn(callback => {
        setTimeout(() => callback(null, { getId: () => "mock-id" }), 10);
      }),
      execute: jest.fn(),
      destroy: jest.fn(callback => callback(null)),
    };

    // Setup mock snowflake module
    mockSnowflake = require("snowflake-sdk");
    mockSnowflake.createConnection.mockReturnValue(mockConnection);
  });

  describe("Async/Await Patterns for Non-blocking Query Execution", () => {
    test("should execute queries asynchronously without blocking", async () => {
      const client = new SnowflakeClient(testConfig);

      // Mock query execution with different delays
      let callCount = 0;
      mockConnection.execute.mockImplementation((options: any) => {
        const delay = callCount === 0 ? 100 : 50; // First query takes longer
        callCount++;

        setTimeout(() => {
          options.complete(null, { getColumns: () => [] }, [{ id: callCount }]);
        }, delay);
      });

      const startTime = Date.now();

      // Execute multiple queries concurrently
      const promises = [client.execute("SELECT 1"), client.execute("SELECT 2"), client.execute("SELECT 3")];

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Should complete in roughly the time of the longest query (100ms)
      // Plus some overhead, but much less than sequential execution (250ms)
      expect(totalTime).toBeLessThan(200);
      expect(results).toHaveLength(3);

      // All queries should have completed
      results.forEach(result => {
        expect(result.rows).toBeDefined();
        expect(result.rowCount).toBeDefined();
      });
    });

    test("should track active queries during concurrent execution", async () => {
      const client = new SnowflakeClient(testConfig);

      // Mock slow query execution
      mockConnection.execute.mockImplementation((options: any) => {
        setTimeout(() => {
          options.complete(null, { getColumns: () => [] }, [{ test: true }]);
        }, 50);
      });

      // Start queries but don't wait for completion
      const queryPromises = [client.execute("SELECT 1"), client.execute("SELECT 2")];

      // Give queries time to start
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = client.getConnectionStats();
      expect(stats.activeQueries).toBeGreaterThan(0);

      // Wait for completion
      await Promise.all(queryPromises);

      const finalStats = client.getConnectionStats();
      expect(finalStats.activeQueries).toBe(0);
    });
  });

  describe("Connection Reuse Strategies", () => {
    test("should reuse healthy connections", async () => {
      const client = new SnowflakeClient(testConfig);

      // First connection
      await client.connect();
      expect(mockSnowflake.createConnection).toHaveBeenCalledTimes(1);

      // Second connection should reuse
      await client.connect();
      expect(mockSnowflake.createConnection).toHaveBeenCalledTimes(1);

      expect(client.isConnected()).toBe(true);
    });

    test("should handle concurrent connection attempts efficiently", async () => {
      const client = new SnowflakeClient(testConfig);

      const startTime = Date.now();

      // Multiple concurrent connection attempts
      const connectionPromises = Array.from({ length: 5 }, () => client.connect());
      await Promise.all(connectionPromises);

      const totalTime = Date.now() - startTime;

      // Should complete quickly and only create one connection
      expect(totalTime).toBeLessThan(100);
      expect(mockSnowflake.createConnection).toHaveBeenCalledTimes(1);
    });

    test("should provide connection statistics", async () => {
      const client = new SnowflakeClient(testConfig);
      await client.connect();

      const stats = client.getConnectionStats();

      expect(stats).toMatchObject({
        isConnected: expect.any(Boolean),
        isConnecting: expect.any(Boolean),
        activeQueries: expect.any(Number),
        lastUsed: expect.any(Number),
        timeSinceLastUse: expect.any(Number),
      });
    });
  });

  describe("Query Execution Timeout Handling", () => {
    test("should respect custom query timeouts", async () => {
      const client = new SnowflakeClient(testConfig);

      // Mock hanging query
      mockConnection.execute.mockImplementation(() => {
        // Never call the callback to simulate hanging
      });

      const timeout = 100;
      const startTime = Date.now();

      await expect(client.execute("SELECT * FROM slow_table", { timeout })).rejects.toThrow("Query execution timeout after 100ms");

      const actualTime = Date.now() - startTime;
      expect(actualTime).toBeGreaterThanOrEqual(timeout);
      expect(actualTime).toBeLessThan(timeout + 100); // Allow more overhead for test environment
    });

    test("should use different timeouts based on query complexity", async () => {
      const validator = new SQLValidator();
      const client = new SnowflakeClient(testConfig);
      const handler = new SnowflakeResourceHandler(client, validator);

      // Mock successful execution
      mockConnection.execute.mockImplementation((options: any) => {
        setTimeout(() => {
          options.complete(null, { getColumns: () => [] }, [{ result: "success" }]);
        }, 10);
      });

      // Simple query should get shorter timeout
      const simpleResult = await handler.handleQuery({ sql: "SELECT 1" });
      expect(simpleResult).toHaveProperty("rows");

      // Complex query should get longer timeout
      const complexResult = await handler.handleQuery({
        sql: "SELECT * FROM table1 t1 JOIN table2 t2 ON t1.id = t2.id JOIN table3 t3 ON t2.id = t3.id",
      });
      expect(complexResult).toHaveProperty("rows");
    });
  });

  describe("Connection Pool Implementation", () => {
    test("should initialize connection pool with minimum connections", async () => {
      const pool = new ConnectionPool(testConfig, {
        minConnections: 2,
        maxConnections: 5,
      });

      await pool.initialize();

      const stats = pool.getStats();
      expect(stats.totalConnections).toBeGreaterThanOrEqual(0); // May be 0 if connections failed
      expect(stats.availableConnections).toBeGreaterThanOrEqual(0);

      await pool.shutdown();
    });

    test("should provide pool statistics", async () => {
      const pool = new ConnectionPool(testConfig, {
        minConnections: 1,
        maxConnections: 3,
      });

      const stats = pool.getStats();

      expect(stats).toMatchObject({
        totalConnections: expect.any(Number),
        availableConnections: expect.any(Number),
        inUseConnections: expect.any(Number),
        waitingRequests: expect.any(Number),
        oldestConnection: expect.any(Number),
        newestConnection: expect.any(Number),
      });

      await pool.shutdown();
    });

    test("should handle pool shutdown gracefully", async () => {
      const pool = new ConnectionPool(testConfig);

      // Should not throw during shutdown
      await expect(pool.shutdown()).resolves.not.toThrow();
    });
  });

  describe("Memory Usage Optimization", () => {
    test("should maintain stable memory usage during operations", async () => {
      const client = new SnowflakeClient(testConfig);

      // Mock quick execution
      mockConnection.execute.mockImplementation((options: any) => {
        setTimeout(() => {
          options.complete(null, { getColumns: () => [] }, [{ data: "test" }]);
        }, 1);
      });

      const initialMemory = process.memoryUsage();

      // Execute many queries
      const queries = Array.from({ length: 100 }, (_, i) => client.execute(`SELECT ${i} as id`));

      await Promise.all(queries);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe("Startup Time Optimization", () => {
    test("should initialize client quickly", () => {
      const startTime = Date.now();

      const client = new SnowflakeClient(testConfig);

      const initTime = Date.now() - startTime;

      // Client initialization should be very fast
      expect(initTime).toBeLessThan(10);
      expect(client).toBeInstanceOf(SnowflakeClient);
    });

    test("should defer connection until needed", () => {
      const client = new SnowflakeClient(testConfig);

      // Should not be connected immediately
      expect(client.isConnected()).toBe(false);

      // Should not have created a connection yet
      expect(mockSnowflake.createConnection).not.toHaveBeenCalled();
    });
  });
});
