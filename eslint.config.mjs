import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "audit-output/**",
    "output/**",
    "backups/delivery-checkpoints/**",
    "next-env.d.ts",
    // Node maintenance scripts (outside Next/TS app scope):
    "keep-alive.js",
    "keep-alive-enhanced.js",
    "scripts/*.js",
    "scripts/*.cjs",
  ]),
]);

export default eslintConfig;
