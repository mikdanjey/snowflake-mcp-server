/**
 * Unit tests for SQLValidator
 */

import { SQLValidator, QuerySchema } from "../../../src/validators/sql-validator.js";
import type { ValidationError } from "../../../src/types/index.js";

describe("SQLValidator", () => {
  let validator: SQLValidator;

  beforeEach(() => {
    validator = new SQLValidator();
  });

  describe("validateQuery", () => {
    it("should validate a simple SELECT query", () => {
      const result = validator.validateQuery({ sql: "SELECT * FROM users" });
      expect(result).toEqual({
        sql: "SELECT * FROM users",
      });
    });

    it("should sanitize SQL by trimming whitespace", () => {
      const result = validator.validateQuery({
        sql: "  SELECT * FROM users  ",
      });
      expect(result).toEqual({
        sql: "SELECT * FROM users",
      });
    });

    it("should normalize multiple whitespace characters", () => {
      const result = validator.validateQuery({
        sql: "SELECT   *    FROM     users",
      });
      expect(result).toEqual({
        sql: "SELECT * FROM users",
      });
    });

    it("should remove trailing semicolons", () => {
      const result = validator.validateQuery({ sql: "SELECT * FROM users;" });
      expect(result).toEqual({
        sql: "SELECT * FROM users",
      });
    });

    it("should throw ValidationError for empty string", () => {
      expect(() => validator.validateQuery({ sql: "" })).toThrow();

      try {
        validator.validateQuery({ sql: "" });
      } catch (error) {
        const validationError = error as ValidationError;
        expect(validationError.code).toBe("VALIDATION_ERROR");
        expect(validationError.message).toBe("SQL validation failed");
        expect(validationError.details.issues).toContain("sql: SQL query cannot be empty");
      }
    });

    it("should throw ValidationError for whitespace-only string", () => {
      expect(() => validator.validateQuery({ sql: "   " })).toThrow();

      try {
        validator.validateQuery({ sql: "   " });
      } catch (error) {
        const validationError = error as ValidationError;
        expect(validationError.code).toBe("VALIDATION_ERROR");
        expect(validationError.details.issues).toContain("sql: SQL query cannot contain only whitespace");
      }
    });

    it("should throw ValidationError for extremely long queries", () => {
      const longQuery = "SELECT * FROM users WHERE " + "x".repeat(100000);
      expect(() => validator.validateQuery({ sql: longQuery })).toThrow();

      try {
        validator.validateQuery({ sql: longQuery });
      } catch (error) {
        const validationError = error as ValidationError;
        expect(validationError.code).toBe("VALIDATION_ERROR");
        expect(validationError.details.issues).toContain("sql: SQL query is too long (max 100,000 characters)");
      }
    });

    it("should throw ValidationError for suspicious SQL injection patterns", () => {
      const suspiciousQueries = [
        "SELECT * FROM users; DROP TABLE users;",
        "SELECT * FROM users UNION SELECT * FROM passwords",
        "SELECT * FROM users -- ' OR 1=1",
        "SELECT * FROM users /* comment */ ' OR 1=1",
      ];

      suspiciousQueries.forEach(query => {
        expect(() => validator.validateQuery({ sql: query })).toThrow();

        try {
          validator.validateQuery({ sql: query });
        } catch (error) {
          const validationError = error as ValidationError;
          expect(validationError.code).toBe("VALIDATION_ERROR");
          expect(validationError.details.issues).toContain("sql: SQL query contains potentially dangerous patterns");
        }
      });
    });
  });

  describe("validateSQL", () => {
    it("should validate raw SQL string", () => {
      const result = validator.validateSQL("SELECT COUNT(*) FROM orders");
      expect(result).toBe("SELECT COUNT(*) FROM orders");
    });

    it("should throw ValidationError for invalid SQL", () => {
      expect(() => validator.validateSQL("")).toThrow();
    });
  });

  describe("isReadOnlyQuery", () => {
    it("should identify SELECT queries as read-only", () => {
      const queries = ["SELECT * FROM users", "  select id, name from customers  ", "SELECT COUNT(*) FROM orders WHERE status = 'active'"];

      queries.forEach(query => {
        expect(validator.isReadOnlyQuery(query)).toBe(true);
      });
    });

    it("should identify SHOW queries as read-only", () => {
      const queries = ["SHOW TABLES", "show databases", "SHOW COLUMNS FROM users"];

      queries.forEach(query => {
        expect(validator.isReadOnlyQuery(query)).toBe(true);
      });
    });

    it("should identify DESCRIBE queries as read-only", () => {
      const queries = ["DESCRIBE users", "desc customers", "DESCRIBE TABLE orders"];

      queries.forEach(query => {
        expect(validator.isReadOnlyQuery(query)).toBe(true);
      });
    });

    it("should identify EXPLAIN queries as read-only", () => {
      const queries = ["EXPLAIN SELECT * FROM users", "explain plan for SELECT COUNT(*) FROM orders"];

      queries.forEach(query => {
        expect(validator.isReadOnlyQuery(query)).toBe(true);
      });
    });

    it("should identify CTE queries as read-only", () => {
      const query = "WITH user_stats AS (SELECT COUNT(*) as total FROM users) SELECT * FROM user_stats";
      expect(validator.isReadOnlyQuery(query)).toBe(true);
    });

    it("should identify non-read-only queries", () => {
      const queries = ["INSERT INTO users VALUES (1, 'John')", "UPDATE users SET name = 'Jane' WHERE id = 1", "DELETE FROM users WHERE id = 1", "DROP TABLE users", "CREATE TABLE test (id INT)"];

      queries.forEach(query => {
        expect(validator.isReadOnlyQuery(query)).toBe(false);
      });
    });
  });

  describe("getQueryType", () => {
    it("should identify SELECT query type", () => {
      expect(validator.getQueryType("SELECT * FROM users")).toBe("SELECT");
      expect(validator.getQueryType("  select id from customers  ")).toBe("SELECT");
    });

    it("should identify CTE as SELECT query type", () => {
      expect(validator.getQueryType("WITH cte AS (SELECT 1) SELECT * FROM cte")).toBe("SELECT");
    });

    it("should identify SHOW query type", () => {
      expect(validator.getQueryType("SHOW TABLES")).toBe("SHOW");
      expect(validator.getQueryType("show databases")).toBe("SHOW");
    });

    it("should identify DESCRIBE query type", () => {
      expect(validator.getQueryType("DESCRIBE users")).toBe("DESCRIBE");
      expect(validator.getQueryType("DESC customers")).toBe("DESCRIBE");
    });

    it("should identify EXPLAIN query type", () => {
      expect(validator.getQueryType("EXPLAIN SELECT * FROM users")).toBe("EXPLAIN");
    });

    it("should identify OTHER query types", () => {
      const queries = ["INSERT INTO users VALUES (1)", "UPDATE users SET name = 'test'", "DELETE FROM users", "CREATE TABLE test (id INT)"];

      queries.forEach(query => {
        expect(validator.getQueryType(query)).toBe("OTHER");
      });
    });
  });

  describe("QuerySchema", () => {
    it("should validate valid SQL strings", () => {
      const validQueries = ["SELECT * FROM users", "SHOW TABLES", "DESCRIBE users"];

      validQueries.forEach(sql => {
        const result = QuerySchema.parse({ sql });
        expect(result.sql).toBe(sql);
      });
    });

    it("should reject empty strings", () => {
      expect(() => QuerySchema.parse({ sql: "" })).toThrow();
    });

    it("should reject whitespace-only strings", () => {
      expect(() => QuerySchema.parse({ sql: "   " })).toThrow();
    });

    it("should reject extremely long strings", () => {
      const longSQL = "SELECT * FROM users WHERE " + "x".repeat(100000);
      expect(() => QuerySchema.parse({ sql: longSQL })).toThrow();
    });

    it("should reject suspicious patterns", () => {
      const suspiciousQueries = ["SELECT * FROM users; DROP TABLE users;", "SELECT * FROM users UNION SELECT password FROM admin"];

      suspiciousQueries.forEach(sql => {
        expect(() => QuerySchema.parse({ sql })).toThrow();
      });
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle non-string input gracefully", () => {
      const invalidInputs = [null, undefined, 123, {}, []];

      invalidInputs.forEach(input => {
        expect(() => validator.validateQuery(input)).toThrow();
      });
    });

    it("should provide detailed error information", () => {
      try {
        validator.validateQuery({ sql: "" });
      } catch (error) {
        const validationError = error as ValidationError;
        expect(validationError.code).toBe("VALIDATION_ERROR");
        expect(validationError.message).toBe("SQL validation failed");
        expect(validationError.details).toHaveProperty("field");
        expect(validationError.details).toHaveProperty("issues");
        expect(Array.isArray(validationError.details.issues)).toBe(true);
      }
    });

    it("should handle complex valid queries", () => {
      const complexQuery = `
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
      `;

      const result = validator.validateQuery({ sql: complexQuery });
      expect(result.sql).toContain("SELECT");
      expect(result.sql).toContain("FROM users u");
    });

    it("should handle queries with various SQL functions", () => {
      const functionalQueries = [
        "SELECT CURRENT_TIMESTAMP()",
        "SELECT DATE_TRUNC('day', created_at) FROM users",
        "SELECT REGEXP_REPLACE(name, '[0-9]', '') FROM users",
        "SELECT JSON_EXTRACT_PATH_TEXT(metadata, 'key') FROM events",
      ];

      functionalQueries.forEach(query => {
        expect(() => validator.validateQuery({ sql: query })).not.toThrow();
      });
    });
  });
});
