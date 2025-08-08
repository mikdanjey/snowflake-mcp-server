/**
 * Concurrency performance tests for the entire system
 * Tests concurrent query handling and system behavior under load
 */

import { SnowflakeResourceHandler } from "../../src/handlers/snowflake-resource-handler.js";
import { SnowflakeClient } from "../../src/clients/snowflake-client.js";
import { SQLValidator } from "../../src/validators/sql-validator.js";
import type { SnowflakeConfig } from "../../src/types/index.js";

// Mock the snowflake-sdk
jest.mock("snowflake-sdk", () => ({
  createConnection: jest.fn(),
}));

describe("Concurrency Performance Tests", () => {
  let handler: SnowflakeResourceHandler;
  let client: SnowflakeClient;
  let validator: SQLValidator;
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

    client = new SnowflakeClient(testConfig);
    validator = new SQLValidator();
    handler = new SnowflakeResourceHandler(client, validator);
  });

  describe("Concurrent Query Handling", () => {
    beforeEach(() => {
      // Mock successful query execution
      mockConnection.execute.mockImplementation((options: any) => {
        const executionTime = Math.random() * 100 + 50; // 50-150ms random execution time
        setTimeout(() => {
          options.complete(null, { getColumns: () => [] }, [{ id: 1, name: "test", value: Math.random() }]);
        }, executionTime);
      });
    });

    test("should handle multiple concurrent queries efficiently", async () => {
      const queryCount = 10;
      const queries = Array.from({ length: queryCount }, (_, i) => `SELECT ${i} as query_id, 'test' as name`);

      const startTime = Date.now();

      // Execute all queries concurrently
      const results = await Promise.all(queries.map(sql => handler.handleQuery({ sql })));

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete in reasonable time (less than sequential execution)
      expect(totalTime).toBeLessThan(500); // Should be much faster than 10 * 150ms

      // All queries should succeed
      expect(results).toHaveLength(queryCount);
      results.forEach((result, i) => {
        expect(result).toHaveProperty("rows");
        expect(result).toHaveProperty("rowCount");
        expect(result).toHaveProperty("executionTime");
        expect((result as any).error).toBeUndefined();
      });
    });

    test("should maintain performance under high concurrency", async () => {
      const highConcurrency = 50;
      const queries = Array.from({ length: highConcurrency }, (_, i) => `SELECT ${i} as id, NOW() as timestamp`);

      const startTime = Date.now();

      const results = await Promise.all(queries.map(sql => handler.handleQuery({ sql })));

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTimePerQuery = totalTime / highConcurrency;

      // Average time per query should be reasonable
      expect(avgTimePerQuery).toBeLessThan(50); // Less than 50ms average per query

      // All queries should succeed
      const successfulQueries = results.filter(result => !(result as any).error);
      expect(successfulQueries).toHaveLength(highConcurrency);
    });

    test("should handle mixed query complexities concurrently", async () => {
      const queries = [
        "SELECT 1",
        "SELECT * FROM table1 JOIN table2 ON table1.id = table2.id",
        "SELECT * FROM table1 t1 JOIN table2 t2 ON t1.id = t2.id JOIN table3 t3 ON t2.id = t3.id",
        "SELECT COUNT(*) FROM users",
        "SELECT * FROM orders WHERE date > CURRENT_DATE - INTERVAL 30 DAY",
      ];

      // Mock different execution times based on complexity
      mockConnection.execute.mockImplementation((options: any) => {
        const sql = options.sqlText.toUpperCase();
        let executionTime = 50; // Base time

        if (sql.includes("JOIN")) {
          executionTime += sql.split("JOIN").length * 30; // Add time for joins
        }
        if (sql.includes("WHERE") || sql.includes("INTERVAL")) {
          executionTime += 20; // Add time for complex conditions
        }

        setTimeout(() => {
          options.complete(null, { getColumns: () => [] }, [{ result: "success" }]);
        }, executionTime);
      });

      const startTime = Date.now();

      const results = await Promise.all(queries.map(query => handler.handleQuery({ sql: query })));

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete efficiently despite mixed complexity
      expect(totalTime).toBeLessThan(300);

      // All queries should succeed
      results.forEach(result => {
        expect(result).toHaveProperty("rows");
        expect((result as any).error).toBeUndefined();
      });
    });
  });

  describe("Error Handling Under Concurrency", () => {
    test("should handle partial failures in concurrent queries", async () => {
      let queryCount = 0;

      // Mock some queries to fail
      mockConnection.execute.mockImplementation((options: any) => {
        queryCount++;
        const shouldFail = queryCount % 3 === 0; // Every 3rd query fails

        setTimeout(() => {
          if (shouldFail) {
            options.complete(new Error("Simulated query failure"));
          } else {
            options.complete(null, { getColumns: () => [] }, [{ success: true }]);
          }
        }, 50);
      });

      const queries = Array.from({ length: 9 }, (_, i) => `SELECT ${i} as id`);

      const results = await Promise.all(queries.map(sql => handler.handleQuery({ sql })));

      // Should have mix of successes and failures
      const successes = results.filter(result => !(result as any).error);
      const failures = results.filter(result => (result as any).error);

      expect(successes).toHaveLength(6); // 2/3 should succeed
      expect(failures).toHaveLength(3); // 1/3 should fail

      // Failures should have proper error structure
      failures.forEach(failure => {
        expect(failure).toHaveProperty("error");
        expect((failure as any).error).toHaveProperty("code");
        expect((failure as any).error).toHaveProperty("message");
      });
    });

    test("should handle timeout scenarios under load", async () => {
      // Mock slow queries that timeout
      mockConnection.execute.mockImplementation((options: any) => {
        // Simulate timeout by calling complete with an error after a delay
        setTimeout(() => {
          options.complete(new Error("Query execution timeout"), null, null);
        }, 100);
      });

      const queries = Array.from({ length: 5 }, (_, i) => `SELECT ${i} as id`);

      const startTime = Date.now();

      const results = await Promise.all(queries.map(sql => handler.handleQuery({ sql })));

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete quickly with timeout errors
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second

      // All should be execution errors (timeout or other execution failures)
      results.forEach(result => {
        expect(result).toHaveProperty("error");
        expect((result as any).error.message).toContain("execution");
      });
    });
  });

  describe("Resource Usage Under Load", () => {
    test("should maintain stable memory usage during concurrent operations", async () => {
      const initialMemory = process.memoryUsage();

      // Execute many concurrent queries
      const queryBatches = Array.from({ length: 5 }, () => Array.from({ length: 10 }, (_, i) => `SELECT ${i} as batch_query`));

      // Mock quick execution
      mockConnection.execute.mockImplementation((options: any) => {
        setTimeout(() => {
          options.complete(null, { getColumns: () => [] }, [{ data: "test" }]);
        }, 10);
      });

      // Execute batches sequentially to test sustained load
      for (const batch of queryBatches) {
        await Promise.all(batch.map(sql => handler.handleQuery({ sql })));
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });

    test("should handle connection statistics during concurrent operations", async () => {
      // Mock query execution
      mockConnection.execute.mockImplementation((options: any) => {
        setTimeout(() => {
          options.complete(null, { getColumns: () => [] }, [{ test: true }]);
        }, 25);
      });

      const queries = Array.from({ length: 20 }, (_, i) => `SELECT ${i} as concurrent_test`);

      // Start queries and check stats during execution
      const queryPromises = queries.map(sql => handler.handleQuery({ sql }));

      // Give queries time to start
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = client.getConnectionStats();

      // Should show active queries
      expect(stats.activeQueries).toBeGreaterThan(0);
      expect(stats.isConnected).toBe(true);

      // Wait for all to complete
      await Promise.all(queryPromises);

      const finalStats = client.getConnectionStats();
      expect(finalStats.activeQueries).toBe(0);
    });
  });
});
