import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "data/**", "coverage/**", "mtg-edge-lord.user.js"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node } },
    rules: {
      "no-console": "off",
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
    }
  },
  {
    files: ["src/userscript/**/*.js"],
    languageOptions: { globals: { ...globals.browser, GM_xmlhttpRequest: "readonly", GM: "readonly" } }
  }
];
