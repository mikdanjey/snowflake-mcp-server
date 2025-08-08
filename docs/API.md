# API Documentation

## Overview

The Snowflake MCP Server provides a Model Context Protocol (MCP) compliant interface for executing SQL queries against Snowflake databases. This document describes all public interfaces, data structures, and usage patterns.

## Core Interfaces

### QueryRequest

The input interface for SQL query requests.

```typescript
interface QueryRequest {
  sql: string; // The SQL query to execute (required, non-empty)
}
```

**Validation Rules:**

- `sql` must be a non-empty string
- SQL is validated for basic syntax and safety
- Supports SELECT, SHOW, DESCRIBE, and other read operations

**Example:**

```json
{
  "sql": "SELECT * FROM DEMO.PUBLIC.CUSTOMERS LIMIT 10"
}
```

### QueryResponse

The response interface for successful query execution.

```typescript
interface QueryResponse {
  rows: Record<string, any>[]; // Array of result rows
  rowCount: number; // Total number of rows returned
  executionTime: number; // Query execution time in milliseconds
  metadata?: {
    // Optional metadata about the result
    columns: ColumnMetadata[];
  };
}
```

**Field Descriptions:**

- `rows`: Array of objects where each object represents a row with column names as keys
- `rowCount`: Number of rows in the result set
- `executionTime`: Time taken to execute the query (excludes validation and formatting time)
- `metadata.columns`: Information about each column in the result set

**Example:**

```json
{
  "rows": [
    {
      "CUSTOMER_ID": 1,
      "CUSTOMER_NAME": "John Doe",
      "EMAIL": "john@example.com",
      "CREATED_DATE": "2024-01-15T10:30:00.000Z"
    },
    {
      "CUSTOMER_ID": 2,
      "CUSTOMER_NAME": "Jane Smith",
      "EMAIL": "jane@example.com",
      "CREATED_DATE": "2024-01-16T14:22:00.000Z"
    }
  ],
  "rowCount": 2,
  "executionTime": 245,
  "metadata": {
    "columns": [
      {
        "name": "CUSTOMER_ID",
        "type": "NUMBER",
        "nullable": false
      },
      {
        "name": "CUSTOMER_NAME",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "EMAIL",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "CREATED_DATE",
        "type": "TIMESTAMP_NTZ",
        "nullable": true
      }
    ]
  }
}
```

### ColumnMetadata

Describes the structure and properties of result set columns.

```typescript
interface ColumnMetadata {
  name: string; // Column name as returned by Snowflake
  type: string; // Snowflake data type (e.g., VARCHAR, NUMBER, TIMESTAMP_NTZ)
  nullable: boolean; // Whether the column allows NULL values
}
```

**Common Snowflake Data Types:**

- `VARCHAR` - Variable-length string
- `NUMBER` - Numeric values (integers and decimals)
- `BOOLEAN` - True/false values
- `DATE` - Date values
- `TIMESTAMP_NTZ` - Timestamp without timezone
- `TIMESTAMP_TZ` - Timestamp with timezone
- `VARIANT` - Semi-structured data (JSON, XML, etc.)
- `ARRAY` - Array data type
- `OBJECT` - Object/map data type

### ErrorResponse

The response interface for failed operations.

```typescript
interface ErrorResponse {
  error: {
    code: string; // Error category identifier
    message: string; // Human-readable error description
    details?: Record<string, any>; // Additional context and debugging information
  };
}
```

**Error Codes:**

| Code               | Description                | Common Causes                                          |
| ------------------ | -------------------------- | ------------------------------------------------------ |
| `VALIDATION_ERROR` | Input validation failed    | Empty SQL, invalid characters, unsupported operations  |
| `CONNECTION_ERROR` | Database connection issues | Invalid credentials, network problems, account issues  |
| `EXECUTION_ERROR`  | SQL execution failed       | Syntax errors, permission issues, resource constraints |
| `CONFIG_ERROR`     | Configuration problems     | Missing environment variables, invalid settings        |
| `INTERNAL_ERROR`   | Unexpected server errors   | System failures, resource exhaustion                   |

**Example Error Responses:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "SQL query cannot be empty",
    "details": {
      "field": "sql",
      "value": "",
      "issues": ["String must contain at least 1 character(s)"]
    }
  }
}
```

```json
{
  "error": {
    "code": "EXECUTION_ERROR",
    "message": "SQL compilation error: Object 'NONEXISTENT_TABLE' does not exist",
    "details": {
      "sql": "SELECT * FROM NONEXISTENT_TABLE",
      "snowflakeError": "Object 'NONEXISTENT_TABLE' does not exist or not authorized",
      "executionTime": 156
    }
  }
}
```

## MCP Resource Definition

The server exposes a single MCP resource for query execution:

### Resource: `snowflake.query`

**URI:** `snowflake://query`
**Name:** Snowflake Query
**Description:** Execute SQL queries against Snowflake database
**MIME Type:** `application/json`

**Schema:**

```json
{
  "type": "object",
  "properties": {
    "sql": {
      "type": "string",
      "description": "The SQL query to run on Snowflake",
      "minLength": 1
    }
  },
  "required": ["sql"],
  "additionalProperties": false
}
```

## Configuration Interfaces

### SnowflakeConfig

