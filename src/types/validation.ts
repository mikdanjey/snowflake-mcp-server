/**
 * Validation interfaces and types for the Snowflake MCP Server
 */

export interface QueryRequest {
  sql: string;
}

export interface QueryResponse {
  rows: Record<string, any>[];
  rowCount: number;
  executionTime: number;
  metadata?: {
    columns: ColumnMetadata[];
  };
}

export interface ColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
}

export interface ValidationError {
  code: "VALIDATION_ERROR";
  message: string;
  details: {
    field?: string;
    value?: any;
    issues: string[];
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export interface MCPErrorResponse extends ErrorResponse {
  error: {
    code: string;
    message: string;
    details: {
      category: string;
      severity: string;
      suggestion?: string;
      timestamp: string;
      [key: string]: any;
    };
  };
}
