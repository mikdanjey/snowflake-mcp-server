/**
 * Build configuration for Snowflake MCP Server
 */

export default {
  // TypeScript compilation options
  typescript: {
    configFile: "tsconfig.json",
    incremental: true,
    sourceMap: process.env.NODE_ENV !== "production",
    declaration: true,
    declarationMap: true,
  },

  // Output configuration
  output: {
    directory: "dist",
    clean: true,
    preserveModules: false,
  },

  // Development configuration
  development: {
    watch: true,
    sourceMap: true,
    hotReload: false, // MCP servers don't typically support hot reload
  },

  // Production optimizations
  production: {
    minify: false, // Keep readable for debugging
    treeshake: true,
    sourceMap: false,
    removeComments: false, // Keep for debugging
  },

  // Linting configuration
  linting: {
    eslint: {
      configFile: ".eslintrc.cjs",
      extensions: [".ts"],
      fix: false,
    },
    prettier: {
      configFile: ".prettierrc",
      extensions: [".ts", ".js", ".json", ".md"],
    },
  },

  // Testing configuration
  testing: {
    jest: {
      configFile: "jest.config.js",
      coverage: {
        threshold: {
          global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
          },
        },
      },
    },
  },

  // Docker configuration
  docker: {
    baseImage: "node:20-alpine",
    workdir: "/app",
    user: "mcp",
    healthcheck: {
      interval: "30s",
      timeout: "3s",
      retries: 3,
    },
  },

  // Environment-specific settings
  environments: {
    development: {
      logLevel: "debug",
      sourceMap: true,
    },
    production: {
      logLevel: "info",
      sourceMap: false,
    },
    test: {
      logLevel: "error",
      sourceMap: true,
    },
  },
};
