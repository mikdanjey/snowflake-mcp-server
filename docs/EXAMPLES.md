# Query Examples

This document provides comprehensive examples of SQL queries you can execute through the Snowflake MCP Server, along with their expected responses.

## Basic Queries

### Simple SELECT Query

**Query:**

```sql
SELECT * FROM DEMO.PUBLIC.CUSTOMERS LIMIT 5;
```

**Expected Response:**

```json
{
  "rows": [
    {
      "CUSTOMER_ID": 1,
      "CUSTOMER_NAME": "John Doe",
      "EMAIL": "john.doe@email.com",
      "PHONE": "+1-555-0123",
      "ADDRESS": "123 Main St",
      "CITY": "New York",
      "STATE": "NY",
      "ZIP_CODE": "10001",
      "CREATED_DATE": "2024-01-15T10:30:00.000Z"
    },
    {
      "CUSTOMER_ID": 2,
      "CUSTOMER_NAME": "Jane Smith",
      "EMAIL": "jane.smith@email.com",
      "PHONE": "+1-555-0124",
      "ADDRESS": "456 Oak Ave",
      "CITY": "Los Angeles",
      "STATE": "CA",
      "ZIP_CODE": "90210",
      "CREATED_DATE": "2024-01-16T14:22:00.000Z"
    }
  ],
  "rowCount": 5,
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
        "nullable": false
      },
      {
        "name": "EMAIL",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "PHONE",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "ADDRESS",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "CITY",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "STATE",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "ZIP_CODE",
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

### Count Query

**Query:**

```sql
SELECT COUNT(*) as TOTAL_CUSTOMERS FROM DEMO.PUBLIC.CUSTOMERS;
```

**Expected Response:**

```json
{
  "rows": [
    {
      "TOTAL_CUSTOMERS": 1250
    }
  ],
  "rowCount": 1,
  "executionTime": 89,
  "metadata": {
    "columns": [
      {
        "name": "TOTAL_CUSTOMERS",
        "type": "NUMBER",
        "nullable": false
      }
    ]
  }
}
```

## Aggregation Queries

### GROUP BY with Aggregations

**Query:**

```sql
SELECT
  STATE,
  COUNT(*) as CUSTOMER_COUNT,
  AVG(CASE WHEN ORDER_AMOUNT IS NOT NULL THEN ORDER_AMOUNT END) as AVG_ORDER_AMOUNT
FROM DEMO.PUBLIC.CUSTOMERS c
LEFT JOIN DEMO.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID
GROUP BY STATE
ORDER BY CUSTOMER_COUNT DESC
LIMIT 10;
```

**Expected Response:**

```json
{
  "rows": [
    {
      "STATE": "CA",
      "CUSTOMER_COUNT": 156,
      "AVG_ORDER_AMOUNT": 245.67
    },
    {
      "STATE": "NY",
      "CUSTOMER_COUNT": 134,
      "AVG_ORDER_AMOUNT": 289.45
    },
    {
      "STATE": "TX",
      "CUSTOMER_COUNT": 98,
      "AVG_ORDER_AMOUNT": 198.23
    },
    {
      "STATE": "FL",
      "CUSTOMER_COUNT": 87,
      "AVG_ORDER_AMOUNT": 267.89
    }
  ],
  "rowCount": 10,
  "executionTime": 1234,
  "metadata": {
    "columns": [
      {
        "name": "STATE",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "CUSTOMER_COUNT",
        "type": "NUMBER",
        "nullable": false
      },
      {
        "name": "AVG_ORDER_AMOUNT",
        "type": "NUMBER",
        "nullable": true
      }
    ]
  }
}
```

### Time-based Aggregation

**Query:**

```sql
SELECT
  DATE_TRUNC('month', ORDER_DATE) as ORDER_MONTH,
  COUNT(*) as ORDER_COUNT,
  SUM(ORDER_AMOUNT) as TOTAL_REVENUE,
  AVG(ORDER_AMOUNT) as AVG_ORDER_VALUE
