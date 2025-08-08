#!/usr/bin/env node

/**
 * Main application entry point for the Snowflake MCP Server
 */
import dotenv from "dotenv";
dotenv.config({ debug: false });

import { Application } from "./application.js";

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const app = new Application();

  // Setup shutdown handlers before starting
  app.setupShutdownHandlers();

  // Start the application
  await app.start();
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});

export { Application };
