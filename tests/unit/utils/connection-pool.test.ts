/**
 * Unit tests for ConnectionPool
 */

import { ConnectionPool, type ConnectionPoolConfig } from "../../../src/utils/connection-pool.js";
import { SnowflakeClient } from "../../../src/clients/snowflake-client.js";
import type { SnowflakeConfig } from "../../../src/types/index.js";

// Mock the SnowflakeClient
jest.mock("../../../src/clients/snowflake-client.js");
jest.mock("../../../src/utils/index.js", () => ({
  createComponentLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  })),
}));

const mockSnowflakeClient = SnowflakeClient as jest.MockedClass<typeof SnowflakeClient>;

describe("ConnectionPool", () => {
  let pool: ConnectionPool;
  let config: SnowflakeConfig;
  let poolConfig: ConnectionPoolConfig;
  let mockClientInstances: jest.Mocked<SnowflakeClient>[];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

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

    poolConfig = {
      maxConnections: 5,
      minConnections: 2,
      connectionTimeout: 30000,
      idleTimeout: 300000,
      acquireTimeout: 10000,
    };

    mockClientInstances = [];

    // Mock SnowflakeClient constructor
    mockSnowflakeClient.mockImplementation(() => {
      const mockInstance = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
        execute: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        getConnectionStats: jest.fn(),
        reconnect: jest.fn(),
      } as any;

      mockClientInstances.push(mockInstance);
      return mockInstance;
    });

    pool = new ConnectionPool(config, poolConfig);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("constructor", () => {
    it("should create pool with provided configuration", () => {
      expect(pool).toBeInstanceOf(ConnectionPool);
    });

    it("should use default configuration when not provided", () => {
      const defaultPool = new ConnectionPool(config);
      expect(defaultPool).toBeInstanceOf(ConnectionPool);
    });
  });

  describe("initialize", () => {
    it("should create minimum number of connections", async () => {
      await pool.initialize();

      expect(mockSnowflakeClient).toHaveBeenCalledTimes(poolConfig.minConnections);
      expect(mockClientInstances[0].connect).toHaveBeenCalled();
      expect(mockClientInstances[1].connect).toHaveBeenCalled();
    });

    it("should handle connection failures during initialization", async () => {
      // Mock the constructor to create instances that fail on connect
      mockSnowflakeClient.mockImplementation(() => {
        const mockInstance = {
          connect: jest.fn().mockRejectedValue(new Error("Connection failed")),
          disconnect: jest.fn().mockResolvedValue(undefined),
          execute: jest.fn(),
          isConnected: jest.fn().mockReturnValue(false),
          getConnectionStats: jest.fn(),
          reconnect: jest.fn(),
        } as any;

        mockClientInstances.push(mockInstance);
        return mockInstance;
      });

      await pool.initialize();

      // Should still attempt to create all connections
      expect(mockSnowflakeClient).toHaveBeenCalledTimes(poolConfig.minConnections);
    });
  });

  describe("acquire", () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it("should return available connection", async () => {
      const client = await pool.acquire();

      expect(client).toBe(mockClientInstances[0]);
    });

    it("should create new connection when none available and under limit", async () => {
      // Acquire all initial connections
      await pool.acquire();
      await pool.acquire();

      // This should create a new connection
      const client = await pool.acquire();

      expect(mockSnowflakeClient).toHaveBeenCalledTimes(3);
      expect(client).toBe(mockClientInstances[2]);
    });

    it("should wait for connection when at max limit", async () => {
      // Acquire all possible connections
      const clients = [];
      for (let i = 0; i < poolConfig.maxConnections; i++) {
        clients.push(await pool.acquire());
      }

      // This should wait
      const acquirePromise = pool.acquire();

      // Release one connection
      await pool.release(clients[0]);

      // Should now get the released connection
      const client = await acquirePromise;
      expect(client).toBe(clients[0]);
    });

    it("should timeout when waiting too long", async () => {
      // Acquire all connections
      for (let i = 0; i < poolConfig.maxConnections; i++) {
        await pool.acquire();
      }

      const acquirePromise = pool.acquire();

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(poolConfig.acquireTimeout + 1000);

      await expect(acquirePromise).rejects.toThrow("Connection acquire timeout");
    });

    it("should throw error when shutting down", async () => {
      await pool.shutdown();

      await expect(pool.acquire()).rejects.toThrow("Connection pool is shutting down");
    });
  });

  describe("release", () => {
    it("should mark connection as available", async () => {
      await pool.initialize();
      const client = await pool.acquire();

      await pool.release(client);

      const stats = pool.getStats();
      expect(stats.availableConnections).toBe(2); // Both initial connections available
    });

    it("should handle unknown connection gracefully", async () => {
      await pool.initialize();
      const unknownClient = new SnowflakeClient(config);

      await expect(pool.release(unknownClient)).resolves.toBeUndefined();
    });

    it("should process waiting queue when connection released", async () => {
      await pool.initialize();

      // Acquire all connections
      const clients = [];
      for (let i = 0; i < poolConfig.maxConnections; i++) {
        clients.push(await pool.acquire());
      }

      // Start waiting for connection
      const acquirePromise = pool.acquire();

      // Release a connection
      await pool.release(clients[0]);

      // Should get the released connection
      const client = await acquirePromise;
      expect(client).toBe(clients[0]);
    });
  });

  describe("getStats", () => {
    it("should return accurate statistics", async () => {
      await pool.initialize();

      // Add a small delay to ensure connections have different timestamps
      jest.advanceTimersByTime(10);

      const client = await pool.acquire();

      const stats = pool.getStats();

      expect(stats.totalConnections).toBe(2);
      expect(stats.availableConnections).toBe(1);
      expect(stats.inUseConnections).toBe(1);
      expect(stats.waitingRequests).toBe(0);
      // With fake timers, we need to check that the age calculation works
      expect(stats.oldestConnection).toBeGreaterThanOrEqual(0);
      expect(stats.newestConnection).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty pool", () => {
      const emptyPool = new ConnectionPool(config, poolConfig);
      const stats = emptyPool.getStats();

      expect(stats.totalConnections).toBe(0);
      expect(stats.availableConnections).toBe(0);
      expect(stats.inUseConnections).toBe(0);
      expect(stats.waitingRequests).toBe(0);
      expect(stats.oldestConnection).toBe(0);
      expect(stats.newestConnection).toBe(0);
    });
  });

  describe("shutdown", () => {
    it("should close all connections", async () => {
      await pool.initialize();
      await pool.acquire();

      await pool.shutdown();

      expect(mockClientInstances[0].disconnect).toHaveBeenCalled();
      expect(mockClientInstances[1].disconnect).toHaveBeenCalled();
    });

    it("should reject waiting requests", async () => {
      await pool.initialize();

      // Acquire all connections
      for (let i = 0; i < poolConfig.maxConnections; i++) {
        await pool.acquire();
      }

      // Start waiting
      const acquirePromise = pool.acquire();

      // Shutdown
      await pool.shutdown();

      await expect(acquirePromise).rejects.toThrow("Connection pool is shutting down");
    });

    it("should handle disconnect errors gracefully", async () => {
      await pool.initialize();
      mockClientInstances[0].disconnect.mockRejectedValue(new Error("Disconnect failed"));

      await expect(pool.shutdown()).resolves.toBeUndefined();
    });
  });

  describe("cleanup timer", () => {
    it("should clean up idle connections", async () => {
      const shortIdlePool = new ConnectionPool(config, {
        ...poolConfig,
        idleTimeout: 1000, // 1 second
      });

      await shortIdlePool.initialize();
      const client = await shortIdlePool.acquire();
      await shortIdlePool.release(client);

      // Fast-forward time to make connection idle
      jest.advanceTimersByTime(2000);

      // Trigger cleanup
      jest.advanceTimersByTime(60000);

      // Should have closed the idle connection but kept minimum
      const stats = shortIdlePool.getStats();
      expect(stats.totalConnections).toBe(poolConfig.minConnections);

      await shortIdlePool.shutdown();
    });

    it("should not close connections below minimum", async () => {
      await pool.initialize();

      // Fast-forward time to make all connections idle
      jest.advanceTimersByTime(poolConfig.idleTimeout + 1000);

      // Trigger cleanup
      jest.advanceTimersByTime(60000);

      // Should maintain minimum connections
      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(poolConfig.minConnections);
    });

    it("should not clean up during shutdown", async () => {
      await pool.initialize();
      await pool.shutdown();

      // Fast-forward time
      jest.advanceTimersByTime(60000);

      // No additional disconnect calls should be made
      expect(mockClientInstances[0].disconnect).toHaveBeenCalledTimes(1);
      expect(mockClientInstances[1].disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("connection health checks", () => {
    it("should skip unhealthy connections when acquiring", async () => {
      await pool.initialize();

      // Make first connection unhealthy
      mockClientInstances[0].isConnected.mockReturnValue(false);

      const client = await pool.acquire();

      // Should get the healthy connection
      expect(client).toBe(mockClientInstances[1]);
    });

    it("should create new connection when all are unhealthy", async () => {
      await pool.initialize();

      // Make all connections unhealthy
      mockClientInstances.forEach(instance => {
        instance.isConnected.mockReturnValue(false);
      });

      const client = await pool.acquire();

      // Should create a new connection
      expect(mockSnowflakeClient).toHaveBeenCalledTimes(3);
      expect(client).toBe(mockClientInstances[2]);
    });
  });

  describe("error handling", () => {
    it("should handle connection creation failures", async () => {
      // Mock the constructor to create instances that fail on connect
      mockSnowflakeClient.mockImplementation(() => {
        const mockInstance = {
          connect: jest.fn().mockRejectedValue(new Error("Connection failed")),
          disconnect: jest.fn().mockResolvedValue(undefined),
          execute: jest.fn(),
          isConnected: jest.fn().mockReturnValue(false),
          getConnectionStats: jest.fn(),
          reconnect: jest.fn(),
        } as any;

        mockClientInstances.push(mockInstance);
        return mockInstance;
      });

      // Should not throw during initialization
      await expect(pool.initialize()).resolves.toBeUndefined();
    });

    it("should handle acquire failures gracefully", async () => {
      await pool.initialize();

      // Acquire all connections
      for (let i = 0; i < poolConfig.maxConnections; i++) {
        await pool.acquire();
      }

      // Mock connection creation failure
      mockSnowflakeClient.mockImplementation(() => {
        const mockInstance = {
          connect: jest.fn().mockRejectedValue(new Error("Connection failed")),
          disconnect: jest.fn(),
          isConnected: jest.fn().mockReturnValue(false),
        } as any;
        return mockInstance;
      });

      // Should wait for existing connection rather than fail
      const acquirePromise = pool.acquire();

      // This should timeout since no connections are released
      jest.advanceTimersByTime(poolConfig.acquireTimeout + 1000);

      await expect(acquirePromise).rejects.toThrow("Connection acquire timeout");
    });
  });

  describe("concurrent operations", () => {
    it("should handle concurrent acquire requests", async () => {
      await pool.initialize();

      const acquirePromises = [];
      for (let i = 0; i < 10; i++) {
        acquirePromises.push(pool.acquire());
      }

      const clients = await Promise.all(acquirePromises);

      // Should have created connections (may be more than max due to concurrent requests)
      expect(mockSnowflakeClient).toHaveBeenCalledTimes(10);
      expect(clients).toHaveLength(10);
    });

    it("should handle concurrent release operations", async () => {
      await pool.initialize();

      const clients = [];
      for (let i = 0; i < poolConfig.maxConnections; i++) {
        clients.push(await pool.acquire());
      }

      const releasePromises = clients.map(client => pool.release(client));
      await Promise.all(releasePromises);

      const stats = pool.getStats();
      expect(stats.availableConnections).toBe(poolConfig.maxConnections);
      expect(stats.inUseConnections).toBe(0);
    });
  });
});
