import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierPlugin from "eslint-plugin-prettier";

export default [
  { ignores: ["dist/", "node_modules/", "coverage/", "*.js", "*.d.ts", "*.tsbuildinfo", "eslint-report.json"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { prettier: prettierPlugin },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/no-unused-vars": ["off", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "no-console": "off",
      "prefer-const": "error",
      "no-var": "error",
      "no-unused-vars": "off",
    },
  },
  // src override (kept strict if you like)
  {
    files: ["src/**/*.ts"],
    languageOptions: { parserOptions: { project: "./tsconfig.json" } },
  },
  // tests override — turn off the noisy rules here
  {
    files: ["tests/**/*.ts"],
    languageOptions: { parserOptions: { project: "./tsconfig.test.json" } },
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
    },
  },
];
