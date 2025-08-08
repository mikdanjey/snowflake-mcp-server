/**
 * Configuration interfaces for the Snowflake MCP Server
 */

export interface SnowflakeConfig {
  account: string;
  username: string;
  password?: string;
  database: string;
  schema: string;
  warehouse: string;
  role: string;
  authenticator: "snowflake" | "externalbrowser";
}

export interface ServerConfig {
  logLevel: string;
}

export interface EnvironmentConfig {
  snowflake: SnowflakeConfig;
  server: ServerConfig;
}
