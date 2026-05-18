module.exports = [
  {
    files: ["src/**/*.js", "ui/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        Blob: "readonly",
        FMG: "readonly",
        OffscreenCanvas: "readonly",
        URLSearchParams: "readonly",
        URL: "readonly",
        cancelAnimationFrame: "readonly",
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        globalThis: "readonly",
        indexedDB: "readonly",
        localStorage: "readonly",
        location: "readonly",
        performance: "readonly",
        queueMicrotask: "readonly",
        requestAnimationFrame: "readonly",
        sessionStorage: "readonly",
        setTimeout: "readonly",
        structuredClone: "readonly",
        window: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
    }
  }
];
