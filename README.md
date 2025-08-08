# Snowflake MCP Server

A Model Context Protocol (MCP) server that enables LLM agents to securely connect to and query Snowflake databases. This server acts as a bridge between natural language processing agents and Snowflake's data warehouse, allowing for seamless SQL execution through structured input/output over STDIO.

## Features

- **MCP Protocol Compliance**: Full compatibility with the Model Context Protocol specification
- **Secure Authentication**: Support for both password and external browser (SSO) authentication
- **SQL Validation**: Comprehensive input validation and sanitization using Zod schemas
- **Error Handling**: Robust error handling with detailed diagnostic information
- **Performance Optimized**: Async query execution with connection pooling and timeout management
- **Comprehensive Logging**: Structured logging with configurable levels
- **TypeScript**: Full TypeScript support with comprehensive type definitions

## Quick Start

### Prerequisites

- Node.js 20.0.0 or higher
- Access to a Snowflake account
- Valid Snowflake credentials

## Usage

### Basic MCP Integration

The server exposes a `snowflake.query` resource that accepts SQL queries and returns structured results. Here's how to integrate it with an MCP client:

```json
{
  "mcpServers": {
    "snowflake-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "snowflake-mcp-server"
      ],
      "env": {
        "SNOWFLAKE_ACCOUNT": "NLTFXXX-KB70000",
        "SNOWFLAKE_USER": "MIKDANJEY",
        "SNOWFLAKE_DATABASE": "DEMO",
        "SNOWFLAKE_SCHEMA": "PUBLIC",
        "SNOWFLAKE_WAREHOUSE": "COMPUTE_WH",
        "SNOWFLAKE_ROLE": "SYSADMIN",
        "SNOWFLAKE_AUTHENTICATOR": "snowflake",
        "SNOWFLAKE_PASSWORD": "HZtJXuz6Efq2MNC",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Installation

1. **Clone and install dependencies:**

```bash
git clone https://github.com/mikdanjey/snowflake-mcp-server.git
cd snowflake-mcp-server
npm install
```

2. **Configure environment variables:**

```bash
cp .env.example .env
```

Edit `.env` with your Snowflake credentials (see [Environment Variables](#environment-variables) section for details).

3. **Build the project:**

```bash
npm run build
```

4. **Run the server:**

```bash
npm start
```

The server will start and listen for MCP protocol messages over STDIO.

### Command Line Usage

You can also run the server directly from the command line:

```bash
# Run in development mode with hot reload
npm run dev

# Run with custom log level
LOG_LEVEL=debug npm start

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Docker Usage

Build and run using Docker:

```bash
# Build Docker image
npm run docker:build

# Run container
npm run docker:run

# Or use docker-compose
npm run docker:compose:up
```

## Environment Variables

The server requires several environment variables for Snowflake connection. Copy `.env.example` to `.env` and configure:

### Required Variables

| Variable              | Description                       | Example           |
| --------------------- | --------------------------------- | ----------------- |
| `SNOWFLAKE_ACCOUNT`   | Your Snowflake account identifier | `NLTFXXX-KB70000` |
| `SNOWFLAKE_USER`      | Snowflake username                | `MIKDANJEY`       |
| `SNOWFLAKE_DATABASE`  | Target database name              | `DEMO`            |
| `SNOWFLAKE_SCHEMA`    | Target schema name                | `PUBLIC`          |
| `SNOWFLAKE_WAREHOUSE` | Compute warehouse to use          | `COMPUTE_WH`      |
| `SNOWFLAKE_ROLE`      | Role to assume                    | `SYSADMIN`        |

### Authentication Variables

Choose one authentication method:

**Password Authentication (default):**

```bash
SNOWFLAKE_AUTHENTICATOR=snowflake
SNOWFLAKE_PASSWORD=your_password_here
```

**External Browser Authentication (SSO):**

```bash
SNOWFLAKE_AUTHENTICATOR=externalbrowser
# SNOWFLAKE_PASSWORD not required for SSO
```