FROM DEMO.PUBLIC.ORDERS
WHERE ORDER_DATE >= '2024-01-01'
GROUP BY DATE_TRUNC('month', ORDER_DATE)
ORDER BY ORDER_MONTH;
```

**Expected Response:**

```json
{
  "rows": [
    {
      "ORDER_MONTH": "2024-01-01T00:00:00.000Z",
      "ORDER_COUNT": 245,
      "TOTAL_REVENUE": 58750.25,
      "AVG_ORDER_VALUE": 239.8
    },
    {
      "ORDER_MONTH": "2024-02-01T00:00:00.000Z",
      "ORDER_COUNT": 289,
      "TOTAL_REVENUE": 67234.5,
      "AVG_ORDER_VALUE": 232.64
    },
    {
      "ORDER_MONTH": "2024-03-01T00:00:00.000Z",
      "ORDER_COUNT": 312,
      "TOTAL_REVENUE": 78945.75,
      "AVG_ORDER_VALUE": 253.01
    }
  ],
  "rowCount": 3,
  "executionTime": 567,
  "metadata": {
    "columns": [
      {
        "name": "ORDER_MONTH",
        "type": "TIMESTAMP_NTZ",
        "nullable": true
      },
      {
        "name": "ORDER_COUNT",
        "type": "NUMBER",
        "nullable": false
      },
      {
        "name": "TOTAL_REVENUE",
        "type": "NUMBER",
        "nullable": true
      },
      {
        "name": "AVG_ORDER_VALUE",
        "type": "NUMBER",
        "nullable": true
      }
    ]
  }
}
```

## JOIN Queries

### Inner Join

**Query:**

```sql
SELECT
  c.CUSTOMER_NAME,
  c.EMAIL,
  o.ORDER_ID,
  o.ORDER_DATE,
  o.ORDER_AMOUNT
FROM DEMO.PUBLIC.CUSTOMERS c
INNER JOIN DEMO.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID
WHERE o.ORDER_DATE >= '2024-03-01'
ORDER BY o.ORDER_DATE DESC
LIMIT 5;
```

**Expected Response:**

```json
{
  "rows": [
    {
      "CUSTOMER_NAME": "Alice Johnson",
      "EMAIL": "alice.johnson@email.com",
      "ORDER_ID": 1001,
      "ORDER_DATE": "2024-03-15T09:30:00.000Z",
      "ORDER_AMOUNT": 299.99
    },
    {
      "CUSTOMER_NAME": "Bob Wilson",
      "EMAIL": "bob.wilson@email.com",
      "ORDER_ID": 1002,
      "ORDER_DATE": "2024-03-14T16:45:00.000Z",
      "ORDER_AMOUNT": 156.75
    }
  ],
  "rowCount": 5,
  "executionTime": 423,
  "metadata": {
    "columns": [
      {
        "name": "CUSTOMER_NAME",
        "type": "VARCHAR",
        "nullable": false
      },
      {
        "name": "EMAIL",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "ORDER_ID",
        "type": "NUMBER",
        "nullable": false
      },
      {
        "name": "ORDER_DATE",
        "type": "TIMESTAMP_NTZ",
        "nullable": false
      },
      {
        "name": "ORDER_AMOUNT",
        "type": "NUMBER",
        "nullable": false
      }
    ]
  }
}
```

### Left Join with NULL Handling

**Query:**

```sql
SELECT
  c.CUSTOMER_NAME,
  c.CREATED_DATE,
  COALESCE(o.ORDER_COUNT, 0) as ORDER_COUNT,
  COALESCE(o.TOTAL_SPENT, 0) as TOTAL_SPENT
