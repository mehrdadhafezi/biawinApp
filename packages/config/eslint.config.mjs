// Shared base ESLint flat config. App-level eslint configs (apps/web, backend, ...)
// spread this in and add their own framework-specific plugins/rules on top.
export default [
  {
    ignores: ["dist/**", ".next/**", "build/**", ".expo/**", "node_modules/**"],
  },
  {
    rules: {
      "no-unused-vars": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];
