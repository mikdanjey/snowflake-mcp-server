/**
 * Test fixtures for SQL queries
 */

export const validQueries = {
  simple: {
    select: "SELECT * FROM users",
    show: "SHOW TABLES",
    describe: "DESCRIBE users",
    explain: "EXPLAIN SELECT * FROM users",
  },
  complex: {
    joinWithAggregation: `
      SELECT 
        u.id,
        u.name,
        COUNT(o.id) as order_count,
        AVG(o.total) as avg_order_value
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.created_at >= '2023-01-01'
        AND u.status = 'active'
      GROUP BY u.id, u.name
      HAVING COUNT(o.id) > 0
      ORDER BY avg_order_value DESC
      LIMIT 100
    `,
    cte: `
      WITH user_stats AS (
        SELECT 
          user_id,
          COUNT(*) as total_orders,
          SUM(amount) as total_spent
        FROM orders
        GROUP BY user_id
      )
      SELECT 
        u.name,
        us.total_orders,
        us.total_spent
      FROM users u
      JOIN user_stats us ON u.id = us.user_id
      WHERE us.total_spent > 1000
    `,
    windowFunction: `
      SELECT 
        name,
        salary,
        department,
        ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) as rank
      FROM employees
    `,
  },
  snowflakeSpecific: {
    variant: "SELECT data:name::string FROM json_table",
    timeTravel: "SELECT * FROM users AT (TIMESTAMP => '2023-01-01 00:00:00')",
    flatten: "SELECT f.value FROM table1, LATERAL FLATTEN(input => array_column) f",
  },
};

export const invalidQueries = {
  empty: "",
  whitespaceOnly: "   \n\t  ",
  tooLong: "SELECT * FROM users WHERE " + "x".repeat(100000),
  suspicious: [
    "SELECT * FROM users; DROP TABLE users;",
    "SELECT * FROM users UNION SELECT password FROM admin",
    "SELECT * FROM users -- ' OR 1=1",
    "SELECT * FROM users /* comment */ ' OR 1=1",
    "; EXEC sp_configure",
    "SELECT * FROM users; DELETE FROM logs;",
  ],
};

export const nonReadOnlyQueries = [
  "INSERT INTO users VALUES (1, 'John')",
  "UPDATE users SET name = 'Jane' WHERE id = 1",
  "DELETE FROM users WHERE id = 1",
  "DROP TABLE users",
  "CREATE TABLE test (id INT)",
  "ALTER TABLE users ADD COLUMN email VARCHAR(255)",
  "TRUNCATE TABLE logs",
];

export const readOnlyQueries = ["SELECT * FROM users", "SHOW TABLES", "SHOW DATABASES", "DESCRIBE users", "DESC customers", "EXPLAIN SELECT * FROM users", "WITH cte AS (SELECT 1) SELECT * FROM cte"];