FROM DEMO.PUBLIC.CUSTOMERS c
LEFT JOIN (
  SELECT
    CUSTOMER_ID,
    COUNT(*) as ORDER_COUNT,
    SUM(ORDER_AMOUNT) as TOTAL_SPENT
  FROM DEMO.PUBLIC.ORDERS
  GROUP BY CUSTOMER_ID
) o ON c.CUSTOMER_ID = o.CUSTOMER_ID
WHERE c.CREATED_DATE >= '2024-01-01'
ORDER BY TOTAL_SPENT DESC
LIMIT 10;
```

**Expected Response:**

```json
{
  "rows": [
    {
      "CUSTOMER_NAME": "Premium Customer",
      "CREATED_DATE": "2024-01-15T10:30:00.000Z",
      "ORDER_COUNT": 15,
      "TOTAL_SPENT": 4567.89
    },
    {
      "CUSTOMER_NAME": "Regular Customer",
      "CREATED_DATE": "2024-02-01T14:22:00.000Z",
      "ORDER_COUNT": 8,
      "TOTAL_SPENT": 2345.67
    },
    {
      "CUSTOMER_NAME": "New Customer",
      "CREATED_DATE": "2024-03-10T11:15:00.000Z",
      "ORDER_COUNT": 0,
      "TOTAL_SPENT": 0
    }
  ],
  "rowCount": 10,
  "executionTime": 789,
  "metadata": {
    "columns": [
      {
        "name": "CUSTOMER_NAME",
        "type": "VARCHAR",
        "nullable": false
      },
      {
        "name": "CREATED_DATE",
        "type": "TIMESTAMP_NTZ",
        "nullable": true
      },
      {
        "name": "ORDER_COUNT",
        "type": "NUMBER",
        "nullable": false
      },
      {
        "name": "TOTAL_SPENT",
        "type": "NUMBER",
        "nullable": false
      }
    ]
  }
}
```

## Window Functions

### Ranking and Row Numbers

**Query:**

```sql
SELECT
  CUSTOMER_NAME,
  ORDER_DATE,
  ORDER_AMOUNT,
  ROW_NUMBER() OVER (PARTITION BY c.CUSTOMER_ID ORDER BY o.ORDER_DATE DESC) as ORDER_RANK,
  SUM(ORDER_AMOUNT) OVER (PARTITION BY c.CUSTOMER_ID ORDER BY o.ORDER_DATE ROWS UNBOUNDED PRECEDING) as RUNNING_TOTAL
