/**
 * Application class for the Snowflake MCP Server
 * Separated from main.ts to avoid import.meta issues in tests
 */

import { MCPServer } from "./server/index.js";
import { SnowflakeClient } from "./clients/index.js";
import { SnowflakeResourceHandler } from "./handlers/index.js";
import { SQLValidator } from "./validators/index.js";
import { ConfigManager, createComponentLogger, ErrorHandler } from "./utils/index.js";
import type { EnvironmentConfig } from "./types/index.js";

export class Application {
  private server?: MCPServer;
  private snowflakeClient?: SnowflakeClient;
  private logger = createComponentLogger("Application");
  private isShuttingDown = false;
  private exitProcess: (code: number) => void = process.exit;

  /**
   * Main application startup sequence with performance optimizations
   */
  async start(): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting Snowflake MCP Server...");

      // Step 1: Load and validate configuration (synchronous, fast)
      const config = await this.loadConfiguration();

      // Step 2: Initialize components in parallel for faster startup
      const [snowflakeClient, mcpServer] = await Promise.all([this.initializeSnowflakeClient(config), this.initializeMCPServerComponents(config)]);

      this.snowflakeClient = snowflakeClient;
      this.server = mcpServer;

      // Step 3: Register resource handler and start server
      const sqlValidator = new SQLValidator();
      const resourceHandler = new SnowflakeResourceHandler(this.snowflakeClient, sqlValidator);
      this.server.registerResourceHandler(resourceHandler);

      // Step 4: Start the MCP server (fast, just STDIO setup)
      await this.server.start();

      const startupTime = Date.now() - startTime;
      this.logger.info("Snowflake MCP Server started successfully", {
        startupTimeMs: startupTime,
        account: config.snowflake.account,
        database: config.snowflake.database,
        schema: config.snowflake.schema,
        warehouse: config.snowflake.warehouse,
        performanceTarget: startupTime < 1000 ? "MET" : "EXCEEDED",
      });

      // Validate startup time requirement (sub-1-second)
      if (startupTime >= 1000) {
        this.logger.warn("Startup time exceeded 1 second target", {
          startupTimeMs: startupTime,
          target: "< 1000ms",
          suggestion: "Consider lazy connection initialization",
        });
      }
    } catch (error) {
      const startupTime = Date.now() - startTime;

      // Use ErrorHandler to categorize and format the error
      const errorCategory = ErrorHandler.categorizeError(error as Error);
      let errorResponse;

      switch (errorCategory) {
        case "CONFIG_ERROR":
          errorResponse = ErrorHandler.handleConfigurationError(error as Error, { startupTimeMs: startupTime });
          break;
        case "CONNECTION_ERROR":
          errorResponse = ErrorHandler.handleConnectionError(error as Error, {
            startupTimeMs: startupTime,
          });
          break;
        default:
          errorResponse = ErrorHandler.handleInternalError(error as Error, {
            startupTimeMs: startupTime,
          });
      }

      this.logger.error("Failed to start Snowflake MCP Server", error as Error, {
        startupTimeMs: startupTime,
        errorCategory,
        errorCode: errorResponse.error.code,
      });

      // Cleanup any partially initialized resources
      await this.cleanup();
      this.exitProcess(1);
    }
  }

  /**
   * Load and validate configuration from environment variables
   */
  private async loadConfiguration(): Promise<EnvironmentConfig> {
    try {
      this.logger.debug("Loading configuration from environment variables");
      const config = ConfigManager.load();

      this.logger.info("Configuration loaded successfully", {
        account: config.snowflake.account,
        database: config.snowflake.database,
        schema: config.snowflake.schema,
        warehouse: config.snowflake.warehouse,
        authenticator: config.snowflake.authenticator || "snowflake",
      });

      return config;
    } catch (error) {
      this.logger.error("Configuration loading failed", error as Error);
      throw error;
    }
  }

  /**
   * Initialize Snowflake client with optimized connection strategy
   */
  private async initializeSnowflakeClient(config: EnvironmentConfig): Promise<SnowflakeClient> {
    try {
      this.logger.debug("Initializing Snowflake client");
      const client = new SnowflakeClient(config.snowflake);

      // For faster startup, establish connection on first use rather than during initialization
      // This allows the MCP server to start quickly and connect when needed
      this.logger.debug("Snowflake client initialized (connection will be established on first use)");

      return client;
    } catch (error) {
      this.logger.error("Snowflake client initialization failed", error as Error);
      throw error;
    }
  }

  /**
   * Initialize MCP server components (without resource handler registration)
   */
  private async initializeMCPServerComponents(_config: EnvironmentConfig): Promise<MCPServer> {
    try {
      this.logger.debug("Initializing MCP server components");

      // Create MCP server (lightweight initialization)
      const server = new MCPServer({
        name: "snowflake-mcp-server",
        version: "1.0.0",
      });

      this.logger.debug("MCP server components initialized");
      return server;
    } catch (error) {
      this.logger.error("MCP server initialization failed", error as Error);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupShutdownHandlers(): void {
    const shutdownHandler = async (signal: string) => {
      if (this.isShuttingDown) {
        this.logger.info("Force shutdown requested");
        this.exitProcess(1);
      }

      this.isShuttingDown = true;
      this.logger.info(`Received ${signal}, initiating graceful shutdown...`);

      try {
        await this.shutdown();
        this.logger.info("Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        this.logger.error("Error during shutdown", error as Error);
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on("SIGINT", () => shutdownHandler("SIGINT"));
    process.on("SIGTERM", () => shutdownHandler("SIGTERM"));
    process.on("SIGQUIT", () => shutdownHandler("SIGQUIT"));

    // Handle uncaught exceptions and unhandled rejections
    process.on("uncaughtException", error => {
      this.logger.error("Uncaught exception", error);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
      this.logger.error("Unhandled promise rejection", new Error(String(reason)), {
        promise: promise.toString(),
      });
      process.exit(1);
    });
  }

  /**
   * Graceful shutdown sequence
   */
  private async shutdown(): Promise<void> {
    const shutdownTasks: Promise<void>[] = [];

    // Stop MCP server
    if (this.server) {
      this.logger.debug("Stopping MCP server");
      shutdownTasks.push(
        this.server.stop().catch(error => {
          this.logger.error("Error stopping MCP server", error);
        }),
      );
    }

    // Disconnect from Snowflake
    if (this.snowflakeClient) {
      this.logger.debug("Disconnecting from Snowflake");
      shutdownTasks.push(
        this.snowflakeClient.disconnect().catch(error => {
          this.logger.error("Error disconnecting from Snowflake", error);
        }),
      );
    }

    // Wait for all shutdown tasks to complete
    await Promise.all(shutdownTasks);
  }

  /**
   * Cleanup resources in case of startup failure
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.snowflakeClient) {
        await this.snowflakeClient.disconnect();
      }
      if (this.server) {
        await this.server.stop();
      }
    } catch (error) {
      this.logger.error("Error during cleanup", error as Error);
    }
  }
}
