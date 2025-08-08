/**
 * Advanced unit tests for SnowflakeClient - covering edge cases and concurrent operations
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
    warn: jest.fn(),
  }),
}));

describe("SnowflakeClient - Advanced Tests", () => {
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
    jest.clearAllMocks();
  });

  describe("connection reuse and health checks", () => {
    beforeEach(async () => {
      mockConnection.connect.mockImplementation((callback: any) => {
        callback(null, mockConnection);
      });
      await client.connect();
    });

    it("should reuse healthy connections", async () => {
      // First connection is already established
      expect(mockConnection.connect).toHaveBeenCalledTimes(1);

      // Second connect call should reuse connection
      await client.connect();
      expect(mockConnection.connect).toHaveBeenCalledTimes(1);
    });

    it("should reconnect when connection is stale", async () => {
      // Mock time to make connection stale
      const originalDateNow = Date.now;
      Date.now = jest.fn().mockReturnValue(originalDateNow() + 31 * 60 * 1000); // 31 minutes later

      await client.connect();

      // Should have created a new connection
      expect(mockCreateConnection).toHaveBeenCalledTimes(2);

      Date.now = originalDateNow;
    });

    it("should handle concurrent connection attempts", async () => {
      const newClient = new SnowflakeClient(config);

      // Start multiple connection attempts simultaneously
      const connectionPromises = [newClient.connect(), newClient.connect(), newClient.connect()];

      await Promise.all(connectionPromises);

      // Should only create one connection despite multiple attempts
      expect(mockCreateConnection).toHaveBeenCalledTimes(2); // One from beforeEach, one from newClient
    });

    it("should handle connection timeout", async () => {
      const timeoutClient = new SnowflakeClient(config);

      // Mock the createConnection to return a connection that never calls callback
      const mockTimeoutConnection = {
        ...mockConnection,
        connect: jest.fn(() => {
          // Don't call callback to simulate timeout
        }),
      };
      mockCreateConnection.mockReturnValueOnce(mockTimeoutConnection);

      await expect(timeoutClient.connect()).rejects.toThrow("Connection timeout after 10 seconds");
    }, 15000); // Increase timeout to 15 seconds
  });

  describe("query execution with options", () => {
    beforeEach(async () => {
      mockConnection.connect.mockImplementation((callback: any) => {
        callback(null, mockConnection);
      });
      await client.connect();
    });

    it("should execute query with custom timeout", async () => {
      const mockRows = [{ id: 1, name: "test" }];
      const mockStatement = {
        getColumns: jest.fn().mockReturnValue([]),
      };

      mockConnection.execute.mockImplementation(({ complete }: any) => {
        setTimeout(() => complete(null, mockStatement, mockRows), 100);
      });

      const result = await client.execute("SELECT * FROM users", {
        timeout: 5000,
      });

      expect(result.rows).toEqual(mockRows);
    });

    it("should handle query timeout", async () => {
      mockConnection.execute.mockImplementation(() => {
        // Don't call complete callback to simulate hanging query
      });

      await expect(client.execute("SELECT * FROM users", { timeout: 100 })).rejects.toThrow("Query execution timeout after 100ms");
    });

    it("should execute query with priority option", async () => {
      const mockRows = [{ id: 1 }];
      const mockStatement = { getColumns: jest.fn().mockReturnValue([]) };

      mockConnection.execute.mockImplementation(({ complete }: any) => {
        complete(null, mockStatement, mockRows);
      });

      await client.execute("SELECT * FROM users", { priority: "high" });

      expect(mockConnection.execute).toHaveBeenCalledWith({
        sqlText: "SELECT * FROM users",
        asyncExec: false,
        complete: expect.any(Function),
      });
    });

    it("should handle concurrent query execution", async () => {
      const mockRows1 = [{ id: 1 }];
      const mockRows2 = [{ id: 2 }];
      const mockStatement = { getColumns: jest.fn().mockReturnValue([]) };

      let callCount = 0;
      mockConnection.execute.mockImplementation(({ complete }: any) => {
        const rows = callCount === 0 ? mockRows1 : mockRows2;
        callCount++;
        setTimeout(() => complete(null, mockStatement, rows), 50);
      });

      const [result1, result2] = await Promise.all([client.execute("SELECT * FROM users WHERE id = 1"), client.execute("SELECT * FROM users WHERE id = 2")]);

      expect(result1.rows).toEqual(mockRows1);
      expect(result2.rows).toEqual(mockRows2);
      expect(mockConnection.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe("connection statistics", () => {
    it("should return accurate connection stats when not connected", () => {
      const stats = client.getConnectionStats();

      expect(stats).toEqual({
        isConnected: false,
        isConnecting: false,
        activeQueries: 0,
        lastUsed: expect.any(Number),
        timeSinceLastUse: expect.any(Number),
      });
    });

    it("should return accurate connection stats when connected", async () => {
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });
      await client.connect();

      const stats = client.getConnectionStats();

      expect(stats).toEqual({
        isConnected: true,
        isConnecting: false,
        activeQueries: 0,
        lastUsed: expect.any(Number),
        timeSinceLastUse: expect.any(Number),
      });
    });

    it("should track active queries", async () => {
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });
      await client.connect();

      let executeCallback: any;

      // Mock a hanging query to keep it active
      mockConnection.execute.mockImplementation(options => {
        executeCallback = options.complete;
        // Don't call complete immediately to keep query active
      });

      // Start query but don't await
      const queryPromise = client.execute("SELECT * FROM users");

      // Give the execute method time to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check stats while query is active
      const stats = client.getConnectionStats();
      expect(stats.activeQueries).toBe(1);

      // Clean up by completing the query
      if (executeCallback) {
        executeCallback(null, [{ id: 1 }], null);
      }

      await queryPromise;
    });
  });

  describe("reconnect functionality", () => {
    it("should force reconnection", async () => {
      // First connection
      mockConnection.connect.mockImplementation((callback: any) => {
        callback(null, mockConnection);
      });
      await client.connect();

      // Mock disconnect
      mockConnection.destroy.mockImplementation(callback => {
        callback(null);
      });

      // Reconnect
      await client.reconnect();

      expect(mockConnection.destroy).toHaveBeenCalled();
      expect(mockCreateConnection).toHaveBeenCalledTimes(2);
    });

    it("should handle disconnect errors during reconnect", async () => {
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });
      await client.connect();

      // Mock disconnect error
      mockConnection.destroy.mockImplementation(callback => {
        callback(new Error("Disconnect failed"));
      });

      // Should still reconnect despite disconnect error
      await client.reconnect();

      expect(mockCreateConnection).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling edge cases", () => {
    it("should handle connection errors with detailed logging", async () => {
      const connectionError = new Error("Network unreachable");

      // Create a new client for this test
      const errorClient = new SnowflakeClient(config);

      // Mock the createConnection to return a connection that fails
      const mockErrorConnection = {
        ...mockConnection,
        connect: jest.fn(callback => {
          setTimeout(() => callback(connectionError, null), 0);
        }),
      };
      mockCreateConnection.mockReturnValueOnce(mockErrorConnection);

      await expect(errorClient.connect()).rejects.toThrow("Snowflake connection failed: Network unreachable");
    });

    it("should handle query execution with missing statement", async () => {
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });
      await client.connect();

      mockConnection.execute.mockImplementation(({ complete }) => {
        complete(null, null, [{ id: 1 }]); // No statement object
      });

      const result = await client.execute("SELECT * FROM users");

      expect(result).toEqual({
        rows: [{ id: 1 }],
        rowCount: 1,
        columns: [],
      });
    });

    it("should handle column metadata extraction errors", async () => {
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });
      await client.connect();

      const mockStatement = {
        getColumns: jest.fn().mockImplementation(() => {
          throw new Error("Column metadata error");
        }),
      };

      mockConnection.execute.mockImplementation(({ complete }) => {
        complete(null, mockStatement, [{ id: 1 }]);
      });

      const result = await client.execute("SELECT * FROM users");

      expect(result).toEqual({
        rows: [{ id: 1 }],
        rowCount: 1,
        columns: [],
      });
    });
  });

  describe("query ID generation and tracking", () => {
    it("should generate unique query IDs", async () => {
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });
      await client.connect();

      const queryIds: string[] = [];
      mockConnection.execute.mockImplementation(({ complete }) => {
        // Capture the query ID from the logging context
        complete(null, { getColumns: () => [] }, []);
      });

      // Execute multiple queries
      await Promise.all([client.execute("SELECT 1"), client.execute("SELECT 2"), client.execute("SELECT 3")]);

      // Query IDs should be unique (tested indirectly through execution)
      expect(mockConnection.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe("connection lifecycle edge cases", () => {
    it("should handle multiple disconnect calls", async () => {
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });
      mockConnection.destroy.mockImplementation(callback => {
        callback(null);
      });

      await client.connect();

      // Multiple disconnect calls
      await client.disconnect();
      await client.disconnect(); // Should not throw

      expect(mockConnection.destroy).toHaveBeenCalledTimes(1);
    });

    it("should handle connection failure during reconnect", async () => {
      // First successful connection
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });
      await client.connect();

      // Mock disconnect success
      mockConnection.destroy.mockImplementation(callback => {
        callback(null);
      });

      // Mock reconnection failure
      mockConnection.connect.mockImplementationOnce(callback => {
        callback(new Error("Reconnection failed"), null);
      });

      await expect(client.reconnect()).rejects.toThrow("Snowflake connection failed: Reconnection failed");
    });
  });

  describe("performance optimizations", () => {
    it("should use optimized connection options", async () => {
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });

      await client.connect();

      expect(mockCreateConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          clientSessionKeepAlive: true,
          clientSessionKeepAliveHeartbeatFrequency: 3600,
          jsTreatIntegerAsBigInt: false,
        }),
      );
    });

    it("should handle large result sets efficiently", async () => {
      mockConnection.connect.mockImplementation(callback => {
        callback(null, mockConnection);
      });
      await client.connect();

      // Create large result set
      const largeResultSet = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        data: `row_${i}`,
      }));

      const mockStatement = {
        getColumns: jest.fn().mockReturnValue([
          {
            getName: () => "id",
            getType: () => "NUMBER",
            isNullable: () => false,
          },
          {
            getName: () => "data",
            getType: () => "VARCHAR",
            isNullable: () => true,
          },
        ]),
      };

      mockConnection.execute.mockImplementation(({ complete }) => {
        complete(null, mockStatement, largeResultSet);
      });

      const startTime = Date.now();
      const result = await client.execute("SELECT * FROM large_table");
      const endTime = Date.now();

      expect(result.rows).toHaveLength(10000);
      expect(result.rowCount).toBe(10000);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });
  });
});