### Optional Variables

| Variable    | Description       | Default | Options                          |
| ----------- | ----------------- | ------- | -------------------------------- |
| `LOG_LEVEL` | Logging verbosity | `info`  | `debug`, `info`, `warn`, `error` |

## API Documentation

### Resource: `snowflake.query`

Execute SQL queries against your Snowflake database.

#### Request Format

```typescript
interface QueryRequest {
  sql: string; // The SQL query to execute
}
```

#### Response Format

**Success Response:**

```typescript
interface QueryResponse {
  rows: Record<string, any>[]; // Query result rows
  rowCount: number; // Number of rows returned
  executionTime: number; // Query execution time in milliseconds
  metadata?: {
    columns: ColumnMetadata[]; // Column information
  };
}

interface ColumnMetadata {
  name: string; // Column name
  type: string; // Snowflake data type
  nullable: boolean; // Whether column allows NULL values
}
```

**Error Response:**

```typescript
interface ErrorResponse {
  error: {
    code: string; // Error category code
    message: string; // Human-readable error message
    details?: Record<string, any>; // Additional error context
  };
}
```

#### Error Codes

| Code               | Description                                |
| ------------------ | ------------------------------------------ |
| `VALIDATION_ERROR` | Invalid SQL input or schema violation      |
| `CONNECTION_ERROR` | Snowflake authentication or network issues |
| `EXECUTION_ERROR`  | SQL syntax errors or runtime failures      |
| `CONFIG_ERROR`     | Missing or invalid environment variables   |
| `INTERNAL_ERROR`   | Unexpected server errors                   |

## Example Queries

### Basic SELECT Query

```sql
SELECT * FROM DEMO.PUBLIC.CUSTOMERS LIMIT 10;
```

**Expected Response:**

```json
{
  "rows": [
    {
      "CUSTOMER_ID": 1,
      "CUSTOMER_NAME": "John Doe",
      "EMAIL": "john@example.com"
    }
  ],
  "rowCount": 10,
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
      }
    ]
  }
}
```

### Database Information Queries

```sql
-- Show available databases
SHOW DATABASES;

-- Describe table structure
DESCRIBE TABLE DEMO.PUBLIC.CUSTOMERS;

-- Show table information
SHOW TABLES IN SCHEMA DEMO.PUBLIC;
```

### Complex Analytical Queries

```sql
-- Aggregation with grouping
SELECT
  REGION,
  COUNT(*) as CUSTOMER_COUNT,
  AVG(ORDER_AMOUNT) as AVG_ORDER_AMOUNT
FROM DEMO.PUBLIC.CUSTOMERS c
JOIN DEMO.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID
WHERE ORDER_DATE >= '2024-01-01'
GROUP BY REGION
ORDER BY CUSTOMER_COUNT DESC;
```

## Development

### Available Scripts

| Script                     | Description                             |
| -------------------------- | --------------------------------------- |
| `npm run dev`              | Run in development mode with hot reload |
| `npm run build`            | Build for production                    |
| `npm run build:watch`      | Build in watch mode                     |
| `npm start`                | Start the built server                  |
| `npm test`                 | Run all tests                           |
| `npm run test:watch`       | Run tests in watch mode                 |
| `npm run test:coverage`    | Run tests with coverage report          |
| `npm run test:unit`        | Run only unit tests                     |
| `npm run test:integration` | Run only integration tests              |
| `npm run lint`             | Run ESLint                              |
| `npm run lint:fix`         | Fix ESLint issues automatically         |
| `npm run format`           | Format code with Prettier               |
| `npm run typecheck`        | Run TypeScript type checking            |
| `npm run validate`         | Run all validation checks               |

### Project Structure