FROM DEMO.PUBLIC.CUSTOMERS c
INNER JOIN DEMO.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID
WHERE c.CUSTOMER_ID IN (1, 2, 3)
ORDER BY c.CUSTOMER_ID, o.ORDER_DATE DESC;
```

**Expected Response:**

```json
{
  "rows": [
    {
      "CUSTOMER_NAME": "John Doe",
      "ORDER_DATE": "2024-03-10T14:30:00.000Z",
      "ORDER_AMOUNT": 299.99,
      "ORDER_RANK": 1,
      "RUNNING_TOTAL": 299.99
    },
    {
      "CUSTOMER_NAME": "John Doe",
      "ORDER_DATE": "2024-02-15T10:15:00.000Z",
      "ORDER_AMOUNT": 156.5,
      "ORDER_RANK": 2,
      "RUNNING_TOTAL": 456.49
    },
    {
      "CUSTOMER_NAME": "Jane Smith",
      "ORDER_DATE": "2024-03-05T16:45:00.000Z",
      "ORDER_AMOUNT": 89.99,
      "ORDER_RANK": 1,
      "RUNNING_TOTAL": 89.99
    }
  ],
  "rowCount": 3,
  "executionTime": 345,
  "metadata": {
    "columns": [
      {
        "name": "CUSTOMER_NAME",
        "type": "VARCHAR",
        "nullable": false
      },
      {
        "name": "ORDER_DATE",
        "type": "TIMESTAMP_NTZ",
        "nullable": false
      },
      {
        "name": "ORDER_AMOUNT",
        "type": "NUMBER",
        "nullable": false
      },
      {
        "name": "ORDER_RANK",
        "type": "NUMBER",
        "nullable": false
      },
      {
        "name": "RUNNING_TOTAL",
        "type": "NUMBER",
        "nullable": true
      }
    ]
  }
}
```

## Information Schema Queries

### Show Tables

**Query:**

```sql
SHOW TABLES IN SCHEMA DEMO.PUBLIC;
```

**Expected Response:**

```json
{
  "rows": [
    {
      "created_on": "2024-01-01T00:00:00.000Z",
      "name": "CUSTOMERS",
      "database_name": "DEMO",
      "schema_name": "PUBLIC",
      "kind": "TABLE",
      "comment": "Customer information table",
      "cluster_by": "",
      "rows": 1250,
      "bytes": 125000,
      "owner": "SYSADMIN",
      "retention_time": 1,
      "automatic_clustering": "OFF",
      "change_tracking": "OFF",
      "search_optimization": "OFF",
      "search_optimization_progress": "",
      "search_optimization_bytes": 0,
      "is_external": "N"
    },
    {
      "created_on": "2024-01-01T00:00:00.000Z",
      "name": "ORDERS",
      "database_name": "DEMO",
      "schema_name": "PUBLIC",
      "kind": "TABLE",
      "comment": "Order transactions table",
      "cluster_by": "",
      "rows": 5430,
      "bytes": 543000,
      "owner": "SYSADMIN",
      "retention_time": 1,
      "automatic_clustering": "OFF",
      "change_tracking": "OFF",
      "search_optimization": "OFF",
      "search_optimization_progress": "",
      "search_optimization_bytes": 0,
      "is_external": "N"
    }
  ],
  "rowCount": 2,
  "executionTime": 156,
  "metadata": {
    "columns": [
      {
        "name": "created_on",
        "type": "TIMESTAMP_LTZ",
        "nullable": true
      },
      {
        "name": "name",
        "type": "VARCHAR",
        "nullable": false
      },
      {
        "name": "database_name",
        "type": "VARCHAR",
        "nullable": false
      },
      {
        "name": "schema_name",
        "type": "VARCHAR",
        "nullable": false
      },
      {
        "name": "kind",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "comment",
        "type": "VARCHAR",
        "nullable": true
      }
    ]
  }
}
```

### Describe Table

**Query:**

```sql
DESCRIBE TABLE DEMO.PUBLIC.CUSTOMERS;
```

**Expected Response:**

```json
{
  "rows": [
    {
      "name": "CUSTOMER_ID",
      "type": "NUMBER(38,0)",
      "kind": "COLUMN",
      "null?": "N",
      "default": null,
      "primary key": "Y",
      "unique key": "N",
      "check": null,
      "expression": null,
      "comment": "Unique customer identifier",
      "policy name": null,
      "privacy domain": null
    },
    {
      "name": "CUSTOMER_NAME",
      "type": "VARCHAR(100)",
      "kind": "COLUMN",
      "null?": "N",
      "default": null,
      "primary key": "N",
      "unique key": "N",
      "check": null,
      "expression": null,
      "comment": "Customer full name",
      "policy name": null,
      "privacy domain": null
    },
    {
      "name": "EMAIL",
      "type": "VARCHAR(255)",
      "kind": "COLUMN",
      "null?": "Y",
      "default": null,
      "primary key": "N",
      "unique key": "N",
      "check": null,
      "expression": null,
      "comment": "Customer email address",
      "policy name": null,
      "privacy domain": null
    }
  ],
  "rowCount": 3,
  "executionTime": 89,
  "metadata": {
    "columns": [
      {
        "name": "name",
        "type": "VARCHAR",
        "nullable": false
      },
      {
        "name": "type",
        "type": "VARCHAR",
        "nullable": false
      },
      {
        "name": "kind",
        "type": "VARCHAR",
        "nullable": false
      },
      {
        "name": "null?",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "default",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "primary key",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "unique key",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "check",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "expression",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "comment",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "policy name",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "privacy domain",
        "type": "VARCHAR",
        "nullable": true
      }
    ]
  }
}
```

### Show Databases

**Query:**

```sql
SHOW DATABASES;
```

**Expected Response:**

```json
{
  "rows": [
    {
      "created_on": "2024-01-01T00:00:00.000Z",
      "name": "DEMO",
      "is_default": "N",
      "is_current": "Y",
      "origin": "",
      "owner": "SYSADMIN",
      "comment": "Demo database for testing",
      "options": "",
      "retention_time": 1,
      "resource_group": "null"
    },
    {
      "created_on": "2023-12-01T00:00:00.000Z",
      "name": "SNOWFLAKE_SAMPLE_DATA",
      "is_default": "N",
      "is_current": "N",
      "origin": "",
      "owner": "ACCOUNTADMIN",
      "comment": "Sample data provided by Snowflake",
      "options": "",
      "retention_time": 1,
      "resource_group": "null"
    }
  ],
  "rowCount": 2,
  "executionTime": 123,
  "metadata": {
    "columns": [
      {
        "name": "created_on",
        "type": "TIMESTAMP_LTZ",
        "nullable": true
      },
      {
        "name": "name",
        "type": "VARCHAR",
        "nullable": false
      },
      {
        "name": "is_default",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "is_current",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "origin",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "owner",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "comment",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "options",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "retention_time",
        "type": "NUMBER",
        "nullable": true
      },
      {
        "name": "resource_group",
        "type": "VARCHAR",
        "nullable": true
      }
    ]
  }
}
```

## Complex Data Types

### Working with VARIANT (JSON) Data

**Query:**

```sql
SELECT
  CUSTOMER_ID,
  CUSTOMER_NAME,
  METADATA:preferences:newsletter::boolean as NEWSLETTER_SUBSCRIBED,
  METADATA:preferences:marketing::boolean as MARKETING_SUBSCRIBED,
  METADATA:last_login::timestamp as LAST_LOGIN,
  METADATA:tags as CUSTOMER_TAGS
