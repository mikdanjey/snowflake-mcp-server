/**
 * Integration tests for MCP protocol communication
 * Tests complete request/response cycles with mock Snowflake connections
 */

import { jest } from "@jest/globals";
import { MCPServer } from "../../src/server/mcp-server.js";
import { SnowflakeClient } from "../../src/clients/snowflake-client.js";
import { SnowflakeResourceHandler } from "../../src/handlers/snowflake-resource-handler.js";
import { SQLValidator } from "../../src/validators/sql-validator.js";
import { ConfigManager } from "../../src/utils/config-manager.js";
import { validQueries, invalidQueries } from "../fixtures/sql-queries.js";
import type { SnowflakeConfig } from "../../src/types/config.js";

// Mock external dependencies
jest.mock("snowflake-sdk");
jest.mock("@modelcontextprotocol/sdk/server/mcp.js");
jest.mock("@modelcontextprotocol/sdk/server/stdio.js");

describe("MCP Protocol Integration Tests", () => {
  let mcpServer: MCPServer;
  let snowflakeClient: SnowflakeClient;
  let resourceHandler: SnowflakeResourceHandler;
  let sqlValidator: SQLValidator;
  let mockConfig: SnowflakeConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock environment variables
    process.env.SNOWFLAKE_ACCOUNT = "test-account";
    process.env.SNOWFLAKE_USER = "test-user";
    process.env.SNOWFLAKE_PASSWORD = "test-password";
    process.env.SNOWFLAKE_DATABASE = "test-db";
    process.env.SNOWFLAKE_SCHEMA = "test-schema";
    process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
    process.env.SNOWFLAKE_ROLE = "test-role";
    process.env.SNOWFLAKE_AUTHENTICATOR = "snowflake";

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

    // Initialize components
    snowflakeClient = new SnowflakeClient(mockConfig);
    sqlValidator = new SQLValidator();
    resourceHandler = new SnowflakeResourceHandler(snowflakeClient, sqlValidator);
    mcpServer = new MCPServer({
      name: "snowflake-mcp-server",
      version: "1.0.0",
    });
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.SNOWFLAKE_ACCOUNT;
    delete process.env.SNOWFLAKE_USER;
    delete process.env.SNOWFLAKE_PASSWORD;
    delete process.env.SNOWFLAKE_DATABASE;
    delete process.env.SNOWFLAKE_SCHEMA;
    delete process.env.SNOWFLAKE_WAREHOUSE;
    delete process.env.SNOWFLAKE_ROLE;
    delete process.env.SNOWFLAKE_AUTHENTICATOR;
  });

  describe("McpServer Initialization and Registration", () => {
    it("should initialize MCP server with correct configuration", () => {
      expect(mcpServer).toBeInstanceOf(MCPServer);
      expect(mcpServer.isServerRunning()).toBe(false);
    });

    it("should register resource handler successfully", () => {
      expect(() => mcpServer.registerResourceHandler(resourceHandler)).not.toThrow();
    });

    it("should fail to start without registered resource handler", async () => {
      const serverWithoutHandler = new MCPServer({
        name: "test-server",
        version: "1.0.0",
      });

      await expect(serverWithoutHandler.start()).rejects.toThrow("Resource handler must be registered before starting server");
    });
  });

  describe("Resource Handler Query Processing", () => {
    beforeEach(() => {
      mcpServer.registerResourceHandler(resourceHandler);
    });

    describe("Valid Query Processing", () => {
      it("should process simple SELECT query successfully", async () => {
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

        // Mock the Snowflake client execute method
        jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

        const request = { sql: validQueries.simple.select };
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          rows: mockResult.rows,
          rowCount: mockResult.rowCount,
          executionTime: expect.any(Number),
          metadata: {
            columns: mockResult.columns,
          },
        });
      });

      it("should process SHOW TABLES query successfully", async () => {
        const mockResult = {
          rows: [
            {
              name: "users",
              type: "TABLE",
              database_name: "test-db",
              schema_name: "test-schema",
            },
            {
              name: "orders",
              type: "TABLE",
              database_name: "test-db",
              schema_name: "test-schema",
            },
          ],
          rowCount: 2,
          columns: [
            { name: "name", type: "VARCHAR", nullable: false },
            { name: "type", type: "VARCHAR", nullable: false },
            { name: "database_name", type: "VARCHAR", nullable: false },
            { name: "schema_name", type: "VARCHAR", nullable: false },
          ],
        };

        jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

        const request = { sql: validQueries.simple.show };
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          rows: mockResult.rows,
          rowCount: mockResult.rowCount,
          executionTime: expect.any(Number),
        });
      });

      it("should process DESCRIBE query successfully", async () => {
        const mockResult = {
          rows: [
            {
              name: "id",
              type: "NUMBER(38,0)",
              kind: "COLUMN",
              null: "N",
              default: null,
            },
            {
              name: "name",
              type: "VARCHAR(255)",
              kind: "COLUMN",
              null: "N",
              default: null,
            },
            {
              name: "email",
              type: "VARCHAR(255)",
              kind: "COLUMN",
              null: "Y",
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

        const request = { sql: validQueries.simple.describe };
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          rows: mockResult.rows,
          rowCount: mockResult.rowCount,
          executionTime: expect.any(Number),
        });
      });

      it("should process complex query with joins and aggregations", async () => {
        const mockResult = {
          rows: [
            { id: 1, name: "John Doe", order_count: 5, avg_order_value: 125.5 },
            {
              id: 2,
              name: "Jane Smith",
              order_count: 3,
              avg_order_value: 89.33,
            },
          ],
          rowCount: 2,
          columns: [
            { name: "id", type: "NUMBER", nullable: false },
            { name: "name", type: "VARCHAR", nullable: false },
            { name: "order_count", type: "NUMBER", nullable: false },
            { name: "avg_order_value", type: "NUMBER", nullable: false },
          ],
        };

        jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

        const request = { sql: validQueries.complex.joinWithAggregation };
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          rows: mockResult.rows,
          rowCount: mockResult.rowCount,
          executionTime: expect.any(Number),
        });
      });

      it("should handle Snowflake-specific queries (VARIANT, time travel)", async () => {
        const mockResult = {
          rows: [{ name: "John Doe" }, { name: "Jane Smith" }],
          rowCount: 2,
          columns: [{ name: "name", type: "VARCHAR", nullable: false }],
        };

        jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

        const request = { sql: validQueries.snowflakeSpecific.variant };
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          rows: mockResult.rows,
          rowCount: mockResult.rowCount,
          executionTime: expect.any(Number),
        });
      });
    });

    describe("Invalid Query Handling", () => {
      it("should handle empty query validation error", async () => {
        const request = { sql: invalidQueries.empty };
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          error: {
            code: "VALIDATION_ERROR",
            message: expect.any(String),
          },
        });
      });

      it("should handle whitespace-only query validation error", async () => {
        const request = { sql: invalidQueries.whitespaceOnly };
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          error: {
            code: "VALIDATION_ERROR",
            message: expect.any(String),
          },
        });
      });

      it("should handle malformed request structure", async () => {
        const request = { query: "SELECT * FROM users" }; // Wrong property name
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          error: {
            code: "VALIDATION_ERROR",
            message: expect.any(String),
          },
        });
      });

      it("should handle missing request properties", async () => {
        const request = {}; // Missing sql property
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          error: {
            code: "VALIDATION_ERROR",
            message: expect.any(String),
          },
        });
      });
    });

    describe("Snowflake Execution Error Handling", () => {
      it("should handle SQL syntax errors from Snowflake", async () => {
        const sqlError = new Error("SQL compilation error: syntax error line 1 at position 7 unexpected 'FORM'");
        jest.spyOn(snowflakeClient, "execute").mockRejectedValue(sqlError);

        const request = { sql: "SELECT * FORM users" }; // Intentional typo
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          error: {
            code: "EXECUTION_ERROR",
            message: expect.any(String),
          },
        });
      });

      it("should handle table not found errors", async () => {
        const tableError = new Error("Object 'NONEXISTENT_TABLE' does not exist");
        jest.spyOn(snowflakeClient, "execute").mockRejectedValue(tableError);

        const request = { sql: "SELECT * FROM nonexistent_table" };
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          error: {
            code: "EXECUTION_ERROR",
            message: expect.any(String),
          },
        });
      });

      it("should handle connection timeout errors", async () => {
        const timeoutError = new Error("Query execution timeout after 30000ms");
        jest.spyOn(snowflakeClient, "execute").mockRejectedValue(timeoutError);

        const request = { sql: validQueries.complex.joinWithAggregation };
        const response = await resourceHandler.handleQuery(request);

        expect(response).toMatchObject({
          error: {
            code: "EXECUTION_ERROR",
            message: expect.any(String),
          },
        });
      });
    });

    describe("Query Performance and Complexity", () => {
      it("should handle low complexity queries quickly", async () => {
        const mockResult = {
          rows: [{ count: 100 }],
          rowCount: 1,
          columns: [{ name: "count", type: "NUMBER", nullable: false }],
        };

        jest.spyOn(snowflakeClient, "execute").mockResolvedValue(mockResult);

        const request = { sql: "SELECT COUNT(*) FROM users" };
        const startTime = Date.now();
        const response = await resourceHandler.handleQuery(request);
        const endTime = Date.now();

        expect(response).toMatchObject({
          rows: mockResult.rows,
          rowCount: mockResult.rowCount,
          executionTime: expect.any(Number),
        });

        // Should complete quickly for simple queries
        expect(endTime - startTime).toBeLessThan(1000);
      });

      it("should properly categorize query complexity", async () => {
        const stats = await resourceHandler.getQueryStats(validQueries.complex.joinWithAggregation);
        expect(stats.estimatedComplexity).toBe("medium");

        const windowStats = await resourceHandler.getQueryStats(validQueries.complex.windowFunction);
        expect(windowStats.estimatedComplexity).toBe("high");

        const simpleStats = await resourceHandler.getQueryStats(validQueries.simple.select);
        expect(simpleStats.estimatedComplexity).toBe("low");
      });
    });
  });

  describe("Query Validation Only", () => {
    beforeEach(() => {
      mcpServer.registerResourceHandler(resourceHandler);
    });

    it("should validate query without execution", async () => {
      const request = { sql: validQueries.simple.select };
      const result = await resourceHandler.validateQueryOnly(request);

      expect(result).toMatchObject({
        isValid: true,
        stats: {
          queryType: expect.any(String),
          isReadOnly: true,
          estimatedComplexity: "low",
        },
      });
    });

    it("should return validation error for invalid query", async () => {
      const request = { sql: invalidQueries.empty };
      const result = await resourceHandler.validateQueryOnly(request);

      expect(result).toMatchObject({
        isValid: false,
        error: expect.objectContaining({
          message: expect.any(String),
        }),
      });
    });
  });
});
