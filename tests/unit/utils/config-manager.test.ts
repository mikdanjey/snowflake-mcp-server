/**
 * Unit tests for ConfigManager
 */

import { ConfigManager } from "../../../src/utils/config-manager.js";
import { EnvironmentConfig } from "../../../src/types/config.js";

describe("ConfigManager", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("load()", () => {
    it("should load valid configuration with password authentication", () => {
      // Arrange
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";
      process.env.SNOWFLAKE_AUTHENTICATOR = "snowflake";
      process.env.LOG_LEVEL = "debug";

      // Act
      const config = ConfigManager.load();

      // Assert
      expect(config).toEqual({
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
          logLevel: "debug",
        },
      });
    });

    it("should load valid configuration with external browser authentication", () => {
      // Arrange
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";
      process.env.SNOWFLAKE_AUTHENTICATOR = "externalbrowser";
      process.env.LOG_LEVEL = "info";

      // Act
      const config = ConfigManager.load();

      // Assert
      expect(config).toEqual({
        snowflake: {
          account: "test-account",
          username: "test-user",
          password: undefined,
          database: "test-db",
          schema: "test-schema",
          warehouse: "test-warehouse",
          role: "test-role",
          authenticator: "externalbrowser",
        },
        server: {
          logLevel: "info",
        },
      });
    });

    it("should use default values when optional environment variables are not set", () => {
      // Arrange
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";
      // SNOWFLAKE_AUTHENTICATOR and LOG_LEVEL not set

      // Act
      const config = ConfigManager.load();

      // Assert
      expect(config.snowflake.authenticator).toBe("snowflake");
      expect(config.server.logLevel).toBe("info");
    });

    it("should throw error when required SNOWFLAKE_ACCOUNT is missing", () => {
      // Arrange
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";

      // Act & Assert
      expect(() => ConfigManager.load()).toThrow("Configuration validation failed: snowflake.account: SNOWFLAKE_ACCOUNT is required and cannot be empty");
    });

    it("should throw error when required SNOWFLAKE_USER is missing", () => {
      // Arrange
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";

      // Act & Assert
      expect(() => ConfigManager.load()).toThrow("Configuration validation failed: snowflake.username: SNOWFLAKE_USER is required and cannot be empty");
    });

    it("should throw error when password is missing for snowflake authenticator", () => {
      // Arrange
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";
      process.env.SNOWFLAKE_AUTHENTICATOR = "snowflake";
      // SNOWFLAKE_PASSWORD not set

      // Act & Assert
      expect(() => ConfigManager.load()).toThrow("Configuration validation failed: snowflake.password: SNOWFLAKE_PASSWORD is required when using snowflake authenticator");
    });

    it("should throw error when required SNOWFLAKE_DATABASE is missing", () => {
      // Arrange
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";

      // Act & Assert
      expect(() => ConfigManager.load()).toThrow("Configuration validation failed: snowflake.database: SNOWFLAKE_DATABASE is required and cannot be empty");
    });

    it("should throw error when environment variables are empty strings", () => {
      // Arrange
      process.env.SNOWFLAKE_ACCOUNT = "";
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";

      // Act & Assert
      expect(() => ConfigManager.load()).toThrow("Configuration validation failed: snowflake.account: SNOWFLAKE_ACCOUNT is required and cannot be empty");
    });

    it("should throw error when invalid authenticator is provided", () => {
      // Arrange
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";
      process.env.SNOWFLAKE_AUTHENTICATOR = "invalid-auth";

      // Act & Assert
      expect(() => ConfigManager.load()).toThrow("Configuration validation failed");
    });

    it("should throw error when invalid log level is provided", () => {
      // Arrange
      process.env.SNOWFLAKE_ACCOUNT = "test-account";
      process.env.SNOWFLAKE_USER = "test-user";
      process.env.SNOWFLAKE_PASSWORD = "test-password";
      process.env.SNOWFLAKE_DATABASE = "test-db";
      process.env.SNOWFLAKE_SCHEMA = "test-schema";
      process.env.SNOWFLAKE_WAREHOUSE = "test-warehouse";
      process.env.SNOWFLAKE_ROLE = "test-role";
      process.env.LOG_LEVEL = "invalid-level";

      // Act & Assert
      expect(() => ConfigManager.load()).toThrow("Configuration validation failed");
    });

    it("should handle multiple validation errors", () => {
      // Arrange - missing multiple required fields
      process.env.SNOWFLAKE_AUTHENTICATOR = "snowflake";
      // All other required fields missing

      // Act & Assert
      expect(() => ConfigManager.load()).toThrow("Configuration validation failed");
    });
  });

  describe("validate()", () => {
    it("should validate a correct configuration object", () => {
      // Arrange
      const config = {
        snowflake: {
          account: "test-account",
          username: "test-user",
          password: "test-password",
          database: "test-db",
          schema: "test-schema",
          warehouse: "test-warehouse",
          role: "test-role",
          authenticator: "snowflake" as const,
        },
        server: {
          logLevel: "info" as const,
        },
      };

      // Act
      const result = ConfigManager.validate(config);

      // Assert
      expect(result).toEqual(config);
    });

    it("should throw error for invalid configuration object", () => {
      // Arrange
      const config = {
        snowflake: {
          account: "", // Invalid empty string
          username: "test-user",
          password: "test-password",
          database: "test-db",
          schema: "test-schema",
          warehouse: "test-warehouse",
          role: "test-role",
        },
        server: {
          logLevel: "info",
        },
      };

      // Act & Assert
      expect(() => ConfigManager.validate(config)).toThrow();
    });
  });

  describe("getSanitizedConfig()", () => {
    it("should return configuration without sensitive information", () => {
      // Arrange
      const config: EnvironmentConfig = {
        snowflake: {
          account: "test-account",
          username: "test-user",
          password: "sensitive-password",
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

      // Act
      const sanitized = ConfigManager.getSanitizedConfig(config);

      // Assert
      expect(sanitized).toEqual({
        snowflake: {
          account: "test-account",
          username: "test-user",
          database: "test-db",
          schema: "test-schema",
          warehouse: "test-warehouse",
          role: "test-role",
          authenticator: "snowflake",
          // password should be excluded
        },
        server: {
          logLevel: "info",
        },
      });
      expect(sanitized.snowflake).not.toHaveProperty("password");
    });

    it("should handle configuration with external browser authentication", () => {
      // Arrange
      const config: EnvironmentConfig = {
        snowflake: {
          account: "test-account",
          username: "test-user",
          database: "test-db",
          schema: "test-schema",
          warehouse: "test-warehouse",
          role: "test-role",
          authenticator: "externalbrowser",
        },
        server: {
          logLevel: "debug",
        },
      };

      // Act
      const sanitized = ConfigManager.getSanitizedConfig(config);

      // Assert
      expect(sanitized).toEqual({
        snowflake: {
          account: "test-account",
          username: "test-user",
          database: "test-db",
          schema: "test-schema",
          warehouse: "test-warehouse",
          role: "test-role",
          authenticator: "externalbrowser",
        },
        server: {
          logLevel: "debug",
        },
      });
    });
  });
});
