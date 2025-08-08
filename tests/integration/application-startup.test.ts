/**
 * Integration tests for application startup sequence
 */

import { jest } from "@jest/globals";
import { ConfigManager } from "../../src/utils/config-manager.js";
import { SnowflakeClient } from "../../src/clients/snowflake-client.js";
import { MCPServer } from "../../src/server/mcp-server.js";
import { SnowflakeResourceHandler } from "../../src/handlers/snowflake-resource-handler.js";
import { SQLValidator } from "../../src/validators/sql-validator.js";

// Mock external dependencies
jest.mock("snowflake-sdk");
jest.mock("@modelcontextprotocol/sdk/server/mcp.js");
jest.mock("@modelcontextprotocol/sdk/server/stdio.js");

describe("Application Startup Integration", () => {
  let mockConfig: any;

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

  describe("Configuration Loading", () => {
    it("should load configuration from environment variables", () => {
      const config = ConfigManager.load();

      expect(config.snowflake.account).toBe("test-account");
      expect(config.snowflake.username).toBe("test-user");
      expect(config.snowflake.database).toBe("test-db");
      expect(config.snowflake.schema).toBe("test-schema");
      expect(config.snowflake.warehouse).toBe("test-warehouse");
      expect(config.snowflake.role).toBe("test-role");
      expect(config.snowflake.authenticator).toBe("snowflake");
    });

    it("should fail with missing required environment variables", () => {
      delete process.env.SNOWFLAKE_ACCOUNT;

      expect(() => ConfigManager.load()).toThrow(/Configuration validation failed/);
    });
  });

  describe("Component Integration", () => {
    it("should create all required components", () => {
      const config = ConfigManager.load();

      // Create components in the same order as main application
      const snowflakeClient = new SnowflakeClient(config.snowflake);
      const sqlValidator = new SQLValidator();
      const resourceHandler = new SnowflakeResourceHandler(snowflakeClient, sqlValidator);
      const mcpServer = new MCPServer({
        name: "snowflake-mcp-server",
        version: "1.0.0",
      });

      expect(snowflakeClient).toBeInstanceOf(SnowflakeClient);
      expect(sqlValidator).toBeInstanceOf(SQLValidator);
      expect(resourceHandler).toBeInstanceOf(SnowflakeResourceHandler);
      expect(mcpServer).toBeInstanceOf(MCPServer);
    });

    it("should register resource handler with MCP server", () => {
      const config = ConfigManager.load();
      const snowflakeClient = new SnowflakeClient(config.snowflake);
      const sqlValidator = new SQLValidator();
      const resourceHandler = new SnowflakeResourceHandler(snowflakeClient, sqlValidator);
      const mcpServer = new MCPServer({
        name: "snowflake-mcp-server",
        version: "1.0.0",
      });

      // This should not throw
      expect(() => mcpServer.registerResourceHandler(resourceHandler)).not.toThrow();
    });
  });

  describe("Startup Time Requirements", () => {
    it("should meet sub-1-second startup requirement for component creation", () => {
      const startTime = Date.now();

      const config = ConfigManager.load();
      const snowflakeClient = new SnowflakeClient(config.snowflake);
      const sqlValidator = new SQLValidator();
      const resourceHandler = new SnowflakeResourceHandler(snowflakeClient, sqlValidator);
      const mcpServer = new MCPServer({
        name: "snowflake-mcp-server",
        version: "1.0.0",
      });
      mcpServer.registerResourceHandler(resourceHandler);

      const endTime = Date.now();
      const startupTime = endTime - startTime;

      // Component creation should be very fast
      expect(startupTime).toBeLessThan(100); // 100ms should be more than enough
    });
  });

  describe("Error Handling", () => {
    it("should handle configuration errors gracefully", () => {
      delete process.env.SNOWFLAKE_ACCOUNT;
      delete process.env.SNOWFLAKE_USER;

      expect(() => ConfigManager.load()).toThrow();
    });

    it("should validate authenticator types", () => {
      process.env.SNOWFLAKE_AUTHENTICATOR = "invalid";

      expect(() => ConfigManager.load()).toThrow(/Configuration validation failed/);
    });

    it("should require password for snowflake authenticator", () => {
      delete process.env.SNOWFLAKE_PASSWORD;
      process.env.SNOWFLAKE_AUTHENTICATOR = "snowflake";

      expect(() => ConfigManager.load()).toThrow(/SNOWFLAKE_PASSWORD is required/);
    });

    it("should allow missing password for externalbrowser authenticator", () => {
      delete process.env.SNOWFLAKE_PASSWORD;
      process.env.SNOWFLAKE_AUTHENTICATOR = "externalbrowser";

      expect(() => ConfigManager.load()).not.toThrow();
    });
  });
});
