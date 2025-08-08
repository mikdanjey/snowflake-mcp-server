# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Snowflake MCP Server.

## Quick Diagnostics

### Enable Debug Logging

First, enable debug logging to get detailed information about what's happening:

```bash
LOG_LEVEL=debug npm start
```

### Check Server Status

Verify the server starts correctly:

```bash
npm start
```

Look for these startup messages:

- ✅ `Configuration loaded successfully`
- ✅ `Connected to Snowflake successfully`
- ✅ `MCP server started and listening`

## Common Issues

### 1. Connection Issues

#### Problem: `CONNECTION_ERROR: Failed to connect to Snowflake`

**Symptoms:**

- Server fails to start
- Error message mentions authentication failure
- Connection timeout errors

**Diagnostic Steps:**

1. **Verify Account Identifier:**

   ```bash
   # Check your account identifier format
   echo $SNOWFLAKE_ACCOUNT
   ```

   Should be in format: `ORGNAME-ACCOUNTNAME` or legacy format like `AB12345.us-east-1`

2. **Test Credentials:**

   ```bash
   # Try connecting with Snowflake CLI or web interface
   # using the same credentials
   ```

3. **Check Network Connectivity:**
   ```bash
   # Test if you can reach Snowflake
   ping your-account.snowflakecomputing.com
   ```

**Solutions:**

| Issue                      | Solution                                                        |
| -------------------------- | --------------------------------------------------------------- |
| Invalid account identifier | Get correct identifier from Snowflake web UI → Admin → Accounts |
| Wrong username/password    | Verify credentials in Snowflake web interface                   |
| Network/firewall issues    | Check corporate firewall, VPN settings, IP whitelisting         |
| Account suspended          | Contact Snowflake administrator                                 |
| Region mismatch            | Ensure account identifier includes correct region               |

**Example Fix:**

```bash
# Wrong format
SNOWFLAKE_ACCOUNT=myaccount

# Correct format
SNOWFLAKE_ACCOUNT=MYORG-MYACCOUNT
```

#### Problem: `CONNECTION_ERROR: External browser authentication failed`

**Symptoms:**

- Using `SNOWFLAKE_AUTHENTICATOR=externalbrowser`
- Browser doesn't open or authentication fails
- SSO-related error messages

**Solutions:**

1. **Check Browser Availability:**

   ```bash
   # Ensure default browser is available
   which google-chrome || which firefox || which safari
   ```

2. **Verify SSO Configuration:**

   ```bash
   # Don't set password for external browser auth
   unset SNOWFLAKE_PASSWORD
   SNOWFLAKE_AUTHENTICATOR=externalbrowser
   ```

3. **Test Manual SSO:**
   - Open browser manually
   - Navigate to your Snowflake login URL
   - Verify SSO works through web interface

### 2. Configuration Issues

#### Problem: `CONFIG_ERROR: Missing required environment variable`

**Symptoms:**

- Server fails to start immediately
- Clear error message about missing variables

**Diagnostic Steps:**

1. **Check Environment File:**

   ```bash
   # Verify .env file exists and is readable
   ls -la .env
   cat .env
   ```

2. **Validate All Required Variables:**
   ```bash
   # Check each required variable
   echo "Account: $SNOWFLAKE_ACCOUNT"
   echo "User: $SNOWFLAKE_USER"
   echo "Database: $SNOWFLAKE_DATABASE"
   echo "Schema: $SNOWFLAKE_SCHEMA"
   echo "Warehouse: $SNOWFLAKE_WAREHOUSE"
   echo "Role: $SNOWFLAKE_ROLE"
   ```

**Solutions:**

1. **Copy from Template:**

   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

2. **Check Variable Names:**
   ```bash
   # Common typos to avoid
   SNOWFLAKE_ACCOUNT=...  # ✅ Correct
   SNOWFLAKE_ACOUNT=...   # ❌ Missing 'C'
   SNOWFLAKE_USERNAME=... # ❌ Should be SNOWFLAKE_USER
   ```

#### Problem: `CONFIG_ERROR: Invalid configuration values`

**Symptoms:**

- Variables are set but server rejects them
- Validation error messages

**Solutions:**