```
src/
├── clients/           # Snowflake client implementation
├── handlers/          # MCP resource handlers
├── server/           # MCP server core
├── types/            # TypeScript type definitions
├── utils/            # Utility functions and helpers
├── validators/       # Input validation logic
├── application.ts    # Main application class
├── index.ts         # Public API exports
└── main.ts          # CLI entry point
tests/
├── unit/            # Unit tests
├── integration/     # Integration tests
├── performance/     # Performance tests
└── fixtures/        # Test data and mocks
```

### Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:performance

# Run tests in watch mode
npm run test:watch
```

## Troubleshooting

### Common Issues

#### Connection Issues

**Problem:** `CONNECTION_ERROR: Failed to connect to Snowflake`

**Solutions:**

1. Verify your Snowflake account identifier is correct
2. Check that your username and password are valid
3. Ensure your IP address is whitelisted in Snowflake
4. For SSO users, make sure `SNOWFLAKE_AUTHENTICATOR=externalbrowser`

**Problem:** `CONFIG_ERROR: Missing required environment variable`

**Solutions:**

1. Ensure all required environment variables are set in `.env`
2. Check that `.env` file is in the project root directory
3. Verify environment variable names match exactly (case-sensitive)

#### Query Execution Issues

**Problem:** `EXECUTION_ERROR: SQL compilation error`

**Solutions:**

1. Verify your SQL syntax is correct
2. Check that referenced tables and columns exist
3. Ensure you have proper permissions for the query
4. Verify the database, schema, and warehouse are accessible

**Problem:** `VALIDATION_ERROR: Invalid SQL input`

**Solutions:**

1. Ensure the SQL query is not empty
2. Check for unsupported SQL operations
3. Verify the query structure matches expected format

#### Performance Issues

**Problem:** Queries timing out or running slowly

**Solutions:**

1. Check your warehouse size and scaling policy
2. Optimize your SQL queries (add indexes, limit results)
3. Consider breaking complex queries into smaller parts
4. Monitor Snowflake query history for performance insights

#### Authentication Issues

**Problem:** External browser authentication not working

**Solutions:**

1. Ensure `SNOWFLAKE_AUTHENTICATOR=externalbrowser`
2. Don't set `SNOWFLAKE_PASSWORD` when using SSO
3. Check that your organization allows external browser authentication
4. Verify your browser can access Snowflake login pages

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
LOG_LEVEL=debug npm start
```

This will provide detailed logs including:

- Connection attempts and status
- Query validation steps
- Execution timing and performance metrics
- Error stack traces and context

### Getting Help

1. **Check the logs**: Enable debug logging to see detailed error information
2. **Verify configuration**: Double-check all environment variables
3. **Test connection**: Use Snowflake's web interface to verify credentials
4. **Review permissions**: Ensure your user has necessary database permissions
5. **Check network**: Verify network connectivity to Snowflake

### Performance Monitoring

Monitor server performance using the built-in metrics:

```bash
# Enable performance logging
LOG_LEVEL=debug npm start

# Run performance tests
npm run test:performance
```

Key metrics to monitor:

- Query execution time
- Connection establishment time
- Memory usage
- Concurrent request handling

## Security Considerations

- **Environment Variables**: Never commit `.env` files to version control
- **Credentials**: Use strong passwords and rotate them regularly
- **Network**: Restrict network access to Snowflake using IP whitelisting
- **Permissions**: Follow principle of least privilege for database roles
- **Logging**: Sensitive data is automatically filtered from logs

## Documentation

### Core Documentation

- **[API Documentation](docs/API.md)** - Complete API reference with interfaces and examples
- **[Configuration Guide](docs/CONFIGURATION.md)** - Comprehensive configuration and environment setup
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Query Examples](docs/EXAMPLES.md)** - SQL query examples with expected responses

### Quick Links

- [Environment Variables](#environment-variables) - Configuration reference
- [Example Queries](#example-queries) - Basic usage examples
- [Troubleshooting](#troubleshooting) - Common issues and solutions
- [Development](#development) - Development workflow and testing

## License

MIT License - see LICENSE file for details.
