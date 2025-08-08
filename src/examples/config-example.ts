/**
 * Example usage of ConfigManager
 * This file demonstrates how to use the configuration management system
 */

import { ConfigManager } from "../utils/config-manager.js";

// Example of loading configuration
try {
  const config = ConfigManager.load();

  // Get sanitized config for logging (without sensitive data)
  const sanitizedConfig = ConfigManager.getSanitizedConfig(config);

  console.log("Configuration loaded successfully:");
  console.log(JSON.stringify(sanitizedConfig, null, 2));

  // Access specific configuration values
  console.log(`Connecting to Snowflake account: ${config.snowflake.account}`);
  console.log(`Using database: ${config.snowflake.database}`);
  console.log(`Authentication method: ${config.snowflake.authenticator}`);
} catch (error) {
  console.error("Failed to load configuration:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