1. **Check Value Formats:**

   ```bash
   # Account should not include .snowflakecomputing.com
   SNOWFLAKE_ACCOUNT=MYORG-MYACCOUNT  # ✅ Correct
   SNOWFLAKE_ACCOUNT=MYORG-MYACCOUNT.snowflakecomputing.com  # ❌ Wrong

   # Authenticator must be exact values
   SNOWFLAKE_AUTHENTICATOR=snowflake      # ✅ Correct
   SNOWFLAKE_AUTHENTICATOR=externalbrowser # ✅ Correct
   SNOWFLAKE_AUTHENTICATOR=password       # ❌ Wrong
   ```

### 3. Query Execution Issues

#### Problem: `EXECUTION_ERROR: SQL compilation error`

**Symptoms:**

- Connection works but queries fail
- Snowflake-specific SQL errors

**Common SQL Errors and Solutions:**

| Error Message                        | Cause                     | Solution                                  |
| ------------------------------------ | ------------------------- | ----------------------------------------- |
| `Object 'TABLE_NAME' does not exist` | Table not found           | Check table name, schema, database        |
| `Invalid identifier 'COLUMN_NAME'`   | Column doesn't exist      | Verify column names with `DESCRIBE TABLE` |
| `Insufficient privileges`            | Permission denied         | Check role permissions                    |
| `SQL access control error`           | Security policy violation | Contact administrator                     |

**Diagnostic Steps:**

1. **Test Query in Snowflake Web UI:**

   ```sql
   -- Use same query in Snowflake web interface
   SELECT * FROM DEMO.PUBLIC.CUSTOMERS LIMIT 1;
   ```

2. **Check Object Existence:**

   ```sql
   -- Verify database exists
   SHOW DATABASES LIKE 'DEMO';

   -- Verify schema exists
   SHOW SCHEMAS IN DATABASE DEMO;

   -- Verify table exists
   SHOW TABLES IN SCHEMA DEMO.PUBLIC;
   ```

3. **Check Permissions:**

   ```sql
   -- Check current role
   SELECT CURRENT_ROLE();

   -- Check available roles
   SHOW GRANTS TO USER CURRENT_USER();
   ```

#### Problem: `VALIDATION_ERROR: Invalid SQL input`

**Symptoms:**

- Query rejected before execution
- Input validation errors

**Solutions:**

1. **Check SQL Format:**

   ```json
   // ✅ Correct format
   {
     "sql": "SELECT * FROM DEMO.PUBLIC.CUSTOMERS LIMIT 10"
   }

   // ❌ Wrong - empty SQL
   {
     "sql": ""
   }

   // ❌ Wrong - missing sql field
   {
     "query": "SELECT * FROM TABLE"
   }
   ```

2. **Verify SQL Content:**

   ```sql
   -- ✅ Supported operations
   SELECT * FROM TABLE;
   SHOW TABLES;
   DESCRIBE TABLE;

   -- ❌ Unsupported operations (if restricted)
   DROP TABLE;
   DELETE FROM TABLE;
   ```

### 4. Performance Issues

#### Problem: Queries timing out or running slowly

**Symptoms:**

- Long query execution times
- Timeout errors
- High resource usage

**Diagnostic Steps:**

1. **Check Query Complexity:**

   ```sql
   -- Simple queries should be fast
   SELECT COUNT(*) FROM TABLE;

   -- Complex queries may be slow
   SELECT * FROM LARGE_TABLE
   JOIN ANOTHER_LARGE_TABLE
   WHERE COMPLEX_CONDITION;
   ```

2. **Monitor Snowflake Query History:**
   ```sql
   -- Check recent queries in Snowflake
   SELECT * FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY())
   WHERE START_TIME >= CURRENT_TIMESTAMP - INTERVAL '1 HOUR'
   ORDER BY START_TIME DESC;
   ```

**Solutions:**

1. **Optimize Queries:**

   ```sql
   -- Add LIMIT clauses
   SELECT * FROM LARGE_TABLE LIMIT 1000;

   -- Use specific columns
   SELECT ID, NAME FROM TABLE;  -- Instead of SELECT *

   -- Add WHERE clauses
   SELECT * FROM TABLE WHERE DATE >= '2024-01-01';
   ```

2. **Check Warehouse Size:**

   ```sql
   -- Check current warehouse
   SHOW WAREHOUSES;

   -- Consider larger warehouse for complex queries
   ALTER WAREHOUSE COMPUTE_WH SET WAREHOUSE_SIZE = 'LARGE';
   ```

### 5. Memory and Resource Issues

