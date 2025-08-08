# Configuration Guide

This guide provides comprehensive information about configuring the Snowflake MCP Server.

## Environment Variables

The server is configured entirely through environment variables. All configuration should be placed in a `.env` file in the project root.

### Required Variables

| Variable              | Description                  | Example           | Notes                          |
| --------------------- | ---------------------------- | ----------------- | ------------------------------ |
| `SNOWFLAKE_ACCOUNT`   | Snowflake account identifier | `MYORG-MYACCOUNT` | Format varies by account type  |
| `SNOWFLAKE_USER`      | Database username            | `john.doe`        | Not email address              |
| `SNOWFLAKE_DATABASE`  | Target database name         | `DEMO`            | Must exist and be accessible   |
| `SNOWFLAKE_SCHEMA`    | Target schema name           | `PUBLIC`          | Must exist within database     |
| `SNOWFLAKE_WAREHOUSE` | Compute warehouse name       | `COMPUTE_WH`      | Must be accessible to user     |
| `SNOWFLAKE_ROLE`      | Role to assume               | `SYSADMIN`        | Must have required permissions |

### Authentication Variables

Choose one authentication method:

#### Password Authentication (Default)

| Variable                  | Description           | Example             | Notes                      |
| ------------------------- | --------------------- | ------------------- | -------------------------- |
| `SNOWFLAKE_AUTHENTICATOR` | Authentication method | `snowflake`         | Default value              |
| `SNOWFLAKE_PASSWORD`      | User password         | `SecurePassword123` | Required for password auth |

#### External Browser Authentication (SSO)

| Variable                  | Description           | Example           | Notes            |
| ------------------------- | --------------------- | ----------------- | ---------------- |
| `SNOWFLAKE_AUTHENTICATOR` | Authentication method | `externalbrowser` | For SSO/SAML     |
| `SNOWFLAKE_PASSWORD`      | User password         | _(not set)_       | Not used for SSO |

### Optional Variables

| Variable    | Description       | Default | Options                          |
| ----------- | ----------------- | ------- | -------------------------------- |
| `LOG_LEVEL` | Logging verbosity | `info`  | `debug`, `info`, `warn`, `error` |

## Account Identifier Formats

### Modern Format (Recommended)

For accounts created after 2020:

```
ORGNAME-ACCOUNTNAME
```

Examples:

- `ACME-PRODUCTION`
- `MYCOMPANY-DEV`
- `ANALYTICS-TEAM`

### Legacy Format

For older accounts:

```
ACCOUNT.REGION.CLOUD
```

Examples:

- `AB12345.us-east-1.aws`
- `XY67890.eu-west-1.aws`
- `CD34567.azure-eastus2.azure`

### Finding Your Account Identifier

1. **Snowflake Web UI Method:**
   - Log into Snowflake web interface
   - Go to Admin → Accounts
   - Copy the account identifier shown

2. **URL Method:**
   - Look at your Snowflake URL
   - Extract account from: `https://ACCOUNT.snowflakecomputing.com`

3. **SQL Method:**
   ```sql
   SELECT CURRENT_ACCOUNT();
   ```

## Authentication Methods

### Password Authentication

**When to use:**

- Development environments
- Service accounts
- Simple setups without SSO

**Configuration:**

```bash
SNOWFLAKE_AUTHENTICATOR=snowflake
SNOWFLAKE_PASSWORD=your_password_here
```

**Security considerations:**

- Use strong passwords
- Rotate passwords regularly
- Restrict file permissions on `.env`
- Consider using service accounts

### External Browser Authentication

**When to use:**

- Production environments with SSO
- Organizations using SAML/OKTA/Azure AD
- Enhanced security requirements

**Configuration:**

```bash
SNOWFLAKE_AUTHENTICATOR=externalbrowser
# SNOWFLAKE_PASSWORD not needed
```

**Requirements:**

- Default browser available
- Network access to identity provider
- SSO configured in Snowflake
- User exists in identity provider

## Database Configuration

### Database Selection

Choose the database containing your target data:

```bash
SNOWFLAKE_DATABASE=ANALYTICS_DB
```

**Considerations:**

- User must have USAGE privilege on database
- Database must exist
- Case-sensitive (use uppercase typically)

### Schema Selection

Choose the schema within your database:

```bash
SNOWFLAKE_SCHEMA=PUBLIC
```

**Common schemas:**

- `PUBLIC` - Default schema
- `INFORMATION_SCHEMA` - Metadata schema
- Custom schemas for specific data