FROM DEMO.PUBLIC.CUSTOMER_PROFILES
WHERE METADATA:preferences:newsletter::boolean = true
LIMIT 5;
```

**Expected Response:**

```json
{
  "rows": [
    {
      "CUSTOMER_ID": 1,
      "CUSTOMER_NAME": "John Doe",
      "NEWSLETTER_SUBSCRIBED": true,
      "MARKETING_SUBSCRIBED": false,
      "LAST_LOGIN": "2024-03-15T14:30:00.000Z",
      "CUSTOMER_TAGS": ["premium", "loyal", "tech-savvy"]
    },
    {
      "CUSTOMER_ID": 2,
      "CUSTOMER_NAME": "Jane Smith",
      "NEWSLETTER_SUBSCRIBED": true,
      "MARKETING_SUBSCRIBED": true,
      "LAST_LOGIN": "2024-03-14T09:15:00.000Z",
      "CUSTOMER_TAGS": ["new", "mobile-user"]
    }
  ],
  "rowCount": 5,
  "executionTime": 567,
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
        "nullable": false
      },
      {
        "name": "NEWSLETTER_SUBSCRIBED",
        "type": "BOOLEAN",
        "nullable": true
      },
      {
        "name": "MARKETING_SUBSCRIBED",
        "type": "BOOLEAN",
        "nullable": true
      },
      {
        "name": "LAST_LOGIN",
        "type": "TIMESTAMP_NTZ",
        "nullable": true
      },
      {
        "name": "CUSTOMER_TAGS",
        "type": "VARIANT",
        "nullable": true
      }
    ]
  }
}
```

### Working with Arrays

**Query:**

```sql
SELECT
  PRODUCT_ID,
  PRODUCT_NAME,
  ARRAY_SIZE(CATEGORIES) as CATEGORY_COUNT,
  CATEGORIES[0]::string as PRIMARY_CATEGORY,
  ARRAY_TO_STRING(CATEGORIES, ', ') as ALL_CATEGORIES
