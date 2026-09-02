/* Classic config keeps Phase 0 simple; flat config can come later if needed. */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'jsx-a11y'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    /*
     * react's `jsx-no-comment-textnodes` is the reason these are here: a `/* *\/` comment in a JSX
     * children position is a text node, and two of them rendered on the homepage for several
     * commits with every other check green. A lint rule catches that on the keystroke.
     */
    'plugin:react/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  // Pinned, not 'detect': react lives in packages/web, so detection from the root finds nothing
  // and warns on every lint run.
  settings: { react: { version: '18' } },
  env: { node: true, browser: true, es2022: true },
  ignorePatterns: ['dist', 'build', 'node_modules', '.wrangler', '*.config.ts', '*.config.js'],
  rules: {
    // Rules of hooks and dependency arrays: real bug classes, on as errors.
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
    /*
     * The rest of eslint-plugin-react-hooks v7 is React Compiler prerequisites, and this app does
     * not build with the Compiler. They fire on deliberate patterns: syncing state to props in an
     * effect, reading Date.now() during render to grey out times that have passed. Turn them on
     * alongside adopting the Compiler, not before, or the gate is 22 findings nobody can act on.
     */
    'react-hooks/purity': 'off',
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/refs': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
    'react-hooks/use-memo': 'off',
    'react-hooks/immutability': 'off',
    'react-hooks/globals': 'off',
    'react-hooks/static-components': 'off',
    // The new JSX transform means no React import is needed, so neither of these applies.
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Allow intentional `while (true) { ... break }` stream-read loops.
    'no-constant-condition': ['error', { checkLoops: false }],
    // Prettier owns semicolons. In a no-semi codebase it emits a leading `;` before a line opening
    // with `(` or `[`, which is an ASI guard, not an extra semicolon.
    'no-extra-semi': 'off',
  },
}
