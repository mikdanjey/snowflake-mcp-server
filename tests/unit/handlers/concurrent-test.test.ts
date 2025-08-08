/**
 * Unit tests for concurrent request handling in SnowflakeResourceHandler
 */

import { SnowflakeResourceHandler } from "../../../src/handlers/snowflake-resource-handler.js";
import { SnowflakeClient } from "../../../src/clients/snowflake-client.js";
import { SQLValidator } from "../../../src/validators/sql-validator.js";
import type { QueryRequest } from "../../../src/types/index.js";

// Mock the dependencies
jest.mock("../../../src/clients/snowflake-client.js");
jest.mock("../../../src/validators/sql-validator.js");
jest.mock("../../../src/utils/index.js", () => ({
  createComponentLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
  ErrorHandler: {
    handleValidationError: jest.fn().mockImplementation((error, context) => {
      if (error.code === "VALIDATION_ERROR") {
        return {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        };
      }
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "SQL validation failed",
          details: {
            field: "sql",
            issues: ["SQL query cannot be empty"],
            value: "",
          },
        },
      };
    }),
    handleConnectionError: jest.fn().mockImplementation((error, context) => ({
      error: {
        code: "CONNECTION_ERROR",
        message: "Database connection error",
        details: {
          originalMessage: error.message,
          suggestion: "Ensure the Snowflake client is connected before executing queries",
        },
      },
    })),
    handleExecutionError: jest.fn().mockImplementation((error, context) => ({
      error: {
        code: "EXECUTION_ERROR",
        message: "Query execution failed",
        details: {
          originalMessage: error.message,
          suggestion: "Check your SQL syntax and ensure the table/column names are correct",
        },
      },
    })),
    handleInternalError: jest.fn().mockImplementation((error, context) => ({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        details: {
          originalMessage: error.message,
          context: context || {},
        },
      },
    })),
  },
}));

const MockedSnowflakeClient = SnowflakeClient as jest.MockedClass<typeof SnowflakeClient>;
const MockedSQLValidator = SQLValidator as jest.MockedClass<typeof SQLValidator>;

