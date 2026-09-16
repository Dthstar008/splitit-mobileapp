// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // backend/ has its own separate eslint.config.js (a plain Node/Express
    // project, not Expo/React Native) — without this it gets linted with
    // Expo-specific rules that don't apply to it (expo/no-dynamic-env-var)
    // and its jest.mock()-before-imports pattern trips import/first.
    ignores: ["dist/*", "backend/**"],
  }
]);
