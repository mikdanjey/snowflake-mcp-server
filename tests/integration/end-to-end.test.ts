/**
 * End-to-end integration tests simulating real LLM agent interactions
 * Tests complete application lifecycle and realistic usage scenarios
 */

import { jest } from "@jest/globals";
import { Application } from "../../src/application.js";
import { MCPServer } from "../../src/server/mcp-server.js";
import { SnowflakeClient } from "../../src/clients/snowflake-client.js";
import { SnowflakeResourceHandler } from "../../src/handlers/snowflake-resource-handler.js";
import { SQLValidator } from "../../src/validators/sql-validator.js";
import { validQueries } from "../fixtures/sql-queries.js";

// Mock external dependencies
jest.mock("snowflake-sdk");
jest.mock("@modelcontextprotocol/sdk/server/mcp.js");
jest.mock("@modelcontextprotocol/sdk/server/stdio.js");

describe("End-to-End Integration Tests", () => {
  let application: Application;
  let mockExitProcess: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process.exit to prevent test termination
    mockExitProcess = jest.fn();

    // Setup environment variables
    process.env.SNOWFLAKE_ACCOUNT = "test-account";
    process.env.SNOWFLAKE_USER = "test-user";
    process.env.SNOWFLAKE_PASSWORD = "test-password";
    process.env.SNOWFLAKE_DATABASE = "test-db";
    process.env.SNOWFLAKE_SCHEMA = "test-schema";
    process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
    process.env.SNOWFLAKE_ROLE = "test-role";
    process.env.SNOWFLAKE_AUTHENTICATOR = "snowflake";
  });

  afterEach(async () => {
    // Clean up environment variables
    delete process.env.SNOWFLAKE_ACCOUNT;
    delete process.env.SNOWFLAKE_USER;
    delete process.env.SNOWFLAKE_PASSWORD;
    delete process.env.SNOWFLAKE_DATABASE;
    delete process.env.SNOWFLAKE_SCHEMA;
    delete process.env.SNOWFLAKE_WAREHOUSE;
    delete process.env.SNOWFLAKE_ROLE;
    delete process.env.SNOWFLAKE_AUTHENTICATOR;

    // Cleanup application if it was created
    if (application) {
      try {
        await (application as any).shutdown();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe("Complete Application Lifecycle", () => {
    it("should start application successfully and handle queries", async () => {
      application = new Application();
      // Override exitProcess to prevent test termination
      (application as any).exitProcess = mockExitProcess;

      // Mock successful Snowflake connection
      jest.spyOn(SnowflakeClient.prototype, "connect").mockResolvedValue(undefined);

      // Start the application
      await expect(application.start()).resolves.not.toThrow();
      expect(mockExitProcess).not.toHaveBeenCalled();
    });

    it("should handle graceful shutdown", async () => {
      application = new Application();
      (application as any).exitProcess = mockExitProcess;

      // Mock successful startup
      jest.spyOn(SnowflakeClient.prototype, "connect").mockResolvedValue(undefined);
      jest.spyOn(SnowflakeClient.prototype, "disconnect").mockResolvedValue(undefined);
      jest.spyOn(MCPServer.prototype, "stop").mockResolvedValue(undefined);

      await application.start();

      // Test graceful shutdown
      await expect((application as any).shutdown()).resolves.not.toThrow();
    });

    it("should meet startup time requirements", async () => {
      application = new Application();
      (application as any).exitProcess = mockExitProcess;

      // Mock fast startup
      jest.spyOn(SnowflakeClient.prototype, "connect").mockResolvedValue(undefined);

      const startTime = Date.now();
      await application.start();
      const endTime = Date.now();

      const startupTime = endTime - startTime;

      // Should meet sub-1-second startup requirement
      expect(startupTime).toBeLessThan(1000);
    });
  });

  describe("Realistic LLM Agent Scenarios", () => {
    let mcpServer: MCPServer;
    let resourceHandler: SnowflakeResourceHandler;

    beforeEach(async () => {
      // Setup components as they would be in real usage
      const snowflakeClient = new SnowflakeClient({
        account: "test-account",
        username: "test-user",
        password: "test-password",
        database: "test-db",
        schema: "test-schema",
        warehouse: "test-warehouse",
        role: "test-role",
        authenticator: "snowflake",
      });

      const sqlValidator = new SQLValidator();
      resourceHandler = new SnowflakeResourceHandler(snowflakeClient, sqlValidator);

      mcpServer = new MCPServer({
        name: "snowflake-mcp-server",
        version: "1.0.0",
      });

      mcpServer.registerResourceHandler(resourceHandler);
    });

    it("should handle data exploration workflow", async () => {
      // Scenario: LLM agent exploring a new database
      const explorationQueries = ["SHOW DATABASES", "SHOW TABLES", "DESCRIBE users", "SELECT * FROM users LIMIT 10"];

      const mockResults = [
        {
          rows: [
            { name: "TEST_DB", origin: "USER", owner: "SYSADMIN" },
            { name: "ANALYTICS_DB", origin: "USER", owner: "SYSADMIN" },
          ],
          rowCount: 2,
          columns: [{ name: "name", type: "VARCHAR", nullable: false }],
        },
        {
          rows: [
            { name: "users", kind: "TABLE" },
            { name: "orders", kind: "TABLE" },
            { name: "products", kind: "TABLE" },
          ],
          rowCount: 3,
          columns: [{ name: "name", type: "VARCHAR", nullable: false }],
        },
        {
          rows: [
            { name: "id", type: "NUMBER(38,0)", kind: "COLUMN", null: "N" },
            { name: "name", type: "VARCHAR(255)", kind: "COLUMN", null: "N" },
            { name: "email", type: "VARCHAR(255)", kind: "COLUMN", null: "Y" },
          ],
          rowCount: 3,
          columns: [{ name: "name", type: "VARCHAR", nullable: false }],
        },
        {
          rows: [
            { id: 1, name: "John Doe", email: "john@example.com" },
            { id: 2, name: "Jane Smith", email: "jane@example.com" },
          ],
          rowCount: 2,
          columns: [{ name: "id", type: "NUMBER", nullable: false }],
        },
      ];

      // Mock execute method to return different results for each query
      let queryIndex = 0;
      const mockClient = (resourceHandler as any).client;
      jest.spyOn(mockClient, "execute").mockImplementation(() => {
        return Promise.resolve(mockResults[queryIndex++]);
      });

      // Execute exploration workflow
      for (let i = 0; i < explorationQueries.length; i++) {
        const request = { sql: explorationQueries[i] };
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          rows: mockResults[i].rows,
          rowCount: mockResults[i].rowCount,
          executionTime: expect.any(Number),
        });
      }
    });

    it("should handle analytical query workflow", async () => {
      // Scenario: LLM agent performing business analysis
      const analyticalQueries = [
        "SELECT COUNT(*) as total_users FROM users",
        "SELECT COUNT(*) as total_orders FROM orders",
        `SELECT 
           DATE_TRUNC('month', order_date) as month,
           COUNT(*) as order_count,
           SUM(total_amount) as revenue
         FROM orders 
         WHERE order_date >= '2023-01-01'
         GROUP BY month 
         ORDER BY month`,
        `SELECT 
           u.name,
           COUNT(o.id) as order_count,
           AVG(o.total_amount) as avg_order_value
         FROM users u
         LEFT JOIN orders o ON u.id = o.user_id
         GROUP BY u.id, u.name
         HAVING COUNT(o.id) > 0
         ORDER BY avg_order_value DESC
         LIMIT 10`,
      ];

      const mockResults = [
        {
          rows: [{ total_users: 1500 }],
          rowCount: 1,
          columns: [{ name: "total_users", type: "NUMBER", nullable: false }],
        },
        {
          rows: [{ total_orders: 8750 }],
          rowCount: 1,
          columns: [{ name: "total_orders", type: "NUMBER", nullable: false }],
        },
        {
          rows: [
            { month: "2023-01-01", order_count: 245, revenue: 12500.0 },
            { month: "2023-02-01", order_count: 289, revenue: 15750.5 },
            { month: "2023-03-01", order_count: 312, revenue: 18900.25 },
          ],
          rowCount: 3,
          columns: [
            { name: "month", type: "DATE", nullable: false },
            { name: "order_count", type: "NUMBER", nullable: false },
            { name: "revenue", type: "NUMBER", nullable: false },
          ],
        },
        {
          rows: [
            {
              name: "Premium Customer",
              order_count: 25,
              avg_order_value: 450.75,
            },
            { name: "VIP Customer", order_count: 18, avg_order_value: 389.5 },
            {
              name: "Regular Customer",
              order_count: 12,
              avg_order_value: 125.25,
            },
          ],
          rowCount: 3,
          columns: [
            { name: "name", type: "VARCHAR", nullable: false },
            { name: "order_count", type: "NUMBER", nullable: false },
            { name: "avg_order_value", type: "NUMBER", nullable: false },
          ],
        },
      ];

      // Mock execute method for analytical queries
      let queryIndex = 0;
      const mockClient = (resourceHandler as any).client;
      jest.spyOn(mockClient, "execute").mockImplementation(() => {
        return Promise.resolve(mockResults[queryIndex++]);
      });

      // Execute analytical workflow
      for (let i = 0; i < analyticalQueries.length; i++) {
        const request = { sql: analyticalQueries[i] };
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          rows: mockResults[i].rows,
          rowCount: mockResults[i].rowCount,
          executionTime: expect.any(Number),
        });

        // Verify query complexity detection
        const stats = await resourceHandler.getQueryStats(analyticalQueries[i]);
        if (i >= 2) {
          // Complex queries
          expect(["low", "medium", "high"]).toContain(stats.estimatedComplexity);
        }
      }
    });

    it("should handle error recovery workflow", async () => {
      // Scenario: LLM agent handling and recovering from errors
      const errorRecoverySequence = [
        { sql: "SELECT * FROM nonexistent_table", shouldFail: true },
        { sql: "SHOW TABLES", shouldFail: false },
        { sql: "SELECT * FORM users", shouldFail: true }, // Syntax error
        { sql: "SELECT * FROM users LIMIT 5", shouldFail: false },
      ];

      const mockSuccessResult = {
        rows: [
          { name: "users", kind: "TABLE" },
          { name: "orders", kind: "TABLE" },
        ],
        rowCount: 2,
        columns: [{ name: "name", type: "VARCHAR", nullable: false }],
      };

      // Mock execute method to simulate errors and successes
      const mockClient = (resourceHandler as any).client;
      jest.spyOn(mockClient, "execute").mockImplementation((sql: string) => {
        if (sql.includes("nonexistent_table")) {
          return Promise.reject(new Error("Object 'NONEXISTENT_TABLE' does not exist"));
        }
        if (sql.includes("FORM")) {
          return Promise.reject(new Error("SQL compilation error: syntax error"));
        }
        return Promise.resolve(mockSuccessResult);
      });

      // Execute error recovery workflow
      for (const query of errorRecoverySequence) {
        const request = { sql: query.sql };
        const response = await resourceHandler.handleQuery(request);

        if (query.shouldFail) {
          expect(response).toMatchObject({
            error: {
              code: "EXECUTION_ERROR",
              message: expect.any(String),
            },
          });
        } else {
          expect(response).toMatchObject({
            rows: mockSuccessResult.rows,
            rowCount: mockSuccessResult.rowCount,
            executionTime: expect.any(Number),
          });
        }
      }
    });

    it("should handle concurrent query requests", async () => {
      // Scenario: Multiple LLM agents or concurrent requests
      const concurrentQueries = ["SELECT COUNT(*) FROM users", "SELECT COUNT(*) FROM orders", "SELECT COUNT(*) FROM products", "SHOW TABLES", "DESCRIBE users"];

      const mockResult = {
        rows: [{ count: 100 }],
        rowCount: 1,
        columns: [{ name: "count", type: "NUMBER", nullable: false }],
      };

      // Mock execute method
      const mockClient = (resourceHandler as any).client;
      jest.spyOn(mockClient, "execute").mockResolvedValue(mockResult);

      // Execute queries concurrently
      const promises = concurrentQueries.map(sql => resourceHandler.handleQuery({ sql }));

      const responses = await Promise.all(promises);

      // All queries should complete successfully
      responses.forEach(response => {
        expect(response).toMatchObject({
          rows: expect.any(Array),
          rowCount: expect.any(Number),
          executionTime: expect.any(Number),
        });
      });
    });

    it("should handle large result sets efficiently", async () => {
      // Scenario: LLM agent requesting large datasets
      const largeResultQuery = "SELECT * FROM large_table LIMIT 1000";

      // Generate mock large result set
      const largeRows = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        created_at: "2023-01-01T00:00:00Z",
      }));

      const mockLargeResult = {
        rows: largeRows,
        rowCount: 1000,
        columns: [
          { name: "id", type: "NUMBER", nullable: false },
          { name: "name", type: "VARCHAR", nullable: false },
          { name: "email", type: "VARCHAR", nullable: true },
          { name: "created_at", type: "TIMESTAMP_NTZ", nullable: false },
        ],
      };

      const mockClient = (resourceHandler as any).client;
      jest.spyOn(mockClient, "execute").mockResolvedValue(mockLargeResult);

      const startTime = Date.now();
      const request = { sql: largeResultQuery };
      const response = await resourceHandler.handleQuery(request);
      const endTime = Date.now();

      expect(response).toMatchObject({
        rows: largeRows,
        rowCount: 1000,
        executionTime: expect.any(Number),
      });

      // Should handle large results efficiently
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe("Performance and Reliability", () => {
    let resourceHandler: SnowflakeResourceHandler;

    beforeEach(() => {
      const snowflakeClient = new SnowflakeClient({
        account: "test-account",
        username: "test-user",
        password: "test-password",
        database: "test-db",
        schema: "test-schema",
        warehouse: "test-warehouse",
        role: "test-role",
        authenticator: "snowflake",
      });

      const sqlValidator = new SQLValidator();
      resourceHandler = new SnowflakeResourceHandler(snowflakeClient, sqlValidator);
    });

    it("should maintain performance under load", async () => {
      const mockResult = {
        rows: [{ result: "success" }],
        rowCount: 1,
        columns: [{ name: "result", type: "VARCHAR", nullable: false }],
      };

      const mockClient = (resourceHandler as any).client;
      jest.spyOn(mockClient, "execute").mockResolvedValue(mockResult);

      // Simulate load with multiple concurrent requests
      const loadTestQueries = Array.from({ length: 50 }, (_, i) => `SELECT ${i} as query_id, 'test' as data`);

      const startTime = Date.now();
      const promises = loadTestQueries.map(sql => resourceHandler.handleQuery({ sql }));

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All queries should complete successfully
      expect(responses).toHaveLength(50);
      responses.forEach(response => {
        expect(response).toMatchObject({
          rows: expect.any(Array),
          rowCount: expect.any(Number),
          executionTime: expect.any(Number),
        });
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000);
    });

    it("should handle timeout scenarios gracefully", async () => {
      // Mock timeout error
      const mockClient = (resourceHandler as any).client;
      jest.spyOn(mockClient, "execute").mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Query timeout after 30000ms")), 100);
        });
      });

      const request = { sql: validQueries.complex.joinWithAggregation };
      const response = await resourceHandler.handleQuery(request);

      expect(response).toMatchObject({
        error: {
          code: "EXECUTION_ERROR",
          message: expect.any(String),
        },
      });
    });

    it("should recover from connection issues", async () => {
      let callCount = 0;

      // Mock connection failure followed by success
      const mockClient = (resourceHandler as any).client;
      jest.spyOn(mockClient, "execute").mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("Connection lost"));
        }
        return Promise.resolve({
          rows: [{ status: "recovered" }],
          rowCount: 1,
          columns: [{ name: "status", type: "VARCHAR", nullable: false }],
        });
      });

      // First request should fail
      const firstRequest = { sql: "SELECT 1" };
      const firstResponse = await resourceHandler.handleQuery(firstRequest);

      expect(firstResponse).toMatchObject({
        error: {
          code: "EXECUTION_ERROR",
          message: expect.any(String),
        },
      });

      // Second request should succeed (simulating recovery)
      const secondRequest = { sql: "SELECT 1" };
      const secondResponse = await resourceHandler.handleQuery(secondRequest);

      expect(secondResponse).toMatchObject({
        rows: [{ status: "recovered" }],
        rowCount: 1,
        executionTime: expect.any(Number),
      });
    });
  });

  describe("Security and Validation", () => {
    let resourceHandler: SnowflakeResourceHandler;

    beforeEach(() => {
      const snowflakeClient = new SnowflakeClient({
        account: "test-account",
        username: "test-user",
        password: "test-password",
        database: "test-db",
        schema: "test-schema",
        warehouse: "test-warehouse",
        role: "test-role",
        authenticator: "snowflake",
      });

      const sqlValidator = new SQLValidator();
      resourceHandler = new SnowflakeResourceHandler(snowflakeClient, sqlValidator);
    });

    it("should validate and sanitize input properly", async () => {
      const maliciousInputs = [
        { sql: "" }, // Empty
        { sql: "   \n\t  " }, // Whitespace only
        { query: "SELECT * FROM users" }, // Wrong property name
        {}, // Missing sql property
        { sql: null }, // Null value
        { sql: 123 }, // Wrong type
      ];

      for (const input of maliciousInputs) {
        const response = await resourceHandler.handleQuery(input);

        expect(response).toMatchObject({
          error: {
            code: "VALIDATION_ERROR",
            message: expect.any(String),
          },
        });
      }
    });

    it("should handle SQL injection attempts safely", async () => {
      const injectionAttempts = [
        "SELECT * FROM users WHERE id = 1; DROP TABLE users; --",
        "SELECT * FROM users UNION SELECT password FROM admin_users",
        "SELECT * FROM users WHERE name = 'test' OR 1=1",
        "'; EXEC sp_configure 'show advanced options', 1; --",
      ];

      // Mock that these would be caught by validation or Snowflake
      const mockClient = (resourceHandler as any).client;
      jest.spyOn(mockClient, "execute").mockRejectedValue(new Error("SQL injection attempt detected"));

      for (const sql of injectionAttempts) {
        const request = { sql };
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          error: {
            code: expect.any(String),
            message: expect.any(String),
          },
        });
      }
    });

    it("should not expose sensitive information in error messages", async () => {
      // Mock error that might contain sensitive info
      const mockClient = (resourceHandler as any).client;
      jest.spyOn(mockClient, "execute").mockRejectedValue(new Error("Connection failed: password=secret123, token=abc456"));

      const request = { sql: "SELECT * FROM users" };
      const response = await resourceHandler.handleQuery(request);

      expect(response).toMatchObject({
        error: {
          code: "EXECUTION_ERROR",
          message: expect.any(String),
        },
      });

      // Error message should not contain sensitive information
      const errorMessage = (response as any).error.message;
      expect(errorMessage).not.toContain("password=");
      expect(errorMessage).not.toContain("token=");
      expect(errorMessage).not.toContain("secret123");
      expect(errorMessage).not.toContain("abc456");
    });
  });
});
