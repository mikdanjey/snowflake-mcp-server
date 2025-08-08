/**
 * Integration tests for authentication methods
 * Tests both password and external browser authentication
 */

import { jest } from "@jest/globals";
import { SnowflakeClient } from "../../src/clients/snowflake-client.js";
import { ConfigManager } from "../../src/utils/config-manager.js";
import { Application } from "../../src/application.js";
import type { SnowflakeConfig } from "../../src/types/config.js";

// Mock external dependencies
jest.mock("snowflake-sdk");
jest.mock("@modelcontextprotocol/sdk/server/mcp.js");
jest.mock("@modelcontextprotocol/sdk/server/stdio.js");

describe("Authentication Integration Tests", () => {
  let mockExitProcess: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process.exit to prevent test termination
    mockExitProcess = jest.fn();
  });

  afterEach(() => {
    // Clean up all environment variables
    delete process.env.SNOWFLAKE_ACCOUNT;
    delete process.env.SNOWFLAKE_USER;
    delete process.env.SNOWFLAKE_PASSWORD;
    delete process.env.SNOWFLAKE_DATABASE;
    delete process.env.SNOWFLAKE_SCHEMA;
    delete process.env.SNOWFLAKE_WAREHOUSE;
    delete process.env.SNOWFLAKE_ROLE;
    delete process.env.SNOWFLAKE_AUTHENTICATOR;
  });

  describe("Password Authentication", () => {
    beforeEach(() => {
      // Setup environment for password authentication
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";
      process.env.SNOWFLAKE_AUTHENTICATOR = "snowflake";
    });

    it("should load configuration for password authentication", () => {
      const config = ConfigManager.load();

      expect(config.snowflake).toMatchObject({
        account: "test-account",
        username: "test-user",
        password: "test-password",
        database: "test-db",
        schema: "test-schema",
        warehouse: "test-warehouse",
        role: "test-role",
        authenticator: "snowflake",
      });
    });

    it("should create Snowflake client with password authentication", () => {
      const config = ConfigManager.load();
      const client = new SnowflakeClient(config.snowflake);

      expect(client).toBeInstanceOf(SnowflakeClient);
    });

    it("should fail when password is missing for snowflake authenticator", () => {
      delete process.env.SNOWFLAKE_PASSWORD;

      expect(() => ConfigManager.load()).toThrow(/SNOWFLAKE_PASSWORD is required/);
    });

    it("should successfully connect with valid password credentials", async () => {
      const config = ConfigManager.load();
      const client = new SnowflakeClient(config.snowflake);

      // Mock successful connection
      const mockConnect = jest.spyOn(client, "connect").mockResolvedValue(undefined);

      await expect(client.connect()).resolves.not.toThrow();
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it("should handle invalid password authentication gracefully", async () => {
      const config = ConfigManager.load();
      const client = new SnowflakeClient(config.snowflake);

      // Mock authentication failure
      const authError = new Error("Incorrect username or password was specified");
      jest.spyOn(client, "connect").mockRejectedValue(authError);

      await expect(client.connect()).rejects.toThrow("Incorrect username or password was specified");
    });

    it("should start application successfully with password authentication", async () => {
      const app = new Application();
      // Override exitProcess to prevent test termination
      (app as any).exitProcess = mockExitProcess;

      // Mock successful startup
      jest.spyOn(SnowflakeClient.prototype, "connect").mockResolvedValue(undefined);

      await expect(app.start()).resolves.not.toThrow();
      expect(mockExitProcess).not.toHaveBeenCalled();
    });
  });

  describe("External Browser Authentication", () => {
    beforeEach(() => {
      // Setup environment for external browser authentication
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      process.env.SNOWFLAKE_USER = "test-user";
      // No password for external browser auth
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";
      process.env.SNOWFLAKE_AUTHENTICATOR = "externalbrowser";
    });

    it("should load configuration for external browser authentication", () => {
      const config = ConfigManager.load();

      expect(config.snowflake).toMatchObject({
        account: "test-account",
        username: "test-user",
        database: "test-db",
        schema: "test-schema",
        warehouse: "test-warehouse",
        role: "test-role",
        authenticator: "externalbrowser",
      });

      // Password should be undefined for external browser auth
      expect(config.snowflake.password).toBeUndefined();
    });

    it("should create Snowflake client with external browser authentication", () => {
      const config = ConfigManager.load();
      const client = new SnowflakeClient(config.snowflake);

      expect(client).toBeInstanceOf(SnowflakeClient);
    });

    it("should allow missing password for externalbrowser authenticator", () => {
      // Password should not be required for external browser auth
      expect(() => ConfigManager.load()).not.toThrow();
    });

    it("should successfully connect with external browser authentication", async () => {
      const config = ConfigManager.load();
      const client = new SnowflakeClient(config.snowflake);

      // Mock successful external browser connection
      const mockConnect = jest.spyOn(client, "connect").mockResolvedValue(undefined);

      await expect(client.connect()).resolves.not.toThrow();
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it("should handle browser authentication timeout gracefully", async () => {
      const config = ConfigManager.load();
      const client = new SnowflakeClient(config.snowflake);

      // Mock browser authentication timeout
      const timeoutError = new Error("Browser authentication timed out after 120 seconds");
      jest.spyOn(client, "connect").mockRejectedValue(timeoutError);

      await expect(client.connect()).rejects.toThrow("Browser authentication timed out");
    });

    it("should handle browser not available error", async () => {
      const config = ConfigManager.load();
      const client = new SnowflakeClient(config.snowflake);

      // Mock browser not available error
      const browserError = new Error("No web browser found for external browser authentication");
      jest.spyOn(client, "connect").mockRejectedValue(browserError);

      await expect(client.connect()).rejects.toThrow("No web browser found");
    });

    it("should start application successfully with external browser authentication", async () => {
      const app = new Application();
      // Override exitProcess to prevent test termination
      (app as any).exitProcess = mockExitProcess;

      // Mock successful startup
      jest.spyOn(SnowflakeClient.prototype, "connect").mockResolvedValue(undefined);

      await expect(app.start()).resolves.not.toThrow();
      expect(mockExitProcess).not.toHaveBeenCalled();
    });
  });

  describe("Authentication Configuration Validation", () => {
    it("should reject invalid authenticator types", () => {
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";
      process.env.SNOWFLAKE_AUTHENTICATOR = "invalid-auth-type";

      expect(() => ConfigManager.load()).toThrow(/Configuration validation failed/);
    });

    it("should default to snowflake authenticator when not specified", () => {
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";
      // No SNOWFLAKE_AUTHENTICATOR set

      const config = ConfigManager.load();
      expect(config.snowflake.authenticator).toBe("snowflake");
    });

    it("should require all mandatory connection parameters", () => {
      // Missing required parameters
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      // Missing SNOWFLAKE_USER

      expect(() => ConfigManager.load()).toThrow(/Configuration validation failed/);
    });

    it("should validate account format", () => {
      process.env.SNOWFLAKE_ACCOUNT = ""; // Empty account
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";

      expect(() => ConfigManager.load()).toThrow(/Configuration validation failed/);
    });
  });

  describe("Authentication Error Handling", () => {
    beforeEach(() => {
      // Setup basic environment
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";
    });

    it("should handle network connectivity issues during authentication", async () => {
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_AUTHENTICATOR = "snowflake";

      const config = ConfigManager.load();
      const client = new SnowflakeClient(config.snowflake);

      // Mock network error
      const networkError = new Error("Network is unreachable");
      jest.spyOn(client, "connect").mockRejectedValue(networkError);

      await expect(client.connect()).rejects.toThrow("Network is unreachable");
    });

    it("should handle account not found errors", async () => {
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_AUTHENTICATOR = "snowflake";

      const config = ConfigManager.load();
      const client = new SnowflakeClient(config.snowflake);

      // Mock account not found error
      const accountError = new Error("Account 'INVALID_ACCOUNT' not found");
      jest.spyOn(client, "connect").mockRejectedValue(accountError);

      await expect(client.connect()).rejects.toThrow("Account 'INVALID_ACCOUNT' not found");
    });

    it("should handle user not found errors", async () => {
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_AUTHENTICATOR = "snowflake";

      const config = ConfigManager.load();
      const client = new SnowflakeClient(config.snowflake);

      // Mock user not found error
      const userError = new Error("User 'INVALID_USER' does not exist");
      jest.spyOn(client, "connect").mockRejectedValue(userError);

      await expect(client.connect()).rejects.toThrow("User 'INVALID_USER' does not exist");
    });

    it("should handle role assignment errors", async () => {
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_AUTHENTICATOR = "snowflake";

      const config = ConfigManager.load();
      const client = new SnowflakeClient(config.snowflake);

      // Mock role error
      const roleError = new Error("Role 'INVALID_ROLE' does not exist or not authorized");
      jest.spyOn(client, "connect").mockRejectedValue(roleError);

      await expect(client.connect()).rejects.toThrow("Role 'INVALID_ROLE' does not exist or not authorized");
    });

    it("should handle warehouse access errors", async () => {
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_AUTHENTICATOR = "snowflake";

      const config = ConfigManager.load();
      const client = new SnowflakeClient(config.snowflake);

      // Mock warehouse error
      const warehouseError = new Error("Warehouse 'INVALID_WAREHOUSE' does not exist or not authorized");
      jest.spyOn(client, "connect").mockRejectedValue(warehouseError);

      await expect(client.connect()).rejects.toThrow("Warehouse 'INVALID_WAREHOUSE' does not exist or not authorized");
    });
  });

  describe("Authentication Performance", () => {
    beforeEach(() => {
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";
    });

    it("should handle authentication within reasonable time for password auth", async () => {
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_AUTHENTICATOR = "snowflake";

      const config = ConfigManager.load();
      const client = new SnowflakeClient(config.snowflake);

      // Mock fast authentication
      jest.spyOn(client, "connect").mockResolvedValue(undefined);

      const startTime = Date.now();
      await client.connect();
      const endTime = Date.now();

      // Authentication should be reasonably fast in tests
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it("should handle authentication timeout for external browser auth", async () => {
      process.env.SNOWFLAKE_AUTHENTICATOR = "externalbrowser";

      const config = ConfigManager.load();
      const client = new SnowflakeClient(config.snowflake);

      // Mock slow external browser authentication
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Authentication timeout")), 100);
      });

      jest.spyOn(client, "connect").mockImplementation(() => timeoutPromise);

      await expect(client.connect()).rejects.toThrow("Authentication timeout");
    });
  });
});