### Warehouse Configuration

Select compute warehouse for query execution:

```bash
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
```

**Warehouse considerations:**

- Size affects query performance and cost
- User must have USAGE privilege
- Auto-suspend settings affect startup time
- Consider dedicated warehouse for MCP server

### Role Configuration

Choose role with appropriate permissions:

```bash
SNOWFLAKE_ROLE=ANALYST
```

**Common roles:**

- `SYSADMIN` - System administration
- `ACCOUNTADMIN` - Account administration (use carefully)
- `PUBLIC` - Basic access
- Custom roles for specific permissions

## Logging Configuration

### Log Levels

| Level   | Description             | Use Case                     |
| ------- | ----------------------- | ---------------------------- |
| `debug` | Detailed debugging info | Development, troubleshooting |
| `info`  | General information     | Production (default)         |
| `warn`  | Warning messages only   | Production (minimal logging) |
| `error` | Error messages only     | Production (error tracking)  |

### Debug Logging

Enable for troubleshooting:

```bash
LOG_LEVEL=debug
```

**Debug output includes:**

- Configuration loading details
- Connection establishment steps
- Query validation process
- Execution timing information
- Error stack traces

### Production Logging

Recommended for production:

```bash
LOG_LEVEL=info
```

**Info output includes:**

- Server startup/shutdown
- Successful connections
- Query execution summaries
- Error messages without stack traces

## Configuration Examples

### Development Environment

```bash
# Development setup with debug logging
SNOWFLAKE_ACCOUNT=MYORG-DEV
SNOWFLAKE_USER=dev.user
SNOWFLAKE_PASSWORD=DevPassword123
SNOWFLAKE_DATABASE=DEV_DB
SNOWFLAKE_SCHEMA=TESTING
SNOWFLAKE_WAREHOUSE=DEV_WH
SNOWFLAKE_ROLE=DEVELOPER
SNOWFLAKE_AUTHENTICATOR=snowflake
LOG_LEVEL=debug
```

### Production Environment (Password Auth)

```bash
# Production setup with service account
SNOWFLAKE_ACCOUNT=MYORG-PROD
SNOWFLAKE_USER=mcp_service_account
SNOWFLAKE_PASSWORD=SecureServicePassword123
SNOWFLAKE_DATABASE=ANALYTICS
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_WAREHOUSE=MCP_WH
SNOWFLAKE_ROLE=MCP_READER
SNOWFLAKE_AUTHENTICATOR=snowflake
LOG_LEVEL=info
```

### Production Environment (SSO)

```bash
# Production setup with SSO authentication
SNOWFLAKE_ACCOUNT=MYORG-PROD
SNOWFLAKE_USER=john.doe@company.com
SNOWFLAKE_DATABASE=ANALYTICS
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_WAREHOUSE=ANALYTICS_WH
SNOWFLAKE_ROLE=ANALYST
SNOWFLAKE_AUTHENTICATOR=externalbrowser
LOG_LEVEL=info
```

### Multi-Environment Setup

```bash
# Staging environment
SNOWFLAKE_ACCOUNT=MYORG-STAGING
SNOWFLAKE_USER=staging_user
SNOWFLAKE_PASSWORD=StagingPassword123
SNOWFLAKE_DATABASE=STAGING_DB
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_WAREHOUSE=STAGING_WH
SNOWFLAKE_ROLE=STAGING_ANALYST
SNOWFLAKE_AUTHENTICATOR=snowflake
LOG_LEVEL=info
```

## Security Best Practices

### File Security

1. **Restrict file permissions:**

   ```bash
   chmod 600 .env
   ```

2. **Add to .gitignore:**

   ```bash
   echo ".env" >> .gitignore
   ```

3. **Use separate files per environment:**
   ```bash
   .env.development
   .env.staging
   .env.production
   ```

### Password Security

1. **Use strong passwords:**
   - Minimum 12 characters
   - Mix of letters, numbers, symbols
   - Avoid dictionary words

2. **Rotate passwords regularly:**
   - Service accounts: every 90 days
   - User accounts: follow company policy

3. **Use service accounts:**
   - Dedicated accounts for applications
   - Limited permissions
   - Separate from user accounts

### Network Security

1. **IP Whitelisting:**

   ```sql
   -- In Snowflake, restrict access by IP
   CREATE NETWORK POLICY mcp_server_policy
   ALLOWED_IP_LIST = ('192.168.1.100', '10.0.0.0/8');

   ALTER USER mcp_service_account
   SET NETWORK_POLICY = 'mcp_server_policy';
   ```

