import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/** @type {import('eslint').Linter.Config[]} */
const config = [
  ...nextCoreWebVitals,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "out/**",
      "build/**",
      "test-results/**",
      "playwright-report/**",
      "supabase/functions/**",
      "scripts/**",
      "taste/**",
      "design-systems/**",
      "components/**",
      "accessibility/**",
      "workflows/**",
      "frameworks/**",
      "content/**",
      "site/**",
      "docs/**",
      ".agents/**",
      ".claude/**",
      ".od-skills/**",
      "Logo/**",
      "tokens/**",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}", "e2e/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/invariant": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/no-deriving-state-in-effects": "warn",
      "react/no-unescaped-entities": "warn",
      "@next/next/no-page-custom-font": "off",
    },
  },
];

export default config;
