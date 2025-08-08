/**
 * Connection pool utility for managing multiple Snowflake connections
 * Provides connection reuse and load balancing for better performance
 */

import { SnowflakeClient } from "../clients/snowflake-client.js";
import type { SnowflakeConfig } from "../types/index.js";
import { createComponentLogger } from "./logger.js";

export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  acquireTimeout: number;
}

export interface PooledConnection {
  client: SnowflakeClient;
  id: string;
  createdAt: number;
  lastUsed: number;
  inUse: boolean;
}

export class ConnectionPool {
  private readonly config: SnowflakeConfig;
  private readonly poolConfig: ConnectionPoolConfig;
  private readonly connections: Map<string, PooledConnection> = new Map();
  private readonly waitingQueue: Array<{
    resolve: (client: SnowflakeClient) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private readonly logger = createComponentLogger("ConnectionPool");
  private isShuttingDown = false;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: SnowflakeConfig, poolConfig: Partial<ConnectionPoolConfig> = {}) {
    this.config = config;
    this.poolConfig = {
      maxConnections: poolConfig.maxConnections || 10,
      minConnections: poolConfig.minConnections || 2,
      connectionTimeout: poolConfig.connectionTimeout || 30000,
      idleTimeout: poolConfig.idleTimeout || 300000, // 5 minutes
      acquireTimeout: poolConfig.acquireTimeout || 10000,
    };

    this.startCleanupTimer();
  }