2. **VPN/Private Networks:**
   - Run server within secure network
   - Use VPN for remote access
   - Avoid public internet exposure

### Role-Based Security

1. **Principle of Least Privilege:**

   ```sql
   -- Create minimal role for MCP server
   CREATE ROLE mcp_reader;
   GRANT USAGE ON DATABASE ANALYTICS TO ROLE mcp_reader;
   GRANT USAGE ON SCHEMA ANALYTICS.PUBLIC TO ROLE mcp_reader;
   GRANT SELECT ON ALL TABLES IN SCHEMA ANALYTICS.PUBLIC TO ROLE mcp_reader;
   GRANT ROLE mcp_reader TO USER mcp_service_account;
   ```

2. **Separate roles per environment:**
   - `MCP_DEV_READER` for development
   - `MCP_STAGING_READER` for staging
   - `MCP_PROD_READER` for production

## Validation and Testing

### Configuration Validation

The server validates configuration on startup:

1. **Required variables check:**
   - All required variables present
   - Non-empty values
   - Valid formats

2. **Connection test:**
   - Snowflake connectivity
   - Authentication success
   - Permission verification

### Testing Configuration

1. **Test connection manually:**

   ```bash
   # Test with Snowflake CLI
   snowsql -a $SNOWFLAKE_ACCOUNT -u $SNOWFLAKE_USER
   ```

2. **Test with server:**

   ```bash
   # Enable debug logging
   LOG_LEVEL=debug npm start
   ```

3. **Validate permissions:**

   ```sql
   -- Test basic queries
   SELECT CURRENT_USER();
   SELECT CURRENT_ROLE();
   SELECT CURRENT_DATABASE();
   SELECT CURRENT_SCHEMA();
   SELECT CURRENT_WAREHOUSE();

   -- Test table access
   SHOW TABLES IN SCHEMA CURRENT_SCHEMA();
   SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES;
   ```

## Troubleshooting Configuration

### Common Issues

1. **Invalid account identifier:**

   ```
   Error: Invalid account identifier format
   ```

   **Solution:** Check account format, remove `.snowflakecomputing.com`

2. **Authentication failure:**

   ```
   Error: Authentication failed
   ```

   **Solution:** Verify username/password, check authenticator type

3. **Permission denied:**

   ```
   Error: Insufficient privileges
   ```

   **Solution:** Check role permissions, verify database/schema access

4. **Network connectivity:**
   ```
   Error: Connection timeout
   ```
   **Solution:** Check firewall, VPN, network policies

### Debug Steps

1. **Enable debug logging:**

   ```bash
   LOG_LEVEL=debug npm start
   ```

2. **Test each component:**
   - Account identifier
   - Authentication
   - Database access
   - Schema access
   - Warehouse access

3. **Check Snowflake logs:**
   ```sql
   -- Check login history
   SELECT * FROM TABLE(INFORMATION_SCHEMA.LOGIN_HISTORY())
   WHERE USER_NAME = 'YOUR_USERNAME'
   ORDER BY EVENT_TIMESTAMP DESC
   LIMIT 10;
   ```

### Getting Help

1. **Review error messages carefully**
2. **Check Snowflake documentation**
3. **Test configuration in Snowflake web UI**
4. **Enable debug logging for detailed information**
5. **Verify network connectivity and permissions**

## Environment-Specific Considerations

### Docker Deployment

```dockerfile
# Pass environment variables to container
ENV SNOWFLAKE_ACCOUNT=MYORG-PROD
ENV SNOWFLAKE_USER=mcp_service
# ... other variables

# Or use env file
COPY .env.production .env
```

### Kubernetes Deployment

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: snowflake-mcp-config
type: Opaque
stringData:
  SNOWFLAKE_ACCOUNT: "MYORG-PROD"
  SNOWFLAKE_USER: "mcp_service"
  SNOWFLAKE_PASSWORD: "SecurePassword123"
  # ... other variables
```

### CI/CD Integration

```yaml
# GitHub Actions example
env:
  SNOWFLAKE_ACCOUNT: ${{ secrets.SNOWFLAKE_ACCOUNT }}
  SNOWFLAKE_USER: ${{ secrets.SNOWFLAKE_USER }}
  SNOWFLAKE_PASSWORD: ${{ secrets.SNOWFLAKE_PASSWORD }}
  # ... other variables
```

This configuration guide should help you set up the Snowflake MCP Server correctly for your specific environment and security requirements.
