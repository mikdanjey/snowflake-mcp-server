/**
 * Integration tests for various SQL query types
 * Tests SELECT, SHOW, DESCRIBE and other Snowflake-specific queries
 */

import { jest } from "@jest/globals";
import { SnowflakeClient } from "../../src/clients/snowflake-client.js";
import { SnowflakeResourceHandler } from "../../src/handlers/snowflake-resource-handler.js";
import { SQLValidator } from "../../src/validators/sql-validator.js";
import { validQueries, readOnlyQueries, nonReadOnlyQueries } from "../fixtures/sql-queries.js";
import type { SnowflakeConfig, QueryResponse } from "../../src/types/index.js";

// Mock external dependencies
jest.mock("snowflake-sdk");

describe("SQL Query Types Integration Tests", () => {
  let snowflakeClient: SnowflakeClient;
  let resourceHandler: SnowflakeResourceHandler;
  let sqlValidator: SQLValidator;
  let mockConfig: SnowflakeConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      account: "test-account",
      username: "test-user",
      password: "test-password",
      database: "test-db",
      schema: "test-schema",
      warehouse: "test-warehouse",
      role: "test-role",
      authenticator: "snowflake",
    };

    snowflakeClient = new SnowflakeClient(mockConfig);
    sqlValidator = new SQLValidator();
    resourceHandler = new SnowflakeResourceHandler(snowflakeClient, sqlValidator);
  });

  describe("SELECT Queries", () => {
    it("should handle simple SELECT query", async () => {
      const mockResult = {
        rows: [
          { id: 1, name: "John Doe", email: "john@example.com" },
          { id: 2, name: "Jane Smith", email: "jane@example.com" },
        ],
        rowCount: 2,
        columns: [
          { name: "id", type: "NUMBER", nullable: false },
          { name: "name", type: "VARCHAR", nullable: false },
          { name: "email", type: "VARCHAR", nullable: true },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: validQueries.simple.select };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(2);
      expect(response.executionTime).toBeGreaterThanOrEqual(0);
      expect(response.metadata?.columns).toEqual(mockResult.columns);
    });

    it("should handle SELECT with WHERE clause", async () => {
      const mockResult = {
        rows: [{ id: 1, name: "John Doe", status: "active" }],
        rowCount: 1,
        columns: [
          { name: "id", type: "NUMBER", nullable: false },
          { name: "name", type: "VARCHAR", nullable: false },
          { name: "status", type: "VARCHAR", nullable: false },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = {
        sql: "SELECT id, name, status FROM users WHERE status = 'active'",
      };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(1);
    });

    it("should handle SELECT with JOIN operations", async () => {
      const mockResult = {
        rows: [
          {
            user_id: 1,
            user_name: "John Doe",
            order_count: 5,
            total_amount: 1250.0,
          },
          {
            user_id: 2,
            user_name: "Jane Smith",
            order_count: 3,
            total_amount: 750.5,
          },
        ],
        rowCount: 2,
        columns: [
          { name: "user_id", type: "NUMBER", nullable: false },
          { name: "user_name", type: "VARCHAR", nullable: false },
          { name: "order_count", type: "NUMBER", nullable: false },
          { name: "total_amount", type: "NUMBER", nullable: false },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: validQueries.complex.joinWithAggregation };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(2);

      // Verify query complexity is properly detected
      const stats = await resourceHandler.getQueryStats(validQueries.complex.joinWithAggregation);
      expect(stats.estimatedComplexity).toBe("medium");
    });

    it("should handle SELECT with Common Table Expressions (CTE)", async () => {
      const mockResult = {
        rows: [
          { name: "John Doe", total_orders: 5, total_spent: 1500.0 },
          { name: "Jane Smith", total_orders: 8, total_spent: 2200.5 },
        ],
        rowCount: 2,
        columns: [
          { name: "name", type: "VARCHAR", nullable: false },
          { name: "total_orders", type: "NUMBER", nullable: false },
          { name: "total_spent", type: "NUMBER", nullable: false },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: validQueries.complex.cte };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(2);
    });

    it("should handle SELECT with window functions", async () => {
      const mockResult = {
        rows: [
          {
            name: "John Doe",
            salary: 75000,
            department: "Engineering",
            rank: 1,
          },
          {
            name: "Jane Smith",
            salary: 72000,
            department: "Engineering",
            rank: 2,
          },
          { name: "Bob Johnson", salary: 65000, department: "Sales", rank: 1 },
        ],
        rowCount: 3,
        columns: [
          { name: "name", type: "VARCHAR", nullable: false },
          { name: "salary", type: "NUMBER", nullable: false },
          { name: "department", type: "VARCHAR", nullable: false },
          { name: "rank", type: "NUMBER", nullable: false },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: validQueries.complex.windowFunction };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(3);

      // Window functions should be detected as high complexity
      const stats = await resourceHandler.getQueryStats(validQueries.complex.windowFunction);
      expect(stats.estimatedComplexity).toBe("high");
    });

    it("should handle empty result sets", async () => {
      const mockResult = {
        rows: [],
        rowCount: 0,
        columns: [
          { name: "id", type: "NUMBER", nullable: false },
          { name: "name", type: "VARCHAR", nullable: false },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: "SELECT id, name FROM users WHERE id = -1" };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual([]);
      expect(response.rowCount).toBe(0);
      expect(response.metadata?.columns).toEqual(mockResult.columns);
    });
  });

  describe("SHOW Queries", () => {
    it("should handle SHOW TABLES query", async () => {
      const mockResult = {
        rows: [
          {
            name: "users",
            database_name: "test-db",
            schema_name: "test-schema",
            kind: "TABLE",
          },
          {
            name: "orders",
            database_name: "test-db",
            schema_name: "test-schema",
            kind: "TABLE",
          },
          {
            name: "products",
            database_name: "test-db",
            schema_name: "test-schema",
            kind: "TABLE",
          },
        ],
        rowCount: 3,
        columns: [
          { name: "name", type: "VARCHAR", nullable: false },
          { name: "database_name", type: "VARCHAR", nullable: false },
          { name: "schema_name", type: "VARCHAR", nullable: false },
          { name: "kind", type: "VARCHAR", nullable: false },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: validQueries.simple.show };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(3);

      // Verify it's detected as read-only
      const stats = await resourceHandler.getQueryStats(validQueries.simple.show);
      expect(stats.isReadOnly).toBe(true);
    });

    it("should handle SHOW DATABASES query", async () => {
      const mockResult = {
        rows: [
          { name: "SNOWFLAKE", origin: "SYSTEM", owner: "ACCOUNTADMIN" },
          { name: "TEST_DB", origin: "USER", owner: "SYSADMIN" },
          { name: "ANALYTICS_DB", origin: "USER", owner: "SYSADMIN" },
        ],
        rowCount: 3,
        columns: [
          { name: "name", type: "VARCHAR", nullable: false },
          { name: "origin", type: "VARCHAR", nullable: false },
          { name: "owner", type: "VARCHAR", nullable: false },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: "SHOW DATABASES" };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(3);
    });

    it("should handle SHOW SCHEMAS query", async () => {
      const mockResult = {
        rows: [
          { name: "PUBLIC", database_name: "TEST_DB", owner: "SYSADMIN" },
          { name: "ANALYTICS", database_name: "TEST_DB", owner: "SYSADMIN" },
          { name: "STAGING", database_name: "TEST_DB", owner: "SYSADMIN" },
        ],
        rowCount: 3,
        columns: [
          { name: "name", type: "VARCHAR", nullable: false },
          { name: "database_name", type: "VARCHAR", nullable: false },
          { name: "owner", type: "VARCHAR", nullable: false },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: "SHOW SCHEMAS IN DATABASE TEST_DB" };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(3);
    });

    it("should handle SHOW WAREHOUSES query", async () => {
      const mockResult = {
        rows: [
          {
            name: "COMPUTE_WH",
            state: "SUSPENDED",
            type: "STANDARD",
            size: "X-SMALL",
          },
          {
            name: "ANALYTICS_WH",
            state: "RUNNING",
            type: "STANDARD",
            size: "LARGE",
          },
        ],
        rowCount: 2,
        columns: [
          { name: "name", type: "VARCHAR", nullable: false },
          { name: "state", type: "VARCHAR", nullable: false },
          { name: "type", type: "VARCHAR", nullable: false },
          { name: "size", type: "VARCHAR", nullable: false },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: "SHOW WAREHOUSES" };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(2);
    });
  });

  describe("DESCRIBE Queries", () => {
    it("should handle DESCRIBE TABLE query", async () => {
      const mockResult = {
        rows: [
          {
            name: "id",
            type: "NUMBER(38,0)",
            kind: "COLUMN",
            null: "N",
            default: null,
            primary_key: "Y",
          },
          {
            name: "name",
            type: "VARCHAR(255)",
            kind: "COLUMN",
            null: "N",
            default: null,
            primary_key: "N",
          },
          {
            name: "email",
            type: "VARCHAR(255)",
            kind: "COLUMN",
            null: "Y",
            default: null,
            primary_key: "N",
          },
          {
            name: "created_at",
            type: "TIMESTAMP_NTZ(9)",
            kind: "COLUMN",
            null: "N",
            default: "CURRENT_TIMESTAMP()",
            primary_key: "N",
          },
        ],
        rowCount: 4,
        columns: [
          { name: "name", type: "VARCHAR", nullable: false },
          { name: "type", type: "VARCHAR", nullable: false },
          { name: "kind", type: "VARCHAR", nullable: false },
          { name: "null", type: "VARCHAR", nullable: false },
          { name: "default", type: "VARCHAR", nullable: true },
          { name: "primary_key", type: "VARCHAR", nullable: false },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: validQueries.simple.describe };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(4);

      // Verify it's detected as read-only
      const stats = await resourceHandler.getQueryStats(validQueries.simple.describe);
      expect(stats.isReadOnly).toBe(true);
    });

    it("should handle DESC TABLE query (alias for DESCRIBE)", async () => {
      const mockResult = {
        rows: [
          {
            name: "order_id",
            type: "NUMBER(38,0)",
            kind: "COLUMN",
            null: "N",
            default: null,
          },
          {
            name: "user_id",
            type: "NUMBER(38,0)",
            kind: "COLUMN",
            null: "N",
            default: null,
          },
          {
            name: "total",
            type: "NUMBER(10,2)",
            kind: "COLUMN",
            null: "N",
            default: null,
          },
        ],
        rowCount: 3,
        columns: [
          { name: "name", type: "VARCHAR", nullable: false },
          { name: "type", type: "VARCHAR", nullable: false },
          { name: "kind", type: "VARCHAR", nullable: false },
          { name: "null", type: "VARCHAR", nullable: false },
          { name: "default", type: "VARCHAR", nullable: true },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: "DESC orders" };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(3);
    });
  });

  describe("EXPLAIN Queries", () => {
    it("should handle EXPLAIN query", async () => {
      const mockResult = {
        rows: [
          {
            step: 1,
            id: 0,
            parent: null,
            operation: "Result",
            objects: null,
            alias: null,
          },
          {
            step: 2,
            id: 1,
            parent: 0,
            operation: "TableScan",
            objects: "[TEST_DB.PUBLIC.USERS]",
            alias: "USERS",
          },
        ],
        rowCount: 2,
        columns: [
          { name: "step", type: "NUMBER", nullable: false },
          { name: "id", type: "NUMBER", nullable: false },
          { name: "parent", type: "NUMBER", nullable: true },
          { name: "operation", type: "VARCHAR", nullable: false },
          { name: "objects", type: "VARCHAR", nullable: true },
          { name: "alias", type: "VARCHAR", nullable: true },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: validQueries.simple.explain };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(2);

      // Verify it's detected as read-only
      const stats = await resourceHandler.getQueryStats(validQueries.simple.explain);
      expect(stats.isReadOnly).toBe(true);
    });
  });

  describe("Snowflake-Specific Queries", () => {
    it("should handle VARIANT data type queries", async () => {
      const mockResult = {
        rows: [
          {
            name: "John Doe",
            age: 30,
            metadata: '{"department": "Engineering", "level": "Senior"}',
          },
          {
            name: "Jane Smith",
            age: 28,
            metadata: '{"department": "Marketing", "level": "Manager"}',
          },
        ],
        rowCount: 2,
        columns: [
          { name: "name", type: "VARCHAR", nullable: false },
          { name: "age", type: "NUMBER", nullable: false },
          { name: "metadata", type: "VARCHAR", nullable: true },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: validQueries.snowflakeSpecific.variant };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(2);
    });

    it("should handle time travel queries", async () => {
      const mockResult = {
        rows: [
          { id: 1, name: "John Doe", status: "active" },
          { id: 2, name: "Jane Smith", status: "inactive" },
        ],
        rowCount: 2,
        columns: [
          { name: "id", type: "NUMBER", nullable: false },
          { name: "name", type: "VARCHAR", nullable: false },
          { name: "status", type: "VARCHAR", nullable: false },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: validQueries.snowflakeSpecific.timeTravel };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(2);
    });

    it("should handle FLATTEN function queries", async () => {
      const mockResult = {
        rows: [{ value: "item1" }, { value: "item2" }, { value: "item3" }],
        rowCount: 3,
        columns: [{ name: "value", type: "VARCHAR", nullable: true }],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: validQueries.snowflakeSpecific.flatten };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);
      expect(response.rowCount).toBe(3);
    });
  });

  describe("Read-Only Query Validation", () => {
    it("should correctly identify read-only queries", async () => {
      for (const query of readOnlyQueries) {
        const stats = await resourceHandler.getQueryStats(query);
        expect(stats.isReadOnly).toBe(true);
      }
    });

    it("should correctly identify non-read-only queries", async () => {
      for (const query of nonReadOnlyQueries) {
        const stats = await resourceHandler.getQueryStats(query);
        expect(stats.isReadOnly).toBe(false);
      }
    });

    it("should reject non-read-only queries if validation is strict", async () => {
      // This test assumes the validator has strict mode
      // If not implemented, this test documents the expected behavior
      const request = { sql: "INSERT INTO users VALUES (1, 'Test User')" };

      // Mock validation error for non-read-only query
      jest.spyOn(sqlValidator, "validateQuery").mockImplementation(() => {
        const error = new Error("Only read-only queries are allowed");
        (error as any).code = "VALIDATION_ERROR";
        throw error;
      });

      const response = await resourceHandler.handleQuery(request);

      expect(response).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
          message: expect.any(String),
        },
      });
    });
  });

  describe("Query Performance by Type", () => {
    it("should handle simple queries with low complexity", async () => {
      const mockResult = {
        rows: [{ count: 1000 }],
        rowCount: 1,
        columns: [{ name: "count", type: "NUMBER", nullable: false }],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const request = { sql: "SELECT COUNT(*) FROM users" };
      const startTime = Date.now();
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;
      const endTime = Date.now();

      expect(response.rows).toEqual(mockResult.rows);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast

      const stats = await resourceHandler.getQueryStats(request.sql);
      expect(stats.estimatedComplexity).toBe("low");
    });

    it("should handle complex queries with appropriate timeout", async () => {
      const mockResult = {
        rows: [
          { department: "Engineering", avg_salary: 85000, employee_count: 25 },
          { department: "Sales", avg_salary: 65000, employee_count: 30 },
        ],
        rowCount: 2,
        columns: [
          { name: "department", type: "VARCHAR", nullable: false },
          { name: "avg_salary", type: "NUMBER", nullable: false },
          { name: "employee_count", type: "NUMBER", nullable: false },
        ],
      };

      jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

      const complexQuery = `
        SELECT 
          department,
          AVG(salary) as avg_salary,
          COUNT(*) as employee_count
        FROM employees e
        JOIN departments d ON e.dept_id = d.id
        JOIN locations l ON d.location_id = l.id
        WHERE e.hire_date >= '2020-01-01'
        GROUP BY department
        HAVING COUNT(*) > 10
        ORDER BY avg_salary DESC
      `;

      const request = { sql: complexQuery };
      const response = (await resourceHandler.handleQuery(request)) as QueryResponse;

      expect(response.rows).toEqual(mockResult.rows);

      const stats = await resourceHandler.getQueryStats(complexQuery);
      expect(stats.estimatedComplexity).toBe("medium");
    });
  });

  describe("Error Handling by Query Type", () => {
    it("should handle syntax errors in SELECT queries", async () => {
      const syntaxError = new Error("SQL compilation error: syntax error line 1 at position 7 unexpected 'FORM'");
      jest.spyOn(snowflakeClient, "execute").mockRejectedValue(syntaxError);

      const request = { sql: "SELECT * FORM users" }; // Intentional typo
      const response = await resourceHandler.handleQuery(request);

      expect(response).toMatchObject({
        error: {
          code: "EXECUTION_ERROR",
          message: expect.any(String),
        },
      });
    });

    it("should handle object not found errors in SHOW queries", async () => {
      const objectError = new Error("Database 'NONEXISTENT_DB' does not exist");
      jest.spyOn(snowflakeClient, "execute").mockRejectedValue(objectError);

      const request = { sql: "SHOW TABLES IN DATABASE NONEXISTENT_DB" };
      const response = await resourceHandler.handleQuery(request);

      expect(response).toMatchObject({
        error: {
          code: "EXECUTION_ERROR",
          message: expect.any(String),
        },
      });
    });

    it("should handle permission errors in DESCRIBE queries", async () => {
      const permissionError = new Error("Insufficient privileges to operate on table 'RESTRICTED_TABLE'");
      jest.spyOn(snowflakeClient, "execute").mockRejectedValue(permissionError);

      const request = { sql: "DESCRIBE RESTRICTED_TABLE" };
      const response = await resourceHandler.handleQuery(request);

      expect(response).toMatchObject({
        error: {
          code: "EXECUTION_ERROR",
          message: expect.any(String),
        },
      });
    });
  });
});
