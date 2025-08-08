/**
 * Unit tests for SnowflakeClient
 */

import { jest } from "@jest/globals";
import type { SnowflakeConfig } from "../../../src/types/index.js";
import { SnowflakeClient } from "../../../src/clients/snowflake-client.js";
import { mockConnection, mockCreateConnection } from "../../__mocks__/snowflake-sdk.js";

// Enable the manual mock
jest.mock("snowflake-sdk");

// Mock the logger
jest.mock("../../../src/utils/index.js", () => ({
  createComponentLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe("SnowflakeClient", () => {
  let client: SnowflakeClient;
  let config: SnowflakeConfig;

  beforeEach(() => {
    config = {
      account: "test-account",
      username: "test-user",
      password: "test-password",
      database: "test-db",
      schema: "test-schema",
      warehouse: "test-warehouse",
      role: "test-role",
      authenticator: "snowflake",
    };

    client = new SnowflakeClient(config);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create client with provided config", () => {
      expect(client).toBeInstanceOf(SnowflakeClient);
      expect(client.isConnected()).toBe(false);
    });
  });

  describe("connect", () => {
    it("should successfully connect with password authentication", async () => {
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });

      await client.connect();

      expect(mockCreateConnection).toHaveBeenCalledWith({
        account: "test-account",
        username: "test-user",
        password: "test-password",
        database: "test-db",
        schema: "test-schema",
        warehouse: "test-warehouse",
        role: "test-role",
        authenticator: "snowflake",
        clientSessionKeepAlive: true,
        clientSessionKeepAliveHeartbeatFrequency: 3600,
        jsTreatIntegerAsBigInt: false,
      });

      expect(mockConnection.connect).toHaveBeenCalled();
      expect(client.isConnected()).toBe(true);
    });

    it("should successfully connect with external browser authentication", async () => {
      const externalBrowserConfig = {
        ...config,
        authenticator: "externalbrowser" as const,
        password: undefined,
      };

      client = new SnowflakeClient(externalBrowserConfig);

      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });

      await client.connect();

      expect(mockCreateConnection).toHaveBeenCalledWith({
        account: "test-account",
        username: "test-user",
        database: "test-db",
        schema: "test-schema",
        warehouse: "test-warehouse",
        role: "test-role",
        authenticator: "externalbrowser",
        clientSessionKeepAlive: true,
        clientSessionKeepAliveHeartbeatFrequency: 3600,
        jsTreatIntegerAsBigInt: false,
      });

      expect(client.isConnected()).toBe(true);
    });

    it("should handle connection errors", async () => {
      const connectionError = new Error("Connection failed");

      // Create a new client for this test to avoid mock interference
      const errorClient = new SnowflakeClient(config);

      // Mock the createConnection to return a connection that fails
      const mockErrorConnection = {
        ...mockConnection,
        connect: jest.fn(callback => {
          setTimeout(() => callback(connectionError, null), 0);
        }),
      };
      mockCreateConnection.mockReturnValueOnce(mockErrorConnection);

      await expect(errorClient.connect()).rejects.toThrow("Snowflake connection failed: Connection failed");
      expect(errorClient.isConnected()).toBe(false);
    });

    it("should skip connect if already connected", async () => {
      // First connection
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });

      await client.connect();
      expect(mockConnection.connect).toHaveBeenCalledTimes(1);

      // Second connection attempt should be skipped
      await client.connect();
      expect(mockConnection.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe("execute", () => {
    beforeEach(async () => {
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });
      await client.connect();
    });

    it("should successfully execute SQL query", async () => {
      const mockRows = [
        { id: 1, name: "John" },
        { id: 2, name: "Jane" },
      ];

      const mockStatement = {
        getColumns: jest.fn().mockReturnValue([
          {
            getName: () => "id",
            getType: () => "NUMBER",
            isNullable: () => false,
          },
          {
            getName: () => "name",
            getType: () => "VARCHAR",
            isNullable: () => true,
          },
        ]),
      };

      mockConnection.execute.mockImplementation(({ complete }) => {
        complete(null, mockStatement, mockRows);
      });

      const result = await client.execute("SELECT * FROM users");

      expect(mockConnection.execute).toHaveBeenCalledWith({
        sqlText: "SELECT * FROM users",
        asyncExec: false,
        complete: expect.any(Function),
      });

      expect(result).toEqual({
        rows: mockRows,
        rowCount: 2,
        columns: [
          { name: "id", type: "NUMBER", nullable: false },
          { name: "name", type: "VARCHAR", nullable: true },
        ],
      });
    });

    it("should handle SQL execution errors", async () => {
      const sqlError = new Error("SQL syntax error");
      mockConnection.execute.mockImplementation(({ complete }) => {
        complete(sqlError, null, null);
      });

      await expect(client.execute("INVALID SQL")).rejects.toThrow("SQL execution failed: SQL syntax error");
    });

    it("should handle empty result sets", async () => {
      const mockStatement = {
        getColumns: jest.fn().mockReturnValue([]),
      };

      mockConnection.execute.mockImplementation(({ complete }) => {
        complete(null, mockStatement, []);
      });

      const result = await client.execute("SELECT * FROM empty_table");

      expect(result).toEqual({
        rows: [],
        rowCount: 0,
        columns: [],
      });
    });

    it("should handle missing column metadata gracefully", async () => {
      const mockRows = [{ id: 1 }];
      const mockStatement = {}; // No getColumns method

      mockConnection.execute.mockImplementation(({ complete }) => {
        complete(null, mockStatement, mockRows);
      });

      const result = await client.execute("SELECT id FROM users");

      expect(result).toEqual({
        rows: mockRows,
        rowCount: 1,
        columns: [],
      });
    });

    it("should throw error when connection fails", async () => {
      const disconnectedClient = new SnowflakeClient(config);

      // Mock the createConnection to return a connection that fails
      const mockErrorConnection = {
        ...mockConnection,
        connect: jest.fn(callback => {
          setTimeout(() => callback(new Error("Connection failed"), null), 0);
        }),
      };
      mockCreateConnection.mockReturnValueOnce(mockErrorConnection);

      await expect(disconnectedClient.execute("SELECT 1")).rejects.toThrow("Snowflake connection failed: Connection failed");
    }, 15000); // Increase timeout to 15 seconds
  });

  describe("disconnect", () => {
    it("should successfully disconnect", async () => {
      // First connect
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });
      await client.connect();

      // Then disconnect
      mockConnection.destroy.mockImplementation(callback => {
        callback(null);
      });

      await client.disconnect();

      expect(mockConnection.destroy).toHaveBeenCalled();
      expect(client.isConnected()).toBe(false);
    });

    it("should handle disconnect errors", async () => {
      // First connect
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });
      await client.connect();

      // Then disconnect with error
      const disconnectError = new Error("Disconnect failed");
      mockConnection.destroy.mockImplementation(callback => {
        callback(disconnectError);
      });

      await expect(client.disconnect()).rejects.toThrow("Disconnect failed: Disconnect failed");
      expect(client.isConnected()).toBe(false); // Should still reset connection
    });

    it("should handle disconnect when not connected", async () => {
      await expect(client.disconnect()).resolves.toBeUndefined();
      expect(mockConnection.destroy).not.toHaveBeenCalled();
    });
  });

  describe("isConnected", () => {
    it("should return false when not connected", () => {
      expect(client.isConnected()).toBe(false);
    });

    it("should return true when connected", async () => {
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it("should return false after disconnect", async () => {
      // Connect first
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });
      await client.connect();
      expect(client.isConnected()).toBe(true);

      // Then disconnect
      mockConnection.destroy.mockImplementation(callback => {
        callback(null);
      });
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });
});
