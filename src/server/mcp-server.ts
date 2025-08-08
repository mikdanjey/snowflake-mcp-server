import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { SnowflakeResourceHandler } from "../handlers/index.js";
import { createComponentLogger, ErrorHandler } from "../utils/index.js";

export interface MCPServerConfig {
  name: string;
  version: string;
}

export class MCPServer {
  private readonly server: McpServer;
  private readonly transport: StdioServerTransport;
  private readonly config: MCPServerConfig;
  private readonly logger = createComponentLogger("MCPServer");
  private resourceHandler?: SnowflakeResourceHandler;
  private isRunning = false;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.server = new McpServer(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      },
    );
    this.transport = new StdioServerTransport();
    this.setupHandlers();
  }

  /**
   * Register the Snowflake resource handler
   */
  registerResourceHandler(handler: SnowflakeResourceHandler): void {
    this.logger.info("Registering Snowflake resource handler", {
      operation: "registerResourceHandler",
    });

    this.resourceHandler = handler;
    this.logger.debug("Resource handler registered successfully", {
      operation: "registerResourceHandler",
    });
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    try {
      this.logger.info("Starting MCP server", {
        operation: "start",
        serverName: this.config.name,
        serverVersion: this.config.version,
      });

      if (this.isRunning) {
        this.logger.warn("McpServer is already running", {
          operation: "start",
        });
        return;
      }

      if (!this.resourceHandler) {
        throw new Error("Resource handler must be registered before starting server");
      }

      await this.server.connect(this.transport);
      this.isRunning = true;

      this.logger.info("MCP server started successfully", {
        operation: "start",
        transport: "stdio",
      });
    } catch (error) {
      const protocolError = ErrorHandler.handleProtocolError(error as Error, {
        operation: "start",
        serverName: this.config.name,
      });

      this.logger.error("Failed to start MCP server", error as Error, {
        operation: "start",
        errorCode: protocolError.error.code,
      });
      throw new Error(`Failed to start MCP server: ${(error as Error).message}`);
    }
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    try {
      this.logger.info("Stopping MCP server", {
        operation: "stop",
      });

      if (!this.isRunning) {
        this.logger.warn("McpServer is not running", {
          operation: "stop",
        });
        return;
      }

      await this.server.close();
      this.isRunning = false;

      this.logger.info("MCP server stopped successfully", {
        operation: "stop",
      });
    } catch (error) {
      const protocolError = ErrorHandler.handleProtocolError(error as Error, {
        operation: "stop",
      });

      this.logger.error("Error stopping MCP server", error as Error, {
        operation: "stop",
        errorCode: protocolError.error.code,
      });
      throw new Error(`Failed to stop MCP server: ${(error as Error).message}`);
    }
  }

  /**
   * Check if the server is running
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    this.logger.debug("Setting up MCP protocol handlers", {
      operation: "setupHandlers",
    });

    // Register the Snowflake query resource
    this.server.resource(
      "Snowflake Query",
      "snowflake://query",
      {
        description: "Execute SQL queries against Snowflake database",
        mimeType: "application/json",
      },
      async uri => {
        this.logger.debug("Handling read resource request", {
          operation: "readResource",
          uri: uri.toString(),
        });

        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: "application/json",
              text: JSON.stringify({
                description: "Execute SQL queries against Snowflake database",
                schema: {
                  type: "object",
                  properties: {
                    sql: {
                      type: "string",
                      description: "The SQL query to run on Snowflake",
                    },
                  },
                  required: ["sql"],
                },
              }),
            },
          ],
        };
      },
    );

    // Register the Snowflake query tool
    this.server.tool(
      "snowflake_query",
      "Execute SQL queries against Snowflake database",
      {
        sql: z.string().describe("The SQL query to run on Snowflake"),
      },
      async args => {
        this.logger.debug("Handling tool call request", {
          operation: "callTool",
          toolName: "snowflake_query",
        });

        if (!this.resourceHandler) {
          throw new Error("Resource handler not registered");
        }

        try {
          const result = await this.resourceHandler.handleQuery(args);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const executionError = ErrorHandler.handleExecutionError(error as Error, {
            operation: "callTool",
            toolName: "snowflake_query",
          });

          this.logger.error("Tool call failed", error as Error, {
            operation: "callTool",
            toolName: "snowflake_query",
            errorCode: executionError.error.code,
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(executionError, null, 2),
              },
            ],
            isError: true,
          };
        }
      },
    );

    this.logger.debug("MCP protocol handlers setup complete", {
      operation: "setupHandlers",
    });
  }
}
