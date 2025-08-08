/**
 * SQL validation layer using Zod schemas
 */

import { z, ZodError } from "zod";
import type { QueryRequest, ValidationError } from "../types/index.js";

/**
 * Zod schema for SQL query validation
 */
export const QuerySchema = z.object({
  sql: z
    .string()
    .min(1, "SQL query cannot be empty")
    .max(100000, "SQL query is too long (max 100,000 characters)")
    .refine(sql => sql.trim().length > 0, "SQL query cannot contain only whitespace")
    .refine(sql => !containsSuspiciousPatterns(sql), "SQL query contains potentially dangerous patterns")
    .describe("The SQL query to run on Snowflake"),
});

/**
 * Check for suspicious SQL patterns that might indicate injection attempts
 */
function containsSuspiciousPatterns(sql: string): boolean {
  const suspiciousPatterns = [
    // Multiple statements (basic check)
    /;\s*(?:DROP|DELETE|UPDATE|INSERT|CREATE|ALTER|TRUNCATE)\s+/i,
    // Comment-based injection attempts
    /--\s*['"]/,
    /\/\*.*\*\/.*['"]/,
    // Union-based injection
    /UNION\s+(?:ALL\s+)?SELECT.*FROM/i,
    // Stacked queries with dangerous operations
    /;\s*(?:EXEC|EXECUTE|SP_|XP_)/i,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(sql));
}

/**
 * SQL Validator class for validating and sanitizing SQL input
 */
export class SQLValidator {
  /**
   * Validate a query request using Zod schema
   */
  validateQuery(input: unknown): QueryRequest {
    try {
      const result = QuerySchema.parse(input);
      return {
        sql: this.sanitizeSQL(result.sql),
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw this.createValidationError(error);
      }
      throw error;
    }
  }

  /**
   * Validate raw SQL string
   */
  validateSQL(sql: unknown): string {
    try {
      const result = QuerySchema.parse({ sql });
      return this.sanitizeSQL(result.sql);
    } catch (error) {
      if (error instanceof ZodError) {
        throw this.createValidationError(error);
      }
      throw error;
    }
  }

  /**
   * Sanitize SQL input by trimming whitespace and normalizing
   */
  private sanitizeSQL(sql: string): string {
    return (
      sql
        .trim()
        // Normalize whitespace
        .replace(/\s+/g, " ")
        // Remove trailing semicolons (Snowflake doesn't require them)
        .replace(/;\s*$/, "")
    );
  }

  /**
   * Create a structured validation error from ZodError
   */
  private createValidationError(zodError: ZodError): ValidationError {
    const issues = zodError.errors.map(error => {
      const path = error.path.join(".");
      return `${path}: ${error.message}`;
    });

    return {
      code: "VALIDATION_ERROR",
      message: "SQL validation failed",
      details: {
        ...(zodError.errors[0]?.path.length && {
          field: zodError.errors[0].path.join("."),
        }),
        ...((zodError.errors[0] as any)?.received !== undefined && {
          value: (zodError.errors[0] as any).received,
        }),
        issues,
      },
    };
  }

  /**
   * Check if SQL is a read-only query (SELECT, SHOW, DESCRIBE, EXPLAIN)
   */
  isReadOnlyQuery(sql: string): boolean {
    const readOnlyPatterns = [
      /^\s*SELECT\s+/i,
      /^\s*SHOW\s+/i,
      /^\s*DESCRIBE\s+/i,
      /^\s*DESC\s+/i,
      /^\s*EXPLAIN\s+/i,
      /^\s*WITH\s+.*\s+SELECT\s+/i, // CTE queries
    ];

    return readOnlyPatterns.some(pattern => pattern.test(sql.trim()));
  }

  /**
   * Extract query type from SQL
   */
  getQueryType(sql: string): string {
    const trimmedSQL = sql.trim().toUpperCase();

    if (trimmedSQL.startsWith("SELECT") || trimmedSQL.startsWith("WITH")) {
      return "SELECT";
    } else if (trimmedSQL.startsWith("SHOW")) {
      return "SHOW";
    } else if (trimmedSQL.startsWith("DESCRIBE") || trimmedSQL.startsWith("DESC")) {
      return "DESCRIBE";
    } else if (trimmedSQL.startsWith("EXPLAIN")) {
      return "EXPLAIN";
    } else {
      return "OTHER";
    }
  }
}