FROM DEMO.PUBLIC.PRODUCTS
WHERE ARRAY_SIZE(CATEGORIES) > 1
LIMIT 3;
```

**Expected Response:**

```json
{
  "rows": [
    {
      "PRODUCT_ID": 101,
      "PRODUCT_NAME": "Wireless Headphones",
      "CATEGORY_COUNT": 3,
      "PRIMARY_CATEGORY": "Electronics",
      "ALL_CATEGORIES": "Electronics, Audio, Wireless"
    },
    {
      "PRODUCT_ID": 102,
      "PRODUCT_NAME": "Running Shoes",
      "CATEGORY_COUNT": 2,
      "PRIMARY_CATEGORY": "Sports",
      "ALL_CATEGORIES": "Sports, Footwear"
    }
  ],
  "rowCount": 3,
  "executionTime": 234,
  "metadata": {
    "columns": [
      {
        "name": "PRODUCT_ID",
        "type": "NUMBER",
        "nullable": false
      },
      {
        "name": "PRODUCT_NAME",
        "type": "VARCHAR",
        "nullable": false
      },
      {
        "name": "CATEGORY_COUNT",
        "type": "NUMBER",
        "nullable": true
      },
      {
        "name": "PRIMARY_CATEGORY",
        "type": "VARCHAR",
        "nullable": true
      },
      {
        "name": "ALL_CATEGORIES",
        "type": "VARCHAR",
        "nullable": true
      }
    ]
  }
}
```

## Error Examples

### Validation Error

**Query:**

```sql

```

**Expected Response:**

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

### Execution Error - Table Not Found

**Query:**

```sql
SELECT * FROM NONEXISTENT_TABLE;
```

**Expected Response:**

```json
{
  "error": {
    "code": "EXECUTION_ERROR",
    "message": "SQL compilation error: Object 'NONEXISTENT_TABLE' does not exist or not authorized.",
    "details": {
      "sql": "SELECT * FROM NONEXISTENT_TABLE;",
      "snowflakeError": "Object 'NONEXISTENT_TABLE' does not exist or not authorized.",
      "executionTime": 156,
      "category": "SQL_COMPILATION_ERROR"
    }
  }
}
```

### Execution Error - Permission Denied

**Query:**

```sql
SELECT * FROM RESTRICTED_DATABASE.PRIVATE_SCHEMA.SENSITIVE_TABLE;
```

**Expected Response:**

```json
{
  "error": {
    "code": "EXECUTION_ERROR",
    "message": "Insufficient privileges to operate on table 'SENSITIVE_TABLE'",
    "details": {
      "sql": "SELECT * FROM RESTRICTED_DATABASE.PRIVATE_SCHEMA.SENSITIVE_TABLE;",
      "snowflakeError": "Insufficient privileges to operate on table 'SENSITIVE_TABLE'",
      "executionTime": 89,
      "category": "INSUFFICIENT_PRIVILEGES"
    }
  }
}
```

## Performance Examples

### Simple Query (Low Complexity)

**Query:**

```sql
SELECT COUNT(*) FROM DEMO.PUBLIC.CUSTOMERS;
```

**Performance Characteristics:**

- Execution time: ~100ms
- Timeout: 15 seconds
- Priority: High
- Complexity: Low

### Medium Complexity Query

**Query:**

```sql
SELECT
  c.STATE,
  COUNT(*) as CUSTOMER_COUNT,
  AVG(o.ORDER_AMOUNT) as AVG_ORDER
