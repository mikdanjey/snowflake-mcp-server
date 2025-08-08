# Snowflake MCP Server Usage Guide

## Application Entry Point

The Snowflake MCP Server provides a main application entry point at `src/main.ts` that orchestrates the complete startup sequence.

### Startup Sequence

The application follows this startup sequence:

1. **Configuration Loading**: Load and validate environment variables
2. **Snowflake Client Initialization**: Create and connect to Snowflake
3. **MCP Server Setup**: Initialize MCP server with resource handlers
4. **Server Start**: Begin listening for MCP protocol messages
5. **Graceful Shutdown**: Handle shutdown signals and cleanup resources

### Environment Variables

The following environment variables are required:

```bash
# Snowflake Connection
SNOWFLAKE_ACCOUNT=your-account-name
SNOWFLAKE_USER=your-username
SNOWFLAKE_DATABASE=your-database
SNOWFLAKE_SCHEMA=your-schema
SNOWFLAKE_WAREHOUSE=your-warehouse
SNOWFLAKE_ROLE=your-role

# Authentication (choose one)
SNOWFLAKE_PASSWORD=your-password              # For password auth
SNOWFLAKE_AUTHENTICATOR=externalbrowser       # For browser auth

# Optional Configuration
LOG_LEVEL=info                                # debug, info, warn, error
```

### Running the Server

#### Development Mode

```bash
npm run dev
```

#### Production Mode

```bash
npm run build
npm start
```

#### Direct Execution

```bash
node dist/main.js
```

### Startup Performance

The server is optimized to start in under 1 second:

- Component creation: ~3ms
- Configuration loading: ~1ms
- Total startup time: < 1000ms (requirement)

### Error Handling

The application implements comprehensive error handling:

#### Configuration Errors

```
Configuration validation failed: snowflake.account: SNOWFLAKE_ACCOUNT is required
```

#### Connection Errors

```
Snowflake connection failed: Invalid credentials
```

#### Startup Errors

```
Failed to start Snowflake MCP Server: Server initialization failed
```

### Graceful Shutdown

The application handles the following shutdown signals:

- `SIGINT` (Ctrl+C)
- `SIGTERM` (Process termination)
- `SIGQUIT` (Quit signal)

Shutdown sequence:

1. Stop accepting new requests
2. Stop MCP server
3. Disconnect from Snowflake
4. Exit process

### Logging

The application provides structured logging with the following levels:

- `debug`: Detailed debugging information
- `info`: General operational messages
- `warn`: Warning conditions
- `error`: Error conditions

Log format:

```
[2025-08-05T07:33:13.117Z] INFO: Server started successfully | Context: {"component":"Application","startupTimeMs":245}
```

### Health Monitoring

Monitor the following for application health:

1. **Startup Time**: Should be < 1000ms
2. **Memory Usage**: Should remain stable
3. **Connection Status**: Snowflake connection should remain active
4. **Error Rates**: Should be minimal under normal operation

### Troubleshooting

#### Common Issues

1. **Configuration Errors**
   - Verify all required environment variables are set
   - Check authenticator type matches credentials provided

2. **Connection Failures**
   - Verify Snowflake credentials are correct
   - Check network connectivity to Snowflake
   - Ensure warehouse and role have proper permissions

3. **Startup Timeout**
   - Check Snowflake connection latency
   - Verify system resources are available
   - Review logs for specific error messages

#### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
LOG_LEVEL=debug npm start
```

This will provide detailed information about:

- Configuration loading process
- Connection establishment steps
- MCP protocol message handling
- Query execution details

### Integration with LLM Agents

The server communicates over STDIO using the MCP protocol. LLM agents can:

1. List available resources: `snowflake://query`
2. Execute SQL queries through the `snowflake_query` tool
3. Receive structured JSON responses with query results

Example MCP tool call:

```json
{
  "name": "snowflake_query",
  "arguments": {
    "sql": "SELECT COUNT(*) FROM users WHERE active = true"
  }
}
```

Example response:

```json
{
  "rows": [{ "COUNT(*)": 1250 }],
  "rowCount": 1,
  "executionTime": 145,
  "metadata": {
    "columns": [{ "name": "COUNT(*)", "type": "NUMBER", "nullable": false }]
  }
}
```
