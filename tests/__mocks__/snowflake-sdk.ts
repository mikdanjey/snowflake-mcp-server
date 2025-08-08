/**
 * Enhanced mock for snowflake-sdk with comprehensive test support
 */

import { jest } from "@jest/globals";

// Mock connection object with all required methods
export const mockConnection = {
  connect: jest.fn(),
  execute: jest.fn(),
  destroy: jest.fn(),
  getId: jest.fn().mockReturnValue("test-connection-id"),
  isUp: jest.fn().mockReturnValue(true),
  isValidAsync: jest.fn().mockResolvedValue(true),
  getConnectionId: jest.fn().mockReturnValue("test-connection-id"),
  getClientSessionKeepAlive: jest.fn().mockReturnValue(true),
  getClientSessionKeepAliveHeartbeatFrequency: jest.fn().mockReturnValue(3600),
  getServiceName: jest.fn().mockReturnValue("snowflake"),
  getClientInfo: jest.fn().mockReturnValue({
    version: "1.0.0",
    environment: "test",
  }),
  configure: jest.fn(),
  connectAsync: jest.fn(),
  executeAsync: jest.fn(),
  fetchResult: jest.fn(),
  getRows: jest.fn(),
  getColumns: jest.fn(),
  getResultSet: jest.fn(),
  cancel: jest.fn(),
  isStillRunning: jest.fn().mockReturnValue(false),
  getStatementId: jest.fn().mockReturnValue("test-statement-id"),
  getSqlText: jest.fn(),
  getStatus: jest.fn().mockReturnValue("SUCCESS"),
  getNumRows: jest.fn().mockReturnValue(0),
  getNumDuplicateRows: jest.fn().mockReturnValue(0),
  getNumUpdatedRows: jest.fn().mockReturnValue(0),
  getNumDeletedRows: jest.fn().mockReturnValue(0),
  requestId: "test-request-id",
};

// Mock statement object for query execution
export const mockStatement = {
  execute: jest.fn(),
  cancel: jest.fn(),
  getColumns: jest.fn().mockReturnValue([]),
  getNumRows: jest.fn().mockReturnValue(0),
  getRows: jest.fn().mockReturnValue([]),
  getRequestId: jest.fn().mockReturnValue("test-request-id"),
  getStatementId: jest.fn().mockReturnValue("test-statement-id"),
  getSqlText: jest.fn(),
  getStatus: jest.fn().mockReturnValue("SUCCESS"),
  isStillRunning: jest.fn().mockReturnValue(false),
  streamRows: jest.fn(),
};

// Mock result set for query results
export const mockResultSet = {
  getColumns: jest.fn().mockReturnValue([]),
  getRows: jest.fn().mockReturnValue([]),
  getNumRows: jest.fn().mockReturnValue(0),
  next: jest.fn().mockReturnValue(false),
  getColumnMetadata: jest.fn().mockReturnValue([]),
  getRowCount: jest.fn().mockReturnValue(0),
};