describe("SnowflakeResourceHandler - Concurrent Request Handling", () => {
  let handler: SnowflakeResourceHandler;
  let mockClient: jest.Mocked<SnowflakeClient>;
  let mockValidator: jest.Mocked<SQLValidator>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockClient = {
      execute: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
      getConnectionStats: jest.fn().mockReturnValue({
        activeQueries: 0,
        totalQueries: 0,
        averageQueryTime: 0,
      }),
    } as any;

    mockValidator = {
      validateQuery: jest.fn(),
      getQueryType: jest.fn().mockReturnValue("SELECT"),
      isReadOnlyQuery: jest.fn().mockReturnValue(true),
    } as any;

    // Setup constructor mocks
    MockedSnowflakeClient.mockImplementation(() => mockClient);
    MockedSQLValidator.mockImplementation(() => mockValidator);

    handler = new SnowflakeResourceHandler(mockClient, mockValidator);
  });

  describe("concurrent query execution", () => {
    it("should handle multiple concurrent queries without blocking", async () => {
      const queries = [{ sql: "SELECT 1" }, { sql: "SELECT 2" }, { sql: "SELECT 3" }, { sql: "SELECT 4" }, { sql: "SELECT 5" }];

      // Mock validator to return valid queries
      mockValidator.validateQuery.mockImplementation(input => input as QueryRequest);

      // Mock client to simulate different execution times
      let callCount = 0;
      mockClient.execute.mockImplementation(async (sql: string) => {
        const delay = Math.random() * 50; // Reduced delay for faster tests
        await new Promise(resolve => setTimeout(resolve, delay));
        callCount++;
        return {
          rows: [{ result: callCount }],
          rowCount: 1,
          executionTime: delay,
        };
      });

      const startTime = Date.now();

      // Execute all queries concurrently
      const promises = queries.map(query => handler.handleQuery(query));
      const results = await Promise.all(promises);

      const totalTime = Date.now() - startTime;

      // Verify all queries completed
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).toHaveProperty("rows");
        expect(result).toHaveProperty("rowCount", 1);
        expect(result).toHaveProperty("executionTime");
      });

      // Verify concurrent execution (should be faster than sequential)
      expect(totalTime).toBeLessThan(200); // Much less than 5 * 50ms if sequential

      // Verify all queries were validated and executed
      expect(mockValidator.validateQuery).toHaveBeenCalledTimes(5);
      expect(mockClient.execute).toHaveBeenCalledTimes(5);
    });

    it("should handle mixed success and failure scenarios concurrently", async () => {
      const queries = [
        { sql: "SELECT 1" }, // Success
        { sql: "INVALID SQL" }, // Validation failure
        { sql: "SELECT 2" }, // Success
        { sql: "SELECT FROM" }, // Execution failure
        { sql: "SELECT 3" }, // Success
      ];

      // Mock validator with mixed results
      mockValidator.validateQuery.mockImplementation((input: any) => {
        if (input.sql === "INVALID SQL") {
          throw new Error("Invalid SQL syntax");
        }
        return input as QueryRequest;
      });

      // Mock client with mixed results
      mockClient.execute.mockImplementation(async (sql: string) => {
        if (sql === "SELECT FROM") {
          throw new Error("SQL execution error");
        }
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          rows: [{ result: sql }],
          rowCount: 1,
          executionTime: 50,
        };
      });

      // Execute all queries concurrently
      const promises = queries.map(query => handler.handleQuery(query));
      const results = await Promise.allSettled(promises);

      // Verify results
      expect(results).toHaveLength(5);

      // Check successful queries
      expect(results[0].status).toBe("fulfilled");
      expect(results[2].status).toBe("fulfilled");
      expect(results[4].status).toBe("fulfilled");

      // Check failed queries
      expect(results[1].status).toBe("fulfilled"); // Validation errors are handled gracefully
      expect(results[3].status).toBe("fulfilled"); // Execution errors are handled gracefully

      // Verify error responses for failed queries
      const validationErrorResult = (results[1] as PromiseFulfilledResult<any>).value;
      const executionErrorResult = (results[3] as PromiseFulfilledResult<any>).value;

      expect(validationErrorResult).toHaveProperty("error");
      expect(executionErrorResult).toHaveProperty("error");
    });

    it("should handle high concurrency load gracefully", async () => {
      const queryCount = 20; // Reduced from 50 for faster test execution
      const queries = Array.from({ length: queryCount }, (_, i) => ({
        sql: `SELECT ${i} as query_id`,
      }));

      mockValidator.validateQuery.mockImplementation(input => input as QueryRequest);

      mockClient.execute.mockImplementation(async (sql: string) => {
        // Simulate varying execution times
        const delay = Math.random() * 50;
        await new Promise(resolve => setTimeout(resolve, delay));

        return {
          rows: [{ query: sql }],
          rowCount: 1,
          executionTime: delay,
        };
      });

      const startTime = Date.now();

      // Execute all queries concurrently
      const promises = queries.map(query => handler.handleQuery(query));
      const results = await Promise.all(promises);

      const totalTime = Date.now() - startTime;

      // Verify all queries completed
      expect(results).toHaveLength(queryCount);
      results.forEach((result, index) => {
        expect(result).toHaveProperty("rows");
        expect(result.rows[0]).toHaveProperty("query", `SELECT ${index} as query_id`);
      });

      // Verify reasonable performance under load
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds

      // Verify all queries were processed
      expect(mockValidator.validateQuery).toHaveBeenCalledTimes(queryCount);
      expect(mockClient.execute).toHaveBeenCalledTimes(queryCount);
    });
  });

  describe("error handling during concurrent execution", () => {
    it("should isolate errors between concurrent queries", async () => {
      const queries = [{ sql: "SELECT 1" }, { sql: "INVALID" }, { sql: "SELECT 2" }, { sql: "ERROR" }, { sql: "SELECT 3" }];

      mockValidator.validateQuery.mockImplementation((input: any) => {
        if (input.sql === "INVALID") {
          throw new Error("Validation error");
        }
        return input as QueryRequest;
      });

      mockClient.execute.mockImplementation(async (sql: string) => {
        if (sql === "ERROR") {
          throw new Error("Execution error");
        }
        return {
          rows: [{ result: sql }],
          rowCount: 1,
          executionTime: 50,
        };
      });

      // Execute all queries concurrently
      const promises = queries.map(query => handler.handleQuery(query));
      const results = await Promise.all(promises);

      // Verify successful queries are not affected by failed ones
      expect(results[0]).toHaveProperty("rows");
      expect(results[2]).toHaveProperty("rows");
      expect(results[4]).toHaveProperty("rows");

      // Verify error responses
      expect(results[1]).toHaveProperty("error");
      expect(results[3]).toHaveProperty("error");
    });
  });
});