  /**
   * Initialize the connection pool with minimum connections
   */
  async initialize(): Promise<void> {
    this.logger.info("Initializing connection pool", {
      minConnections: this.poolConfig.minConnections,
      maxConnections: this.poolConfig.maxConnections,
    });

    const initPromises: Promise<void>[] = [];

    for (let i = 0; i < this.poolConfig.minConnections; i++) {
      initPromises.push(
        this.createConnection()
          .then(() => {}) // Convert PooledConnection to void
          .catch(error => {
            this.logger.warn("Failed to create initial connection", error as Error);
          }),
      );
    }

    await Promise.allSettled(initPromises);

    this.logger.info("Connection pool initialized", {
      activeConnections: this.connections.size,
    });
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<SnowflakeClient> {
    if (this.isShuttingDown) {
      throw new Error("Connection pool is shutting down");
    }

    // Try to find an available connection
    const availableConnection = this.findAvailableConnection();
    if (availableConnection) {
      availableConnection.inUse = true;
      availableConnection.lastUsed = Date.now();

      this.logger.debug("Acquired existing connection", {
        connectionId: availableConnection.id,
        totalConnections: this.connections.size,
      });

      return availableConnection.client;
    }

    // Create new connection if under limit
    if (this.connections.size < this.poolConfig.maxConnections) {
      try {
        const connection = await this.createConnection();
        connection.inUse = true;

        this.logger.debug("Created and acquired new connection", {
          connectionId: connection.id,
          totalConnections: this.connections.size,
        });

        return connection.client;
      } catch (error) {
        this.logger.error("Failed to create new connection", error as Error);
        // Fall through to wait for available connection
      }
    }

    // Wait for an available connection
    return this.waitForConnection();
  }

  /**
   * Release a connection back to the pool
   */
  async release(client: SnowflakeClient): Promise<void> {
    const connection = this.findConnectionByClient(client);
    if (!connection) {
      this.logger.warn("Attempted to release unknown connection");
      return;
    }

    connection.inUse = false;
    connection.lastUsed = Date.now();

    this.logger.debug("Released connection", {
      connectionId: connection.id,
      availableConnections: this.getAvailableConnectionCount(),
    });

    // Process waiting queue
    this.processWaitingQueue();
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalConnections: number;
    availableConnections: number;
    inUseConnections: number;
    waitingRequests: number;
    oldestConnection: number;
    newestConnection: number;
  } {
    const now = Date.now();
    const connectionAges = Array.from(this.connections.values()).map(conn => now - conn.createdAt);

    return {
      totalConnections: this.connections.size,
      availableConnections: this.getAvailableConnectionCount(),
      inUseConnections: this.getInUseConnectionCount(),
      waitingRequests: this.waitingQueue.length,
      oldestConnection: connectionAges.length > 0 ? Math.max(...connectionAges) : 0,
      newestConnection: connectionAges.length > 0 ? Math.min(...connectionAges) : 0,
    };
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down connection pool");
    this.isShuttingDown = true;

    // Clear cleanup timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Reject all waiting requests
    while (this.waitingQueue.length > 0) {
      const request = this.waitingQueue.shift()!;
      request.reject(new Error("Connection pool is shutting down"));
    }

    // Close all connections
    const closePromises = Array.from(this.connections.values()).map(async connection => {
      try {
        await connection.client.disconnect();
      } catch (error) {
        this.logger.warn("Error closing connection during shutdown", error as Error);
      }
    });

    await Promise.allSettled(closePromises);
    this.connections.clear();

    this.logger.info("Connection pool shutdown complete");
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<PooledConnection> {
    const connectionId = this.generateConnectionId();
    const client = new SnowflakeClient(this.config);

    try {
      await client.connect();

      const connection: PooledConnection = {
        client,
        id: connectionId,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        inUse: false,
      };

      this.connections.set(connectionId, connection);

      this.logger.debug("Created new connection", {
        connectionId,
        totalConnections: this.connections.size,
      });

      return connection;
    } catch (error) {
      this.logger.error("Failed to create connection", error as Error, {
        connectionId,
      });
      throw error;
    }
  }

  /**
   * Find an available connection
   */
  private findAvailableConnection(): PooledConnection | null {
    for (const connection of this.connections.values()) {
      if (!connection.inUse && connection.client.isConnected()) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Find connection by client instance
   */
  private findConnectionByClient(client: SnowflakeClient): PooledConnection | null {
    for (const connection of this.connections.values()) {
      if (connection.client === client) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Wait for an available connection
   */
  private async waitForConnection(): Promise<SnowflakeClient> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error(`Connection acquire timeout after ${this.poolConfig.acquireTimeout}ms`));
      }, this.poolConfig.acquireTimeout);

      this.waitingQueue.push({
        resolve: client => {
          clearTimeout(timeout);
          resolve(client);
        },
        reject: error => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Process waiting queue when connections become available
   */
  private processWaitingQueue(): void {
    while (this.waitingQueue.length > 0) {
      const availableConnection = this.findAvailableConnection();
      if (!availableConnection) {
        break;
      }

      const request = this.waitingQueue.shift()!;
      availableConnection.inUse = true;
      availableConnection.lastUsed = Date.now();

      request.resolve(availableConnection.client);
    }
  }

  /**
   * Get count of available connections
   */
  private getAvailableConnectionCount(): number {
    return Array.from(this.connections.values()).filter(conn => !conn.inUse && conn.client.isConnected()).length;
  }

  /**
   * Get count of in-use connections
   */
  private getInUseConnectionCount(): number {
    return Array.from(this.connections.values()).filter(conn => conn.inUse).length;
  }

  /**
   * Start cleanup timer for idle connections
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Run every minute
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    const now = Date.now();
    const connectionsToClose: PooledConnection[] = [];

    for (const connection of this.connections.values()) {
      const idleTime = now - connection.lastUsed;
      const shouldClose = !connection.inUse && idleTime > this.poolConfig.idleTimeout && this.connections.size > this.poolConfig.minConnections;

      if (shouldClose) {
        connectionsToClose.push(connection);
      }
    }

    for (const connection of connectionsToClose) {
      try {
        await connection.client.disconnect();
        this.connections.delete(connection.id);

        this.logger.debug("Closed idle connection", {
          connectionId: connection.id,
          idleTime: now - connection.lastUsed,
          remainingConnections: this.connections.size,
        });
      } catch (error) {
        this.logger.warn("Error closing idle connection", error as Error);
      }
    }
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
