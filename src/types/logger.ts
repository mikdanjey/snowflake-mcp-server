/**
 * Logger interfaces and types
 */

export interface LogContext {
  component: string;
  operation?: string;
  [key: string]: any;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}
