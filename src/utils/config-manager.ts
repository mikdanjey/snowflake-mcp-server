/**
 * Configuration Manager for loading and validating environment variables
 */

import { z } from "zod";
import type { EnvironmentConfig } from "../types/config.js";

/**
 * Zod schema for Snowflake configuration validation
 */
const SnowflakeConfigSchema = z
  .object({
    account: z
      .string({
        required_error: "SNOWFLAKE_ACCOUNT is required and cannot be empty",
        invalid_type_error: "SNOWFLAKE_ACCOUNT must be a string",
      })
      .min(1, "SNOWFLAKE_ACCOUNT is required and cannot be empty"),
    username: z
      .string({
        required_error: "SNOWFLAKE_USER is required and cannot be empty",
        invalid_type_error: "SNOWFLAKE_USER must be a string",
      })
      .min(1, "SNOWFLAKE_USER is required and cannot be empty"),
    password: z.string().optional(),
    database: z
      .string({
        required_error: "SNOWFLAKE_DATABASE is required and cannot be empty",
        invalid_type_error: "SNOWFLAKE_DATABASE must be a string",
      })
      .min(1, "SNOWFLAKE_DATABASE is required and cannot be empty"),
    schema: z
      .string({
        required_error: "SNOWFLAKE_SCHEMA is required and cannot be empty",
        invalid_type_error: "SNOWFLAKE_SCHEMA must be a string",
      })
      .min(1, "SNOWFLAKE_SCHEMA is required and cannot be empty"),
    warehouse: z
      .string({
        required_error: "SNOWFLAKE_WAREHOUSE is required and cannot be empty",
        invalid_type_error: "SNOWFLAKE_WAREHOUSE must be a string",
      })
      .min(1, "SNOWFLAKE_WAREHOUSE is required and cannot be empty"),
    role: z
      .string({
        required_error: "SNOWFLAKE_ROLE is required and cannot be empty",
        invalid_type_error: "SNOWFLAKE_ROLE must be a string",
      })
      .min(1, "SNOWFLAKE_ROLE is required and cannot be empty"),
    authenticator: z.enum(["snowflake", "externalbrowser"]).optional().default("snowflake"),
  })
  .refine(
    data => {
      // If using snowflake authenticator, password is required
      if (data.authenticator === "snowflake" && !data.password) {
        return false;
      }
      return true;
    },
    {
      message: "SNOWFLAKE_PASSWORD is required when using snowflake authenticator",
      path: ["password"],
    },
  );

/**
 * Zod schema for server configuration validation
 */
const ServerConfigSchema = z.object({
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

/**
 * Zod schema for complete environment configuration validation
 */
const EnvironmentConfigSchema = z.object({
  snowflake: SnowflakeConfigSchema,
  server: ServerConfigSchema,
});

export class ConfigManager {
  /**
   * Load configuration from environment variables
   * @returns Validated environment configuration
   * @throws Error if required environment variables are missing or invalid
   */
  static load(): EnvironmentConfig {
    try {
      const rawConfig = this.loadRawConfig();
      return this.validate(rawConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join(".")}: ${err.message}`).join(", ");
        const configError = new Error(`Configuration validation failed: ${errorMessages}`);
        throw configError;
      }
      throw error;
    }
  }

  /**
   * Validate the provided configuration object
   * @param config Raw configuration object to validate
   * @returns Validated environment configuration
   * @throws Error if configuration is invalid
   */
  static validate(config: unknown): EnvironmentConfig {
    return EnvironmentConfigSchema.parse(config) as EnvironmentConfig;
  }

  /**
   * Load raw configuration from environment variables
   * @returns Raw configuration object
   * @private
   */
  private static loadRawConfig(): unknown {
    const authenticator = process.env["SNOWFLAKE_AUTHENTICATOR"] as "snowflake" | "externalbrowser" | undefined;

    return {
      snowflake: {
        account: process.env["SNOWFLAKE_ACCOUNT"],
        username: process.env["SNOWFLAKE_USER"],
        password: process.env["SNOWFLAKE_PASSWORD"],
        database: process.env["SNOWFLAKE_DATABASE"],
        schema: process.env["SNOWFLAKE_SCHEMA"],
        warehouse: process.env["SNOWFLAKE_WAREHOUSE"],
        role: process.env["SNOWFLAKE_ROLE"],
        authenticator: authenticator || "snowflake",
      },
      server: {
        logLevel: process.env["LOG_LEVEL"] || "info",
      },
    };
  }

  /**
   * Get a sanitized version of the configuration for logging
   * Removes sensitive information like passwords
   * @param config Configuration to sanitize
   * @returns Sanitized configuration safe for logging
   */
  static getSanitizedConfig(config: EnvironmentConfig): {
    snowflake: Omit<EnvironmentConfig["snowflake"], "password">;
    server: EnvironmentConfig["server"];
  } {
    const { password, ...snowflakeWithoutPassword } = config.snowflake;
    return {
      snowflake: snowflakeWithoutPassword,
      server: config.server,
    };
  }
}
