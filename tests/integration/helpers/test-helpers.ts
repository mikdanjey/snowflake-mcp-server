/**
 * Test helper utilities for integration tests
 */

import { jest } from "@jest/globals";
import type { SnowflakeConfig } from "../../../src/types/config.js";

/**
 * Create a mock Snowflake configuration for testing
 */
export function createMockSnowflakeConfig(overrides: Partial<SnowflakeConfig> = {}): SnowflakeConfig {
  return {
    account: "test-account",
    username: "test-user",
    password: "test-password",
    database: "test-db",
    schema: "test-schema",
    warehouse: "test-warehouse",
    role: "test-role",
    authenticator: "snowflake",
    ...overrides,
  };
}

/**
 * Setup environment variables for testing
 */
export function setupTestEnvironment(config: Partial<SnowflakeConfig> = {}): void {
  const fullConfig = createMockSnowflakeConfig(config);

  process.env.SNOWFLAKE_ACCOUNT = fullConfig.account;
  process.env.SNOWFLAKE_USER = fullConfig.username;
  if (fullConfig.password) {
    process.env.SNOWFLAKE_PASSWORD = fullConfig.password;
  }
  process.env.SNOWFLAKE_DATABASE = fullConfig.database;
  process.env.SNOWFLAKE_SCHEMA = fullConfig.schema;
  process.env.SNOWFLAKE_WAREHOUSE = fullConfig.warehouse;
  process.env.SNOWFLAKE_ROLE = fullConfig.role;
  if (fullConfig.authenticator) {
    process.env.SNOWFLAKE_AUTHENTICATOR = fullConfig.authenticator;
  }
}

/**
 * Clean up environment variables after testing
 */
export function cleanupTestEnvironment(): void {
  delete process.env.SNOWFLAKE_ACCOUNT;
  delete process.env.SNOWFLAKE_USER;
  delete process.env.SNOWFLAKE_PASSWORD;
  delete process.env.SNOWFLAKE_DATABASE;
  delete process.env.SNOWFLAKE_SCHEMA;
  delete process.env.SNOWFLAKE_WAREHOUSE;
  delete process.env.SNOWFLAKE_ROLE;
  delete process.env.SNOWFLAKE_AUTHENTICATOR;
}

/**
 * Create mock query results for different query types
 */
export const mockQueryResults = {
  users: {
    rows: [
      {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        created_at: "2023-01-01T00:00:00Z",
      },
      {
        id: 2,
        name: "Jane Smith",
        email: "jane@example.com",
        created_at: "2023-01-02T00:00:00Z",
      },
      {
        id: 3,
        name: "Bob Johnson",
        email: "bob@example.com",
        created_at: "2023-01-03T00:00:00Z",
      },
    ],
    rowCount: 3,
    columns: [
      { name: "id", type: "NUMBER", nullable: false },
      { name: "name", type: "VARCHAR", nullable: false },
      { name: "email", type: "VARCHAR", nullable: true },
      { name: "created_at", type: "TIMESTAMP_NTZ", nullable: false },
    ],
  },

  showTables: {
    rows: [
      {
        name: "users",
        kind: "TABLE",
        database_name: "test-db",
        schema_name: "test-schema",
      },
      {
        name: "orders",
        kind: "TABLE",
        database_name: "test-db",
        schema_name: "test-schema",
      },
      {
        name: "products",
        kind: "TABLE",
        database_name: "test-db",
        schema_name: "test-schema",
      },
    ],
    rowCount: 3,
    columns: [
      { name: "name", type: "VARCHAR", nullable: false },
      { name: "kind", type: "VARCHAR", nullable: false },
      { name: "database_name", type: "VARCHAR", nullable: false },
      { name: "schema_name", type: "VARCHAR", nullable: false },
    ],
  },

  describeTable: {
    rows: [
      {
        name: "id",
        type: "NUMBER(38,0)",
        kind: "COLUMN",
        null: "N",
        default: null,
        primary_key: "Y",
      },
      {
        name: "name",
        type: "VARCHAR(255)",
        kind: "COLUMN",
        null: "N",
        default: null,
        primary_key: "N",
      },
      {
        name: "email",
        type: "VARCHAR(255)",
        kind: "COLUMN",
        null: "Y",
        default: null,
        primary_key: "N",
      },
      {
        name: "created_at",
        type: "TIMESTAMP_NTZ(9)",
        kind: "COLUMN",
        null: "N",
        default: "CURRENT_TIMESTAMP()",
        primary_key: "N",
      },
    ],
    rowCount: 4,
    columns: [
      { name: "name", type: "VARCHAR", nullable: false },
      { name: "type", type: "VARCHAR", nullable: false },
      { name: "kind", type: "VARCHAR", nullable: false },
      { name: "null", type: "VARCHAR", nullable: false },
      { name: "default", type: "VARCHAR", nullable: true },
      { name: "primary_key", type: "VARCHAR", nullable: false },
    ],
  },

  count: {
    rows: [{ count: 1500 }],
    rowCount: 1,
    columns: [{ name: "count", type: "NUMBER", nullable: false }],
  },

  analytics: {
    rows: [
      { department: "Engineering", avg_salary: 85000, employee_count: 25 },
      { department: "Sales", avg_salary: 65000, employee_count: 30 },
      { department: "Marketing", avg_salary: 70000, employee_count: 15 },
    ],
    rowCount: 3,
    columns: [
      { name: "department", type: "VARCHAR", nullable: false },
      { name: "avg_salary", type: "NUMBER", nullable: false },
      { name: "employee_count", type: "NUMBER", nullable: false },
    ],
  },

  empty: {
    rows: [],
    rowCount: 0,
    columns: [
      { name: "id", type: "NUMBER", nullable: false },
      { name: "name", type: "VARCHAR", nullable: false },
    ],
  },
};