FROM DEMO.PUBLIC.CUSTOMERS c
JOIN DEMO.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID
GROUP BY c.STATE
ORDER BY CUSTOMER_COUNT DESC;
```

**Performance Characteristics:**

- Execution time: ~1-5 seconds
- Timeout: 60 seconds
- Priority: Normal
- Complexity: Medium

### High Complexity Query

**Query:**

```sql
WITH customer_metrics AS (
  SELECT
    c.CUSTOMER_ID,
    c.CUSTOMER_NAME,
    COUNT(o.ORDER_ID) as ORDER_COUNT,
    SUM(o.ORDER_AMOUNT) as TOTAL_SPENT,
    AVG(o.ORDER_AMOUNT) as AVG_ORDER_VALUE,
    MAX(o.ORDER_DATE) as LAST_ORDER_DATE,
    ROW_NUMBER() OVER (ORDER BY SUM(o.ORDER_AMOUNT) DESC) as SPENDING_RANK
  FROM DEMO.PUBLIC.CUSTOMERS c
  LEFT JOIN DEMO.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID
  GROUP BY c.CUSTOMER_ID, c.CUSTOMER_NAME
),
customer_segments AS (
  SELECT
    *,
    CASE
      WHEN SPENDING_RANK <= 100 THEN 'VIP'
      WHEN SPENDING_RANK <= 500 THEN 'Premium'
      WHEN TOTAL_SPENT > 1000 THEN 'Regular'
      ELSE 'Basic'
    END as CUSTOMER_SEGMENT,
    NTILE(10) OVER (ORDER BY TOTAL_SPENT DESC) as DECILE
  FROM customer_metrics
)
SELECT
  CUSTOMER_SEGMENT,
  COUNT(*) as SEGMENT_SIZE,
  AVG(TOTAL_SPENT) as AVG_SEGMENT_SPENDING,
  AVG(ORDER_COUNT) as AVG_ORDERS_PER_CUSTOMER,
  MIN(TOTAL_SPENT) as MIN_SPENDING,
  MAX(TOTAL_SPENT) as MAX_SPENDING
FROM customer_segments
GROUP BY CUSTOMER_SEGMENT
ORDER BY AVG_SEGMENT_SPENDING DESC;
```

**Performance Characteristics:**

- Execution time: ~10-60 seconds
- Timeout: 300 seconds (5 minutes)
- Priority: Low
- Complexity: High

## Best Practices

### 1. Always Use LIMIT for Exploratory Queries

```sql
-- ✅ Good: Limited result set
SELECT * FROM LARGE_TABLE LIMIT 100;

-- ❌ Avoid: Unlimited results
SELECT * FROM LARGE_TABLE;
```

### 2. Use Specific Column Names

```sql
-- ✅ Good: Specific columns
SELECT CUSTOMER_ID, CUSTOMER_NAME, EMAIL FROM CUSTOMERS;

-- ❌ Less efficient: SELECT *
SELECT * FROM CUSTOMERS;
```

### 3. Add WHERE Clauses for Large Tables

```sql
-- ✅ Good: Filtered query
SELECT * FROM ORDERS
WHERE ORDER_DATE >= '2024-01-01'
LIMIT 1000;

-- ❌ Avoid: Unfiltered large table scan
SELECT * FROM ORDERS LIMIT 1000;
```

### 4. Use Appropriate Data Types in Comparisons

```sql
-- ✅ Good: Proper date comparison
SELECT * FROM ORDERS
WHERE ORDER_DATE >= '2024-01-01'::date;

-- ❌ Less efficient: String comparison
SELECT * FROM ORDERS
WHERE ORDER_DATE::string >= '2024-01-01';
```

### 5. Optimize JOIN Operations

```sql
-- ✅ Good: JOIN on indexed columns
SELECT c.CUSTOMER_NAME, o.ORDER_AMOUNT
FROM CUSTOMERS c
JOIN ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID;

-- ❌ Avoid: JOIN on non-indexed columns
SELECT c.CUSTOMER_NAME, o.ORDER_AMOUNT
FROM CUSTOMERS c
JOIN ORDERS o ON c.EMAIL = o.CUSTOMER_EMAIL;
```

These examples demonstrate the variety of queries supported by the Snowflake MCP Server and their expected response formats. Use them as templates for building your own queries and understanding the server's capabilities.
