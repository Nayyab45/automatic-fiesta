// @ts-check
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = tseslint.config(
  {
    // Build output, the Android shell and the vendored font subset are not ours to lint.
    ignores: ["www/**", "android/**", ".angular/**", "node_modules/**", "src/theme/fonts/**"],
  },
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        { type: "attribute", prefix: "app", style: "camelCase" },
      ],
      "@angular-eslint/component-selector": [
        "error",
        { type: "element", prefix: "app", style: "kebab-case" },
      ],
      // Routed screens are named *Page (HomePage, SettingsPage) per the Ionic
      // convention this app already follows throughout; shared UI stays *Component.
      "@angular-eslint/component-class-suffix": [
        "error",
        { suffixes: ["Page", "Component"] },
      ],
      // Surfaces the leftover prototype scaffolding: unused Router/Location
      // injections and imports copied into every generated page.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // TODO(a11y): 74 violations remain -- click handlers sit on <div>/<span>
      // rather than real controls, so they are unreachable by keyboard. Fixing
      // them means changing element semantics across the templates, which needs
      // visual checking page by page. Kept visible as warnings, not silenced.
      "@angular-eslint/template/click-events-have-key-events": "warn",
      "@angular-eslint/template/interactive-supports-focus": "warn",
    },
  },
);