Configuration for Snowflake database connection.

```typescript
interface SnowflakeConfig {
  account: string; // Snowflake account identifier
  username: string; // Database username
  password?: string; // Password (required for password auth)
  database: string; // Target database name
  schema: string; // Target schema name
  warehouse: string; // Compute warehouse name
  role: string; // Role to assume
  authenticator: "snowflake" | "externalbrowser"; // Authentication method
}
```

### EnvironmentConfig

Complete server configuration loaded from environment variables.

```typescript
interface EnvironmentConfig {
  snowflake: SnowflakeConfig;
  server: {
    logLevel: string; // Logging level: debug, info, warn, error
  };
}
```

## Usage Examples

### Basic Query Execution

```typescript
import { MCPClient } from "@modelcontextprotocol/client";

const client = new MCPClient();
await client.connect();

// Execute a simple SELECT query
const response = await client.callResource("snowflake.query", {
  sql: "SELECT COUNT(*) as TOTAL_CUSTOMERS FROM DEMO.PUBLIC.CUSTOMERS",
});

console.log(`Total customers: ${response.rows[0].TOTAL_CUSTOMERS}`);
```

### Error Handling

```typescript
try {
  const response = await client.callResource("snowflake.query", {
    sql: "SELECT * FROM INVALID_TABLE",
  });
  console.log(response.rows);
} catch (error) {
  if (error.code === "EXECUTION_ERROR") {
    console.error("SQL execution failed:", error.message);
    console.error("Details:", error.details);
  } else {
    console.error("Unexpected error:", error);
  }
}
```

### Complex Query with Metadata

```typescript
const response = await client.callResource("snowflake.query", {
  sql: `
    SELECT 
      c.CUSTOMER_ID,
      c.CUSTOMER_NAME,
      COUNT(o.ORDER_ID) as ORDER_COUNT,
      SUM(o.ORDER_AMOUNT) as TOTAL_SPENT
    FROM DEMO.PUBLIC.CUSTOMERS c
    LEFT JOIN DEMO.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID
    WHERE c.CREATED_DATE >= '2024-01-01'
    GROUP BY c.CUSTOMER_ID, c.CUSTOMER_NAME
    ORDER BY TOTAL_SPENT DESC
    LIMIT 10
  `,
});

// Access result data
response.rows.forEach(row => {
  console.log(`${row.CUSTOMER_NAME}: ${row.ORDER_COUNT} orders, $${row.TOTAL_SPENT} total`);
});

// Access column metadata
response.metadata?.columns.forEach(col => {
  console.log(`Column ${col.name}: ${col.type} (nullable: ${col.nullable})`);
});

console.log(`Query executed in ${response.executionTime}ms`);
```

### Information Schema Queries

```typescript
// Get table information
const tablesResponse = await client.callResource("snowflake.query", {
  sql: "SHOW TABLES IN SCHEMA DEMO.PUBLIC",
});

// Get column information
const columnsResponse = await client.callResource("snowflake.query", {
  sql: "DESCRIBE TABLE DEMO.PUBLIC.CUSTOMERS",
});

// Get database information
const dbResponse = await client.callResource("snowflake.query", {
  sql: "SHOW DATABASES",
});
```

## Performance Considerations

### Query Complexity and Timeouts

The server automatically categorizes queries by complexity and applies appropriate timeouts:

- **Low Complexity** (15s timeout): Simple SELECT, SHOW, DESCRIBE queries
- **Medium Complexity** (1m timeout): Queries with JOINs or UNIONs
- **High Complexity** (5m timeout): Complex analytical queries with window functions, recursion, or multiple JOINs

### Concurrent Request Handling

The server handles multiple concurrent requests asynchronously. Each request is processed independently without blocking others.

### Connection Management

The server maintains persistent connections to Snowflake and includes connection pooling for optimal performance.

## Security and Validation

### SQL Validation

All SQL input is validated using Zod schemas to ensure:

- Non-empty SQL strings
- Basic syntax validation
- Prevention of common injection patterns

### Sensitive Data Protection

The server automatically filters sensitive information from logs:

- Passwords and authentication tokens
- Personal identifiable information (when detected)
- Connection strings and credentials

### Error Information

Error responses include sufficient detail for debugging while avoiding exposure of sensitive system information.

## Limitations

### Supported SQL Operations

The server primarily supports read operations:

- `SELECT` statements
- `SHOW` commands
- `DESCRIBE` commands
- `EXPLAIN` statements

### Data Type Handling

- All Snowflake data types are supported in results
- Complex types (VARIANT, ARRAY, OBJECT) are returned as JSON
- Date/time values are returned in ISO 8601 format
- Large numbers maintain precision using string representation when necessary

### Result Set Limits

- No built-in row limits (controlled by your SQL LIMIT clause)
- Large result sets are streamed efficiently
- Memory usage is optimized for typical analytical workloads

## Migration and Compatibility

### MCP Protocol Version

This server is compatible with MCP protocol version 1.0 and uses `@modelcontextprotocol/sdk` version 1.17.1.

### Snowflake SDK Version

Built with `snowflake-sdk` version 2.1.3, supporting all current Snowflake features and authentication methods.

### Node.js Compatibility

Requires Node.js 20.0.0 or higher for optimal performance and security.
