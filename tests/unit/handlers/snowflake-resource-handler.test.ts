/**
 * Unit tests for SnowflakeResourceHandler
 */

import { SnowflakeResourceHandler } from "../../../src/handlers/snowflake-resource-handler.js";
import { SnowflakeClient } from "../../../src/clients/snowflake-client.js";
import { SQLValidator } from "../../../src/validators/sql-validator.js";
import type { QueryRequest, ValidationError } from "../../../src/types/index.js";

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
        message: "SQL execution failed",
        details: {
          originalMessage: error.message,
          suggestion: "Check SQL syntax and ensure the query is valid for Snowflake",
        },
      },
    })),
    handleInternalError: jest.fn().mockImplementation((error, context) => ({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected internal error occurred",
        details: {
          originalMessage: error.message,
          suggestion: "Please check the server logs for more details",
        },
      },
    })),
  },
}));

describe("SnowflakeResourceHandler", () => {
  let handler: SnowflakeResourceHandler;
  let mockClient: jest.Mocked<SnowflakeClient>;
  let mockValidator: jest.Mocked<SQLValidator>;

  const mockQueryResult = {
    rows: [
      { id: 1, name: "John", email: "john@example.com" },
      { id: 2, name: "Jane", email: "jane@example.com" },
    ],
    rowCount: 2,
    columns: [
      { name: "id", type: "NUMBER", nullable: false },
      { name: "name", type: "VARCHAR", nullable: false },
      { name: "email", type: "VARCHAR", nullable: true },
    ],
  };

  beforeEach(() => {
    // Create mocked instances
    mockClient = new SnowflakeClient({} as any) as jest.Mocked<SnowflakeClient>;
    mockValidator = new SQLValidator() as jest.Mocked<SQLValidator>;

    // Setup default mock implementations
    mockClient.execute = jest.fn().mockResolvedValue(mockQueryResult);

    mockValidator.validateQuery = jest.fn().mockReturnValue({
      sql: "SELECT * FROM users",
    });
    mockValidator.getQueryType = jest.fn().mockReturnValue("SELECT");
    mockValidator.isReadOnlyQuery = jest.fn().mockReturnValue(true);

    handler = new SnowflakeResourceHandler(mockClient, mockValidator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleQuery", () => {
    it("should successfully process a valid query", async () => {
      const request = { sql: "SELECT * FROM users" };
      const startTime = Date.now();

      const result = await handler.handleQuery(request);

      expect(result).toEqual({
        rows: mockQueryResult.rows,
        rowCount: mockQueryResult.rowCount,
        executionTime: expect.any(Number),
        metadata: {
          columns: mockQueryResult.columns,
        },
      });

      expect(mockValidator.validateQuery).toHaveBeenCalledWith(request);
      expect(mockClient.execute).toHaveBeenCalledWith(
        "SELECT * FROM users",
        expect.objectContaining({
          timeout: expect.any(Number),
          priority: expect.any(String),
        }),
      );

      // Check that execution time is reasonable
      const response = result as any;
      expect(response.executionTime).toBeGreaterThanOrEqual(0);
      expect(response.executionTime).toBeLessThan(Date.now() - startTime + 100);
    });

    it("should return validation error for invalid input", async () => {
      const validationError: ValidationError = {
        code: "VALIDATION_ERROR",
        message: "SQL validation failed",
        details: {
          field: "sql",
          value: "",
          issues: ["SQL query cannot be empty"],
        },
      };

      mockValidator.validateQuery.mockImplementation(() => {
        throw validationError;
      });

      const request = { sql: "" };
      const result = await handler.handleQuery(request);

      expect(result).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: "SQL validation failed",
          details: validationError.details,
        },
      });

      expect(mockValidator.validateQuery).toHaveBeenCalledWith(request);
      expect(mockClient.execute).not.toHaveBeenCalled();
    });

    it("should return execution error when client connection fails", async () => {
      const connectionError = new Error("Failed to establish connection to Snowflake");
      mockClient.execute.mockRejectedValue(connectionError);

      const request = { sql: "SELECT * FROM users" };
      const result = await handler.handleQuery(request);

      expect(result).toEqual({
        error: {
          code: "EXECUTION_ERROR",
          message: "SQL execution failed",
          details: {
            originalMessage: "Failed to establish connection to Snowflake",
            suggestion: "Check SQL syntax and ensure the query is valid for Snowflake",
          },
        },
      });

      expect(mockValidator.validateQuery).toHaveBeenCalledWith(request);
      expect(mockClient.execute).toHaveBeenCalled();
    });

    it("should return execution error when query execution fails", async () => {
      const executionError = new Error("SQL syntax error: invalid table name");
      mockClient.execute.mockRejectedValue(executionError);

      const request = { sql: "SELECT * FROM invalid_table" };

      // Mock validator to return the actual SQL from the request
      mockValidator.validateQuery.mockReturnValue({
        sql: "SELECT * FROM invalid_table",
      });

      const result = await handler.handleQuery(request);

      expect(result).toEqual({
        error: {
          code: "EXECUTION_ERROR",
          message: "SQL execution failed",
          details: {
            originalMessage: "SQL syntax error: invalid table name",
            suggestion: "Check SQL syntax and ensure the query is valid for Snowflake",
          },
        },
      });

      expect(mockValidator.validateQuery).toHaveBeenCalledWith(request);
      expect(mockClient.execute).toHaveBeenCalledWith(
        "SELECT * FROM invalid_table",
        expect.objectContaining({
          timeout: expect.any(Number),
          priority: expect.any(String),
        }),
      );
    });

    it("should handle unexpected errors gracefully", async () => {
      // Create a regular Error (not ValidationError) to trigger unexpected error handling
      const unexpectedError = new Error("Unexpected system error");

      // Mock the client to throw an unexpected error during execution
      mockClient.execute.mockRejectedValue(unexpectedError);

      const request = { sql: "SELECT * FROM users" };
      const result = await handler.handleQuery(request);

      expect(result).toEqual({
        error: {
          code: "EXECUTION_ERROR",
          message: "SQL execution failed",
          details: {
            originalMessage: "Unexpected system error",
            suggestion: "Check SQL syntax and ensure the query is valid for Snowflake",
          },
        },
      });
    });

    it("should include query metadata in debug logs", async () => {
      const request = { sql: "SELECT COUNT(*) FROM orders" };

      // Mock validator to return the actual SQL from the request
      mockValidator.validateQuery.mockReturnValue({
        sql: "SELECT COUNT(*) FROM orders",
      });
      mockValidator.getQueryType.mockReturnValue("SELECT");
      mockValidator.isReadOnlyQuery.mockReturnValue(true);

      await handler.handleQuery(request);

      expect(mockValidator.getQueryType).toHaveBeenCalledWith("SELECT COUNT(*) FROM orders");
      expect(mockValidator.isReadOnlyQuery).toHaveBeenCalledWith("SELECT COUNT(*) FROM orders");
    });

    it("should measure and return accurate execution time", async () => {
      // Mock a delay in query execution
      mockClient.execute.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockQueryResult), 50)));

      const request = { sql: "SELECT * FROM users" };
      const result = await handler.handleQuery(request);

      const response = result as any;
      expect(response.executionTime).toBeGreaterThanOrEqual(40); // Allow some variance
      expect(response.executionTime).toBeLessThan(200); // But not too much
    });
  });

  describe("getQueryStats", () => {
    it("should return basic query statistics", async () => {
      mockValidator.getQueryType.mockReturnValue("SELECT");
      mockValidator.isReadOnlyQuery.mockReturnValue(true);

      const stats = await handler.getQueryStats("SELECT * FROM users");

      expect(stats).toEqual({
        queryType: "SELECT",
        isReadOnly: true,
        estimatedComplexity: "low",
      });
    });

    it("should detect medium complexity queries with JOINs", async () => {
      mockValidator.getQueryType.mockReturnValue("SELECT");
      mockValidator.isReadOnlyQuery.mockReturnValue(true);

      const stats = await handler.getQueryStats("SELECT u.*, p.* FROM users u JOIN profiles p ON u.id = p.user_id");

      expect(stats.estimatedComplexity).toBe("medium");
    });

    it("should detect medium complexity queries with UNIONs", async () => {
      mockValidator.getQueryType.mockReturnValue("SELECT");
      mockValidator.isReadOnlyQuery.mockReturnValue(true);

      const stats = await handler.getQueryStats("SELECT name FROM users UNION SELECT name FROM customers");

      expect(stats.estimatedComplexity).toBe("medium");
    });

    it("should detect high complexity queries with window functions", async () => {
      mockValidator.getQueryType.mockReturnValue("SELECT");
      mockValidator.isReadOnlyQuery.mockReturnValue(true);

      const stats = await handler.getQueryStats("SELECT name, ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary) FROM employees");

      expect(stats.estimatedComplexity).toBe("high");
    });

    it("should detect high complexity queries with multiple JOINs", async () => {
      mockValidator.getQueryType.mockReturnValue("SELECT");
      mockValidator.isReadOnlyQuery.mockReturnValue(true);

      const stats = await handler.getQueryStats("SELECT * FROM users u JOIN profiles p ON u.id = p.user_id JOIN orders o ON u.id = o.user_id JOIN products pr ON o.product_id = pr.id");

      expect(stats.estimatedComplexity).toBe("high");
    });
  });

  describe("validateQueryOnly", () => {
    it("should return validation success with stats for valid query", async () => {
      const request = { sql: "SELECT * FROM users" };

      mockValidator.getQueryType.mockReturnValue("SELECT");
      mockValidator.isReadOnlyQuery.mockReturnValue(true);

      const result = await handler.validateQueryOnly(request);

      expect(result).toEqual({
        isValid: true,
        stats: {
          queryType: "SELECT",
          isReadOnly: true,
          estimatedComplexity: "low",
        },
      });

      expect(mockValidator.validateQuery).toHaveBeenCalledWith(request);
    });

    it("should return validation failure for invalid query", async () => {
      const validationError: ValidationError = {
        code: "VALIDATION_ERROR",
        message: "SQL validation failed",
        details: {
          field: "sql",
          value: "",
          issues: ["SQL query cannot be empty"],
        },
      };

      mockValidator.validateQuery.mockImplementation(() => {
        throw validationError;
      });

      const request = { sql: "" };
      const result = await handler.validateQueryOnly(request);

      expect(result).toEqual({
        isValid: false,
        error: validationError,
      });

      expect(mockValidator.validateQuery).toHaveBeenCalledWith(request);
    });
  });

  describe("error formatting", () => {
    it("should format validation errors correctly", async () => {
      const validationError: ValidationError = {
        code: "VALIDATION_ERROR",
        message: "Invalid SQL syntax",
        details: {
          field: "sql",
          value: "INVALID SQL",
          issues: ["Syntax error at position 0"],
        },
      };

      mockValidator.validateQuery.mockImplementation(() => {
        throw validationError;
      });

      const result = await handler.handleQuery({ sql: "INVALID SQL" });

      expect(result).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid SQL syntax",
          details: validationError.details,
        },
      });
    });

    it("should format connection errors with helpful suggestions", async () => {
      const connectionError = new Error("Connection timeout");
      mockClient.execute.mockRejectedValue(connectionError);

      const result = await handler.handleQuery({ sql: "SELECT 1" });

      expect(result).toEqual({
        error: {
          code: "EXECUTION_ERROR",
          message: "SQL execution failed",
          details: {
            originalMessage: "Connection timeout",
            suggestion: "Check SQL syntax and ensure the query is valid for Snowflake",
          },
        },
      });
    });

    it("should format execution errors with helpful suggestions", async () => {
      mockClient.execute.mockRejectedValue(new Error("Table does not exist"));

      const result = await handler.handleQuery({
        sql: "SELECT * FROM nonexistent",
      });

      expect(result).toEqual({
        error: {
          code: "EXECUTION_ERROR",
          message: "SQL execution failed",
          details: {
            originalMessage: "Table does not exist",
            suggestion: "Check SQL syntax and ensure the query is valid for Snowflake",
          },
        },
      });
    });
  });

  describe("edge cases and additional scenarios", () => {
    it("should handle empty result sets", async () => {
      const emptyResult = {
        rows: [],
        rowCount: 0,
        columns: [{ name: "id", type: "NUMBER", nullable: false }],
      };

      mockClient.execute.mockResolvedValue(emptyResult);

      const request = { sql: "SELECT * FROM users WHERE id = -1" };
      const result = await handler.handleQuery(request);

      expect(result).toEqual({
        rows: [],
        rowCount: 0,
        executionTime: expect.any(Number),
        metadata: {
          columns: emptyResult.columns,
        },
      });
    });

    it("should handle queries with no column metadata", async () => {
      const resultWithoutColumns = {
        rows: [{ count: 5 }],
        rowCount: 1,
        columns: [],
      };

      mockClient.execute.mockResolvedValue(resultWithoutColumns);

      const request = { sql: "SELECT COUNT(*) as count FROM users" };
      const result = await handler.handleQuery(request);

      expect(result).toEqual({
        rows: [{ count: 5 }],
        rowCount: 1,
        executionTime: expect.any(Number),
        metadata: {
          columns: [],
        },
      });
    });

    it("should handle complex nested objects in query results", async () => {
      const complexResult = {
        rows: [
          {
            id: 1,
            metadata: { tags: ["important", "urgent"], score: 95.5 },
            nested: { deep: { value: "test" } },
          },
        ],
        rowCount: 1,
        columns: [
          { name: "id", type: "NUMBER", nullable: false },
          { name: "metadata", type: "VARIANT", nullable: true },
          { name: "nested", type: "OBJECT", nullable: true },
        ],
      };

      mockClient.execute.mockResolvedValue(complexResult);

      const request = { sql: "SELECT * FROM complex_table" };
      const result = await handler.handleQuery(request);

      expect(result).toEqual({
        rows: complexResult.rows,
        rowCount: 1,
        executionTime: expect.any(Number),
        metadata: {
          columns: complexResult.columns,
        },
      });
    });

    it("should handle null and undefined values in query results", async () => {
      const resultWithNulls = {
        rows: [
          { id: 1, name: "John", email: null },
          { id: 2, name: null, email: "jane@example.com" },
          { id: 3, name: undefined, email: undefined },
        ],
        rowCount: 3,
        columns: [
          { name: "id", type: "NUMBER", nullable: false },
          { name: "name", type: "VARCHAR", nullable: true },
          { name: "email", type: "VARCHAR", nullable: true },
        ],
      };

      mockClient.execute.mockResolvedValue(resultWithNulls);

      const request = { sql: "SELECT * FROM users_with_nulls" };
      const result = await handler.handleQuery(request);

      expect(result).toEqual({
        rows: resultWithNulls.rows,
        rowCount: 3,
        executionTime: expect.any(Number),
        metadata: {
          columns: resultWithNulls.columns,
        },
      });
    });

    it("should handle very large result sets efficiently", async () => {
      const largeResult = {
        rows: Array.from({ length: 10000 }, (_, i) => ({
          id: i + 1,
          name: `User ${i + 1}`,
          email: `user${i + 1}@example.com`,
        })),
        rowCount: 10000,
        columns: [
          { name: "id", type: "NUMBER", nullable: false },
          { name: "name", type: "VARCHAR", nullable: false },
          { name: "email", type: "VARCHAR", nullable: true },
        ],
      };

      mockClient.execute.mockResolvedValue(largeResult);

      const request = { sql: "SELECT * FROM large_table" };
      const startTime = Date.now();
      const result = await handler.handleQuery(request);
      const endTime = Date.now();

      expect(result).toEqual({
        rows: largeResult.rows,
        rowCount: 10000,
        executionTime: expect.any(Number),
        metadata: {
          columns: largeResult.columns,
        },
      });

      // Ensure the handler doesn't add significant overhead for large results
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe("query complexity detection edge cases", () => {
    it("should handle case-insensitive complexity detection", async () => {
      const stats = await handler.getQueryStats("select * from users u join profiles p on u.id = p.user_id");
      expect(stats.estimatedComplexity).toBe("medium");
    });

    it("should detect PIVOT operations as high complexity", async () => {
      const stats = await handler.getQueryStats("SELECT * FROM (SELECT year, quarter, sales FROM quarterly_sales) PIVOT (SUM(sales) FOR quarter IN (1, 2, 3, 4))");
      expect(stats.estimatedComplexity).toBe("high");
    });

    it("should detect RECURSIVE CTEs as high complexity", async () => {
      const stats = await handler.getQueryStats(
        "WITH RECURSIVE employee_hierarchy AS (SELECT id, name, manager_id FROM employees WHERE manager_id IS NULL UNION ALL SELECT e.id, e.name, e.manager_id FROM employees e JOIN employee_hierarchy eh ON e.manager_id = eh.id) SELECT * FROM employee_hierarchy",
      );
      expect(stats.estimatedComplexity).toBe("high");
    });

    it("should handle queries with mixed complexity indicators", async () => {
      const stats = await handler.getQueryStats("SELECT u.name, COUNT(*) OVER (PARTITION BY u.department) FROM users u JOIN profiles p ON u.id = p.user_id");
      expect(stats.estimatedComplexity).toBe("high"); // Window function takes precedence
    });
  });
});
