/**
 * Unit tests for MCPServer class
 */

import { MCPServer, type MCPServerConfig } from "../../../src/server/mcp-server.js";
import { SnowflakeResourceHandler } from "../../../src/handlers/snowflake-resource-handler.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Mock the MCP SDK
jest.mock("@modelcontextprotocol/sdk/server/mcp.js");
jest.mock("@modelcontextprotocol/sdk/server/stdio.js");
jest.mock("../../../src/utils/index.js", () => ({
  createComponentLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
  ErrorHandler: {
    handleProtocolError: jest.fn().mockImplementation((error, context) => ({
      error: {
        code: "PROTOCOL_ERROR",
        message: "MCP protocol communication error",
        details: {
          originalMessage: error.message,
          suggestion: "Check MCP client compatibility and communication channel",
        },
      },
    })),
    handleExecutionError: jest.fn().mockImplementation((error, context) => ({
      error: {
        code: "EXECUTION_ERROR",
        message: "SQL execution failed",
        details: {
          originalMessage: error.message,
          suggestion: "Check SQL syntax and ensure the query is valid for Snowflake",
        },
      },
    })),
  },
}));

// Mock the resource handler
jest.mock("../../../src/handlers/snowflake-resource-handler.js");

describe("MCPServer", () => {
  let mcpServer: MCPServer;
  let mockServer: jest.Mocked<McpServer>;
  let mockTransport: jest.Mocked<StdioServerTransport>;
  let mockResourceHandler: jest.Mocked<SnowflakeResourceHandler>;
  let config: MCPServerConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock instances
    mockServer = {
      connect: jest.fn(),
      close: jest.fn(),
      resource: jest.fn(),
      tool: jest.fn(),
    } as any;

    mockTransport = {} as any;

    mockResourceHandler = {
      handleQuery: jest.fn(),
    } as any;

    // Mock constructors
    (McpServer as jest.MockedClass<typeof McpServer>).mockImplementation(() => mockServer);
    (StdioServerTransport as jest.MockedClass<typeof StdioServerTransport>).mockImplementation(() => mockTransport);

    config = {
      name: "test-server",
      version: "1.0.0",
    };

    mcpServer = new MCPServer(config);
  });

  describe("constructor", () => {
    it("should create server with correct configuration", () => {
      expect(McpServer).toHaveBeenCalledWith(
        {
          name: "test-server",
          version: "1.0.0",
        },
        {
          capabilities: {
            resources: {},
            tools: {},
          },
        },
      );
      expect(StdioServerTransport).toHaveBeenCalled();
    });

    it("should setup MCP protocol handlers", () => {
      expect(mockServer.resource).toHaveBeenCalledTimes(1);
      expect(mockServer.tool).toHaveBeenCalledTimes(1);
    });
  });

  describe("registerResourceHandler", () => {
    it("should register resource handler successfully", () => {
      mcpServer.registerResourceHandler(mockResourceHandler);
      expect(mcpServer["resourceHandler"]).toBe(mockResourceHandler);
    });
  });

  describe("start", () => {
    beforeEach(() => {
      mcpServer.registerResourceHandler(mockResourceHandler);
    });

    it("should start server successfully", async () => {
      mockServer.connect.mockResolvedValue(undefined);

      await mcpServer.start();

      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
      expect(mcpServer.isServerRunning()).toBe(true);
    });

    it("should throw error if resource handler not registered", async () => {
      const serverWithoutHandler = new MCPServer(config);

      await expect(serverWithoutHandler.start()).rejects.toThrow("Resource handler must be registered before starting server");
    });

    it("should not start if already running", async () => {
      mockServer.connect.mockResolvedValue(undefined);

      await mcpServer.start();
      await mcpServer.start(); // Second call

      expect(mockServer.connect).toHaveBeenCalledTimes(1);
    });

    it("should handle connection errors", async () => {
      const connectionError = new Error("Connection failed");
      mockServer.connect.mockRejectedValue(connectionError);

      await expect(mcpServer.start()).rejects.toThrow("Failed to start MCP server: Connection failed");
      expect(mcpServer.isServerRunning()).toBe(false);
    });
  });

  describe("stop", () => {
    beforeEach(async () => {
      mcpServer.registerResourceHandler(mockResourceHandler);
      mockServer.connect.mockResolvedValue(undefined);
      await mcpServer.start();
    });

    it("should stop server successfully", async () => {
      mockServer.close.mockResolvedValue(undefined);

      await mcpServer.stop();

      expect(mockServer.close).toHaveBeenCalled();
      expect(mcpServer.isServerRunning()).toBe(false);
    });

    it("should not stop if not running", async () => {
      await mcpServer.stop(); // First stop
      await mcpServer.stop(); // Second stop

      expect(mockServer.close).toHaveBeenCalledTimes(1);
    });

    it("should handle close errors", async () => {
      const closeError = new Error("Close failed");
      mockServer.close.mockRejectedValue(closeError);

      await expect(mcpServer.stop()).rejects.toThrow("Failed to stop MCP server: Close failed");
    });
  });

  describe("isServerRunning", () => {
    it("should return false initially", () => {
      expect(mcpServer.isServerRunning()).toBe(false);
    });

    it("should return true after starting", async () => {
      mcpServer.registerResourceHandler(mockResourceHandler);
      mockServer.connect.mockResolvedValue(undefined);

      await mcpServer.start();

      expect(mcpServer.isServerRunning()).toBe(true);
    });

    it("should return false after stopping", async () => {
      mcpServer.registerResourceHandler(mockResourceHandler);
      mockServer.connect.mockResolvedValue(undefined);
      mockServer.close.mockResolvedValue(undefined);

      await mcpServer.start();
      await mcpServer.stop();

      expect(mcpServer.isServerRunning()).toBe(false);
    });
  });

  describe("MCP protocol handlers", () => {
    let resourceCallback: Function;
    let toolCallback: any;

    beforeEach(() => {
      // Extract the callbacks that were registered
      const resourceCalls = mockServer.resource.mock.calls;
      const toolCalls = mockServer.tool.mock.calls;

      if (resourceCalls.length > 0) {
        resourceCallback = resourceCalls[0][3]; // 4th argument is the callback
      }
      if (toolCalls.length > 0) {
        toolCallback = toolCalls[0][3]; // 4th argument is the callback
      }
    });

    describe("resource registration", () => {
      it("should register Snowflake query resource", () => {
        expect(mockServer.resource).toHaveBeenCalledWith(
          "Snowflake Query",
          "snowflake://query",
          {
            description: "Execute SQL queries against Snowflake database",
            mimeType: "application/json",
          },
          expect.any(Function),
        );
      });

      it("should return resource content for valid URI", async () => {
        if (!resourceCallback) {
          throw new Error("Resource callback not found");
        }

        const mockUri = new URL("snowflake://query");
        const result = await resourceCallback(mockUri);

        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe("snowflake://query");
        expect(result.contents[0].mimeType).toBe("application/json");
        expect(JSON.parse(result.contents[0].text)).toHaveProperty("schema");
      });
    });

    describe("tool registration", () => {
      it("should register Snowflake query tool", () => {
        expect(mockServer.tool).toHaveBeenCalledWith(
          "snowflake_query",
          "Execute SQL queries against Snowflake database",
          expect.any(Object), // Zod schema
          expect.any(Function),
        );
      });

      it("should throw error if resource handler not registered", async () => {
        if (!toolCallback) {
          throw new Error("Tool callback not found");
        }

        const args = { sql: "SELECT 1" };

        await expect(toolCallback(args)).rejects.toThrow("Resource handler not registered");
      });

      describe("with resource handler registered", () => {
        beforeEach(() => {
          mcpServer.registerResourceHandler(mockResourceHandler);
        });

        it("should execute snowflake_query tool successfully", async () => {
          if (!toolCallback) {
            throw new Error("Tool callback not found");
          }

          const mockQueryResult = {
            rows: [{ id: 1, name: "test" }],
            rowCount: 1,
            executionTime: 100,
          };
          mockResourceHandler.handleQuery.mockResolvedValue(mockQueryResult);

          const args = { sql: "SELECT * FROM test" };
          const result = await toolCallback(args);

          expect(mockResourceHandler.handleQuery).toHaveBeenCalledWith({
            sql: "SELECT * FROM test",
          });
          expect(result.content[0].type).toBe("text");
          expect(JSON.parse(result.content[0].text)).toEqual(mockQueryResult);
        });

        it("should handle resource handler errors gracefully", async () => {
          if (!toolCallback) {
            throw new Error("Tool callback not found");
          }

          const handlerError = new Error("Query execution failed");
          mockResourceHandler.handleQuery.mockRejectedValue(handlerError);

          const args = { sql: "INVALID SQL" };
          const result = await toolCallback(args);

          expect(result.isError).toBe(true);
          expect(result.content[0].type).toBe("text");
          const errorResponse = JSON.parse(result.content[0].text);
          expect(errorResponse.error.code).toBe("EXECUTION_ERROR");
          expect(errorResponse.error.details.originalMessage).toBe("Query execution failed");
        });
      });
    });
  });
});
