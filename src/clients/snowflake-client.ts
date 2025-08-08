/**
 * Snowflake client for database connection and query execution
 */

import snowflake from "snowflake-sdk";
import type { SnowflakeConfig, ColumnMetadata } from "../types/index.js";
import { createComponentLogger } from "../utils/index.js";

export interface QueryResult {
  rows: Record<string, any>[];
  rowCount: number;
  columns: ColumnMetadata[];
}

export interface QueryOptions {
  timeout?: number; // Query timeout in milliseconds
  priority?: "low" | "normal" | "high";
}

export class SnowflakeClient {
  private connection: snowflake.Connection | null = null;
  private readonly config: SnowflakeConfig;
  private readonly logger = createComponentLogger("SnowflakeClient");
  private connectionPromise: Promise<void> | null = null;
  private isConnecting = false;
  private lastUsed = Date.now();
  private readonly defaultTimeout = 30000; // 30 seconds default timeout
  private activeQueries = new Set<string>();

  constructor(config: SnowflakeConfig) {
    this.config = config;
  }

  /**
   * Establishes connection to Snowflake database with connection reuse
   */
  async connect(): Promise<void> {
    // If already connected and connection is fresh, reuse it
    if (this.connection && this.isConnectionHealthy()) {
      this.logger.debug("Reusing existing healthy connection");
      this.lastUsed = Date.now();
      return;
    }

    // If already connecting, wait for the existing connection attempt
    if (this.isConnecting && this.connectionPromise) {
      this.logger.debug("Connection attempt in progress, waiting...");
      return this.connectionPromise;
    }

    // Start new connection
    this.isConnecting = true;
    this.connectionPromise = this.establishConnection();

    try {
      await this.connectionPromise;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  /**
   * Internal method to establish the actual connection
   */
  private async establishConnection(): Promise<void> {
    try {
      this.logger.info("Connecting to Snowflake", {
        operation: "connect",
        account: this.config.account,
        username: this.config.username,
        database: this.config.database,
        authenticator: this.config.authenticator,
      });

      const connectionOptions: snowflake.ConnectionOptions = {
        account: this.config.account,
        username: this.config.username,
        database: this.config.database,
        schema: this.config.schema,
        warehouse: this.config.warehouse,
        role: this.config.role,
        authenticator: this.config.authenticator,
        // Performance optimizations
        clientSessionKeepAlive: true,
        clientSessionKeepAliveHeartbeatFrequency: 3600, // 1 hour
        jsTreatIntegerAsBigInt: false, // Better performance for most use cases
      };

      // Add password only for snowflake authenticator
      if (this.config.authenticator === "snowflake" && this.config.password) {
        connectionOptions.password = this.config.password;
      }

      this.connection = snowflake.createConnection(connectionOptions);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout after 10 seconds"));
        }, 10000);

        this.connection!.connect((err, conn) => {
          clearTimeout(timeout);

          if (err) {
            this.logger.error("Failed to connect to Snowflake", err, {
              operation: "connect",
              account: this.config.account,
              username: this.config.username,
            });
            reject(new Error(`Snowflake connection failed: ${err.message}`));
          } else {
            this.lastUsed = Date.now();
            this.logger.info("Successfully connected to Snowflake", {
              operation: "connect",
              connectionId: conn.getId(),
            });
            resolve();
          }
        });
      });
    } catch (error) {
      this.connection = null;
      throw error;
    }
  }

  /**
   * Check if the current connection is healthy and can be reused
   */
  private isConnectionHealthy(): boolean {
    if (!this.connection) {
      return false;
    }

    // Consider connection stale after 30 minutes of inactivity
    const maxIdleTime = 30 * 60 * 1000; // 30 minutes
    const timeSinceLastUse = Date.now() - this.lastUsed;

    if (timeSinceLastUse > maxIdleTime) {
      this.logger.debug("Connection considered stale due to inactivity", {
        timeSinceLastUse,
        maxIdleTime,
      });
      return false;
    }

    return true;
  }

  /**
   * Executes SQL query against Snowflake with timeout and concurrency support
   */
  async execute(sql: string, options: QueryOptions = {}): Promise<QueryResult> {
    // Ensure connection is established
    await this.connect();

    if (!this.connection) {
      throw new Error("Failed to establish connection to Snowflake");
    }

    const queryId = this.generateQueryId();
    const timeout = options.timeout || this.defaultTimeout;
    const startTime = Date.now();

    try {
      this.activeQueries.add(queryId);
      this.lastUsed = Date.now();

      this.logger.debug("Executing SQL query", {
        operation: "execute",
        queryId,
        sqlLength: sql.length,
        timeout,
        activeQueries: this.activeQueries.size,
      });

      const result = await Promise.race([this.executeQuery(sql, queryId), this.createTimeoutPromise(timeout, queryId)]);

      const executionTime = Date.now() - startTime;
      const rows = result.rows || [];
      const columns = this.extractColumnMetadata(result.stmt);

      this.logger.info("SQL query executed successfully", {
        operation: "execute",
        queryId,
        rowCount: rows.length,
        executionTime,
        activeQueries: this.activeQueries.size - 1,
      });

      return {
        rows,
        rowCount: rows.length,
        columns,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error("SQL execution error", error as Error, {
        operation: "execute",
        queryId,
        executionTime,
        activeQueries: this.activeQueries.size - 1,
      });
      throw error;
    } finally {
      this.activeQueries.delete(queryId);
    }
  }

  /**
   * Execute query with proper async handling
   */
  private async executeQuery(sql: string, queryId: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.connection!.execute({
        sqlText: sql,
        asyncExec: false, // Keep synchronous for better error handling
        complete: (err, stmt, rows) => {
          if (err) {
            this.logger.error("SQL execution failed", err, {
              operation: "executeQuery",
              queryId,
              sqlLength: sql.length,
            });
            reject(new Error(`SQL execution failed: ${err.message}`));
          } else {
            resolve({ stmt, rows });
          }
        },
      });
    });
  }

  /**
   * Create a timeout promise that rejects after the specified time
   */
  private createTimeoutPromise(timeout: number, queryId: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        this.logger.error("Query execution timeout", new Error("Query timeout"), {
          operation: "executeQuery",
          queryId,
          timeout,
        });
        reject(new Error(`Query execution timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Generate a unique query ID for tracking
   */
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Closes the connection to Snowflake
   */
  async disconnect(): Promise<void> {
    if (!this.connection) {
      this.logger.debug("No connection to disconnect");
      return;
    }

    try {
      this.logger.info("Disconnecting from Snowflake", {
        operation: "disconnect",
      });

      await new Promise<void>((resolve, reject) => {
        this.connection!.destroy(err => {
          if (err) {
            this.logger.error("Error during disconnect", err, {
              operation: "disconnect",
            });
            reject(new Error(`Disconnect failed: ${err.message}`));
          } else {
            this.logger.info("Successfully disconnected from Snowflake", {
              operation: "disconnect",
            });
            resolve();
          }
        });
      });
    } finally {
      this.connection = null;
    }
  }

  /**
   * Checks if the client is connected and healthy
   */
  isConnected(): boolean {
    return this.connection !== null && this.isConnectionHealthy();
  }

  /**
   * Get connection statistics for monitoring
   */
  getConnectionStats(): {
    isConnected: boolean;
    isConnecting: boolean;
    activeQueries: number;
    lastUsed: number;
    timeSinceLastUse: number;
  } {
    return {
      isConnected: this.isConnected(),
      isConnecting: this.isConnecting,
      activeQueries: this.activeQueries.size,
      lastUsed: this.lastUsed,
      timeSinceLastUse: Date.now() - this.lastUsed,
    };
  }

  /**
   * Force reconnection (useful for connection recovery)
   */
  async reconnect(): Promise<void> {
    this.logger.info("Forcing reconnection to Snowflake");

    // Close existing connection
    if (this.connection) {
      try {
        await this.disconnect();
      } catch (error) {
        this.logger.warn("Error during disconnect before reconnect", error as Error);
      }
    }

    // Establish new connection
    await this.connect();
  }

  /**
   * Extracts column metadata from statement result
   */
  private extractColumnMetadata(stmt: any): ColumnMetadata[] {
    if (!stmt || !stmt.getColumns) {
      return [];
    }

    try {
      const columns = stmt.getColumns();
      return columns.map((col: any) => ({
        name: col.getName(),
        type: col.getType(),
        nullable: col.isNullable(),
      }));
    } catch (error) {
      this.logger.error("Failed to extract column metadata", error as Error, {
        operation: "extractColumnMetadata",
      });
      return [];
    }
  }
}