// Enhanced createConnection mock with configuration support
export const mockCreateConnection = jest.fn().mockImplementation(options => {
  // Store connection options for test verification
  mockConnection._options = options;

  // Reset the connect mock to default behavior
  mockConnection.connect.mockImplementation(callback => {
    // Simulate successful connection by default
    setTimeout(() => {
      if (callback) callback(null, mockConnection);
    }, 5);
    return mockConnection;
  });

  // Configure default behaviors based on options
  if (options?.authenticator === "externalbrowser") {
    mockConnection.connect.mockImplementation(callback => {
      // Simulate external browser authentication
      setTimeout(() => {
        if (callback) callback(null, mockConnection);
      }, 10);
      return mockConnection;
    });
  }

  // Configure execute method with realistic behavior
  mockConnection.execute.mockImplementation((options, callback) => {
    const sqlText = options.sqlText || options;

    // Simulate different response types based on SQL
    let mockResult;

    if (typeof sqlText === "string") {
      const sql = sqlText.toUpperCase();

      if (sql.includes("SHOW TABLES")) {
        mockResult = {
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
          ],
          columns: [
            { name: "name", type: "VARCHAR", nullable: false },
            { name: "kind", type: "VARCHAR", nullable: false },
            { name: "database_name", type: "VARCHAR", nullable: false },
            { name: "schema_name", type: "VARCHAR", nullable: false },
          ],
        };
      } else if (sql.includes("DESCRIBE") || sql.includes("DESC ")) {
        mockResult = {
          rows: [
            {
              name: "id",
              type: "NUMBER(38,0)",
              kind: "COLUMN",
              null: "N",
              default: null,
            },
            {
              name: "name",
              type: "VARCHAR(255)",
              kind: "COLUMN",
              null: "N",
              default: null,
            },
            {
              name: "email",
              type: "VARCHAR(255)",
              kind: "COLUMN",
              null: "Y",
              default: null,
            },
          ],
          columns: [
            { name: "name", type: "VARCHAR", nullable: false },
            { name: "type", type: "VARCHAR", nullable: false },
            { name: "kind", type: "VARCHAR", nullable: false },
            { name: "null", type: "VARCHAR", nullable: false },
            { name: "default", type: "VARCHAR", nullable: true },
          ],
        };
      } else if (sql.includes("COUNT(*)")) {
        mockResult = {
          rows: [{ count: 100 }],
          columns: [{ name: "count", type: "NUMBER", nullable: false }],
        };
      } else if (sql.includes("SELECT")) {
        mockResult = {
          rows: [
            { id: 1, name: "John Doe", email: "john@example.com" },
            { id: 2, name: "Jane Smith", email: "jane@example.com" },
          ],
          columns: [
            { name: "id", type: "NUMBER", nullable: false },
            { name: "name", type: "VARCHAR", nullable: false },
            { name: "email", type: "VARCHAR", nullable: true },
          ],
        };
      } else {
        mockResult = {
          rows: [],
          columns: [],
        };
      }
    }

    // Add common result properties
    if (mockResult) {
      mockResult.rowCount = mockResult.rows.length;
      mockResult.statementId = "test-statement-id";
      mockResult.requestId = "test-request-id";
    }

    // Simulate async execution
    setTimeout(() => {
      if (callback) {
        callback(null, mockStatement, mockResult);
      }
    }, 1);

    return mockStatement;
  });

  return mockConnection;
});

// Mock error classes
export class SnowflakeError extends Error {
  constructor(
    message: string,
    public code?: string,
    public sqlState?: string,
  ) {
    super(message);
    this.name = "SnowflakeError";
  }
}

export class OperationalError extends SnowflakeError {
  constructor(message: string, code?: string, sqlState?: string) {
    super(message, code, sqlState);
    this.name = "OperationalError";
  }
}

export class ProgrammingError extends SnowflakeError {
  constructor(message: string, code?: string, sqlState?: string) {
    super(message, code, sqlState);
    this.name = "ProgrammingError";
  }
}

// Mock logging configuration
export const mockLogging = {
  configure: jest.fn(),
  getLogger: jest.fn().mockReturnValue({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
};

// Main export with all mock functionality
export default {
  createConnection: mockCreateConnection,
  Connection: mockConnection,
  Statement: mockStatement,
  ResultSet: mockResultSet,
  Errors: {
    SnowflakeError,
    OperationalError,
    ProgrammingError,
  },
  Logging: mockLogging,
  configure: jest.fn(),

  // Constants that might be used
  STRING: "STRING",
  BOOLEAN: "BOOLEAN",
  NUMBER: "NUMBER",
  DATE: "DATE",
  TIMESTAMP: "TIMESTAMP",
  VARIANT: "VARIANT",
  OBJECT: "OBJECT",
  ARRAY: "ARRAY",
  BINARY: "BINARY",
};
