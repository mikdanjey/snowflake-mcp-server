/**
 * Resource handler for Snowflake queries
 * Coordinates validation, execution, and response formatting
 */

import type { QueryRequest, QueryResponse, ErrorResponse, ValidationError } from "../types/index.js";
import { SnowflakeClient, type QueryResult } from "../clients/snowflake-client.js";
import { SQLValidator } from "../validators/sql-validator.js";
import { createComponentLogger, ErrorHandler } from "../utils/index.js";

export class SnowflakeResourceHandler {
  private readonly client: SnowflakeClient;
  private readonly validator: SQLValidator;
  private readonly logger = createComponentLogger("SnowflakeResourceHandler");

  constructor(client: SnowflakeClient, validator: SQLValidator) {
    this.client = client;
    this.validator = validator;
  }

  /**
   * Handle a query request with validation, execution, and response formatting
   */
  async handleQuery(request: unknown): Promise<QueryResponse | ErrorResponse> {
    const startTime = Date.now();

    try {
      this.logger.info("Processing query request", {
        operation: "handleQuery",
      });

      // Validate the request
      let validatedRequest: QueryRequest;
      try {
        validatedRequest = this.validator.validateQuery(request);
      } catch (error) {
        return ErrorHandler.handleValidationError(error as ValidationError, {
          operation: "handleQuery",
          phase: "validation",
        });
      }

      // Get query statistics for optimization
      const queryStats = await this.getQueryStats(validatedRequest.sql);

      // Determine timeout based on query complexity
      const timeout = this.calculateQueryTimeout(queryStats.estimatedComplexity);

      // Execute the query with timeout and async handling
      let queryResult: QueryResult;
      try {
        this.logger.debug("Executing validated query", {
          operation: "handleQuery",
          phase: "execution",
          queryType: queryStats.queryType,
          isReadOnly: queryStats.isReadOnly,
          estimatedComplexity: queryStats.estimatedComplexity,
          timeout,
        });

        queryResult = await this.client.execute(validatedRequest.sql, {
          timeout,
          priority: this.getQueryPriority(queryStats.estimatedComplexity),
        });
      } catch (error) {
        return ErrorHandler.handleExecutionError(error as Error, {
          operation: "handleQuery",
          phase: "execution",
          sql: validatedRequest.sql,
          timeout,
          queryComplexity: queryStats.estimatedComplexity,
        });
      }

      // Format successful response
      const executionTime = Date.now() - startTime;
      const response = this.formatSuccessResponse(queryResult, executionTime);

      this.logger.info("Query processed successfully", {
        operation: "handleQuery",
        rowCount: response.rowCount,
        executionTime: response.executionTime,
        totalTime: Date.now() - startTime,
        queryComplexity: queryStats.estimatedComplexity,
      });

      return response;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return ErrorHandler.handleInternalError(error as Error, {
        operation: "handleQuery",
        phase: "unexpected",
        executionTime,
      });
    }
  }

  /**
   * Calculate query timeout based on complexity
   */
  private calculateQueryTimeout(complexity: "low" | "medium" | "high"): number {
    switch (complexity) {
      case "low":
        return 15000; // 15 seconds
      case "medium":
        return 60000; // 1 minute
      case "high":
        return 300000; // 5 minutes
      default:
        return 30000; // 30 seconds default
    }
  }

  /**
   * Get query priority based on complexity
   */
  private getQueryPriority(complexity: "low" | "medium" | "high"): "low" | "normal" | "high" {
    switch (complexity) {
      case "low":
        return "high"; // Simple queries get high priority
      case "medium":
        return "normal";
      case "high":
        return "low"; // Complex queries get low priority to not block others
      default:
        return "normal";
    }
  }

  /**
   * Format successful query response
   */
  private formatSuccessResponse(queryResult: QueryResult, executionTime: number): QueryResponse {
    return {
      rows: queryResult.rows,
      rowCount: queryResult.rowCount,
      executionTime,
      metadata: {
        columns: queryResult.columns,
      },
    };
  }

  /**
   * Get query execution statistics
   */
  async getQueryStats(sql: string): Promise<{
    queryType: string;
    isReadOnly: boolean;
    estimatedComplexity: "low" | "medium" | "high";
  }> {
    const queryType = this.validator.getQueryType(sql);
    const isReadOnly = this.validator.isReadOnlyQuery(sql);

    // Simple complexity estimation based on query characteristics
    let estimatedComplexity: "low" | "medium" | "high" = "low";

    const sqlUpper = sql.toUpperCase();
    if (sqlUpper.includes("JOIN") || sqlUpper.includes("UNION")) {
      estimatedComplexity = "medium";
    }
    if (sqlUpper.includes("WINDOW") || sqlUpper.includes("OVER (") || sqlUpper.includes("RECURSIVE") || sqlUpper.includes("PIVOT") || (sqlUpper.match(/JOIN/g) || []).length > 2) {
      estimatedComplexity = "high";
    }

    return {
      queryType,
      isReadOnly,
      estimatedComplexity,
    };
  }

  /**
   * Validate query without executing it
   */
  async validateQueryOnly(request: unknown): Promise<{
    isValid: boolean;
    error?: ValidationError;
    stats?: {
      queryType: string;
      isReadOnly: boolean;
      estimatedComplexity: "low" | "medium" | "high";
    };
  }> {
    try {
      const validatedRequest = this.validator.validateQuery(request);
      const stats = await this.getQueryStats(validatedRequest.sql);

      return {
        isValid: true,
        stats,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error as ValidationError,
      };
    }
  }
}