#### Problem: Server crashes or high memory usage

**Symptoms:**

- Process terminates unexpectedly
- Out of memory errors
- System becomes unresponsive

**Solutions:**

1. **Monitor Resource Usage:**

   ```bash
   # Check memory usage
   ps aux | grep node

   # Monitor in real-time
   top -p $(pgrep node)
   ```

2. **Limit Result Sets:**

   ```sql
   -- Always use LIMIT for large queries
   SELECT * FROM LARGE_TABLE LIMIT 10000;

   -- Use pagination for very large results
   SELECT * FROM TABLE
   ORDER BY ID
   LIMIT 1000 OFFSET 0;
   ```

3. **Optimize Node.js Settings:**
   ```bash
   # Increase memory limit if needed
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   ```

## Advanced Troubleshooting

### Debug Mode Analysis

When running with `LOG_LEVEL=debug`, look for these key log entries:

1. **Startup Sequence:**

   ```
   [DEBUG] Loading configuration from environment
   [DEBUG] Validating Snowflake configuration
   [DEBUG] Initializing Snowflake client
   [DEBUG] Testing database connection
   [INFO] Connected to Snowflake successfully
   [DEBUG] Starting MCP server
   [INFO] MCP server started and listening
   ```

2. **Query Processing:**

   ```
   [DEBUG] Processing query request
   [DEBUG] Validating SQL input
   [DEBUG] Executing validated query
   [DEBUG] Query executed successfully
   [INFO] Query processed successfully
   ```

3. **Error Patterns:**
   ```
   [ERROR] Configuration validation failed
   [ERROR] Snowflake connection failed
   [ERROR] SQL execution failed
   [ERROR] Unexpected error occurred
   ```

### Network Diagnostics

1. **Test Snowflake Connectivity:**

   ```bash
   # Test DNS resolution
   nslookup your-account.snowflakecomputing.com

   # Test HTTPS connectivity
   curl -I https://your-account.snowflakecomputing.com

   # Test with specific port
   telnet your-account.snowflakecomputing.com 443
   ```

2. **Check Proxy Settings:**
   ```bash
   # If behind corporate proxy
   export HTTPS_PROXY=http://proxy.company.com:8080
   export HTTP_PROXY=http://proxy.company.com:8080
   ```

### Log Analysis

1. **Enable Comprehensive Logging:**

   ```bash
   # Create log file
   LOG_LEVEL=debug npm start > server.log 2>&1
   ```

2. **Analyze Common Patterns:**

   ```bash
   # Check for connection issues
   grep -i "connection" server.log

   # Check for authentication issues
   grep -i "auth" server.log

   # Check for SQL errors
   grep -i "sql" server.log

   # Check for performance issues
   grep -i "timeout\|slow\|performance" server.log
   ```

## Getting Additional Help

### Information to Collect

When seeking help, collect this information:

1. **Environment Details:**

   ```bash
   node --version
   npm --version
   cat package.json | grep version
   echo $SNOWFLAKE_ACCOUNT
   echo $LOG_LEVEL
   ```

2. **Error Details:**
   - Complete error message
   - Stack trace (if available)
   - Steps to reproduce
   - Expected vs actual behavior

3. **Configuration (sanitized):**
   ```bash
   # Remove sensitive data before sharing
   cat .env | sed 's/PASSWORD=.*/PASSWORD=***REDACTED***/'
   ```

### Support Channels

1. **Check Documentation:**
   - README.md
   - API.md
   - This troubleshooting guide

2. **Review Logs:**
   - Enable debug logging
   - Check for patterns
   - Look for specific error codes

3. **Test Isolation:**
   - Test with minimal configuration
   - Try simple queries first
   - Verify Snowflake access independently

### Common Resolution Steps

1. **Restart with Clean State:**

   ```bash
   # Clear any cached state
   rm -rf node_modules/.cache

   # Reinstall dependencies
   npm install

   # Rebuild
   npm run build

   # Start fresh
   npm start
   ```

2. **Verify External Dependencies:**

   ```bash
   # Test Snowflake access
   # Test network connectivity
   # Check system resources
   ```

3. **Incremental Testing:**
   ```bash
   # Start with basic configuration
   # Add complexity gradually
   # Identify breaking point
   ```

Remember: Most issues are configuration-related. Double-check your environment variables and Snowflake permissions before diving into complex debugging.
