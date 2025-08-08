/**
 * Main entry point for the Snowflake MCP Server
 * Exports all public interfaces and classes
 */
import dotenv from "dotenv";
dotenv.config({ debug: false });

// Core server
export { MCPServer, type MCPServerConfig } from "./server/index.js";

// Handlers
export { SnowflakeResourceHandler } from "./handlers/index.js";

// Clients
export { SnowflakeClient } from "./clients/index.js";

// Validators
export { SQLValidator } from "./validators/index.js";

// Utilities
export { ConfigManager, createComponentLogger } from "./utils/index.js";

// Types
export type { SnowflakeConfig, ServerConfig, EnvironmentConfig, QueryRequest, QueryResponse, ColumnMetadata, ValidationError, ErrorResponse, LogContext, LogLevel, LogEntry } from "./types/index.js";