/**
 * Create mock errors for different error scenarios
 */
export const mockErrors = {
  syntaxError: new Error("SQL compilation error: syntax error line 1 at position 7 unexpected 'FORM'"),
  tableNotFound: new Error("Object 'NONEXISTENT_TABLE' does not exist"),
  connectionError: new Error("Network is unreachable"),
  authenticationError: new Error("Incorrect username or password was specified"),
  timeoutError: new Error("Query execution timeout after 30000ms"),
  permissionError: new Error("Insufficient privileges to operate on table 'RESTRICTED_TABLE'"),
  accountNotFound: new Error("Account 'INVALID_ACCOUNT' not found"),
  userNotFound: new Error("User 'INVALID_USER' does not exist"),
  roleError: new Error("Role 'INVALID_ROLE' does not exist or not authorized"),
  warehouseError: new Error("Warehouse 'INVALID_WAREHOUSE' does not exist or not authorized"),
  browserAuthTimeout: new Error("Browser authentication timed out after 120 seconds"),
  browserNotAvailable: new Error("No web browser found for external browser authentication"),
};

/**
 * Wait for a specified amount of time (for testing async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock process.exit function for testing
 */
export function createMockExitProcess(): jest.Mock {
  return jest.fn();
}

/**
 * Measure execution time of an async function
 */
export async function measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; executionTime: number }> {
  const startTime = Date.now();
  const result = await fn();
  const executionTime = Date.now() - startTime;
  return { result, executionTime };
}

/**
 * Create a mock MCP request for testing
 */
export function createMockMCPRequest(sql: string, additionalParams: Record<string, any> = {}) {
  return {
    params: {
      name: "snowflake_query",
      arguments: {
        sql,
        ...additionalParams,
      },
    },
  };
}

/**
 * Create a mock MCP resource request
 */
export function createMockResourceRequest(uri: string = "snowflake://query") {
  return {
    params: {
      uri,
    },
  };
}

/**
 * Validate MCP response format
 */
export function validateMCPResponse(response: any): boolean {
  if (response.error) {
    return typeof response.error === "object" && typeof response.error.code === "string" && typeof response.error.message === "string";
  }

  return Array.isArray(response.rows) && typeof response.rowCount === "number" && typeof response.executionTime === "number";
}

/**
 * Generate large dataset for performance testing
 */
export function generateLargeDataset(size: number) {
  return {
    rows: Array.from({ length: size }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      created_at: new Date(2023, 0, 1 + (i % 365)).toISOString(),
    })),
    rowCount: size,
    columns: [
      { name: "id", type: "NUMBER", nullable: false },
      { name: "name", type: "VARCHAR", nullable: false },
      { name: "email", type: "VARCHAR", nullable: true },
      { name: "created_at", type: "TIMESTAMP_NTZ", nullable: false },
    ],
  };
}

/**
 * Test utilities for concurrent operations
 */
export class ConcurrencyTestHelper {
  private operations: Promise<any>[] = [];

  add<T>(operation: () => Promise<T>): void {
    this.operations.push(operation());
  }

  async executeAll(): Promise<any[]> {
    return Promise.all(this.operations);
  }

  async executeAllSettled(): Promise<PromiseSettledResult<any>[]> {
    return Promise.allSettled(this.operations);
  }

  clear(): void {
    this.operations = [];
  }

  get count(): number {
    return this.operations.length;
  }
}

/**
 * Performance test helper
 */
export class PerformanceTestHelper {
  private measurements: number[] = [];

  async measure<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const result = await operation();
    const endTime = Date.now();
    this.measurements.push(endTime - startTime);
    return result;
  }

  getAverageTime(): number {
    if (this.measurements.length === 0) return 0;
    return this.measurements.reduce((sum, time) => sum + time, 0) / this.measurements.length;
  }

  getMinTime(): number {
    return Math.min(...this.measurements);
  }

  getMaxTime(): number {
    return Math.max(...this.measurements);
  }

  getMeasurements(): number[] {
    return [...this.measurements];
  }

  clear(): void {
    this.measurements = [];
  }

  get count(): number {
    return this.measurements.length;
  }
}

/**
 * Custom Jest matchers for integration tests
 */
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
      toHaveExecutionTime(min: number, max: number): R;
    }
  }
}

// Add custom matchers
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(", ")}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(", ")}`,
        pass: false,
      };
    }
  },

  toHaveExecutionTime(received: any, min: number, max: number) {
    const executionTime = received.executionTime;
    const pass = typeof executionTime === "number" && executionTime >= min && executionTime <= max;

    if (pass) {
      return {
        message: () => `expected execution time ${executionTime}ms not to be between ${min}ms and ${max}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected execution time ${executionTime}ms to be between ${min}ms and ${max}ms`,
        pass: false,
      };
    }
  },
});
