/* Classic config keeps Phase 0 simple; flat config can come later if needed. */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, browser: true, es2022: true },
  ignorePatterns: ['dist', 'build', 'node_modules', '.wrangler', '*.config.ts', '*.config.js'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Allow intentional `while (true) { ... break }` stream-read loops.
    'no-constant-condition': ['error', { checkLoops: false }],
    // Prettier owns semicolons. In a no-semi codebase it emits a leading `;` before a line opening
    // with `(` or `[`, which is an ASI guard, not an extra semicolon.
    'no-extra-semi': 'off',
  },
}
