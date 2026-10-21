import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

/**
 * Flat ESLint config.
 *
 * The project is vanilla ES modules with JSDoc types, so we lint plain JS and
 * rely on `tsc --checkJs` for type-aware feedback (see tsconfig.json).
 */
export default [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'docs/**',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // --- correctness ---
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-implicit-coercion': 'error',
      'no-param-reassign': 'error',
      'no-shadow': 'error',
      'no-return-await': 'error',
      'require-atomic-updates': 'error',
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',
      'no-else-return': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-object-spread': 'error',
      'prefer-template': 'error',
      'no-useless-concat': 'error',
      'no-lonely-if': 'error',
      'no-ternary': 'off',
      'no-restricted-globals': [
        'error',
        { name: 'event', message: 'Use the handler parameter instead of the global event.' },
        { name: 'name', message: 'Use the handler parameter instead of the global name.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'element',
          property: 'innerHTML',
          message: 'Use textContent or safe DOM builders; never assign raw HTML.',
        },
      ],

      // --- security ---
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // --- style consistency ---
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'space-infix-ops': 'error',
      'keyword-spacing': 'error',
      'comma-dangle': ['error', 'always-multiline'],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      'eol-last': ['error', 'always'],
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
      'max-len': ['error', { code: 120, ignoreUrls: true, ignoreRegExpLiterals: true }],
    },
  },

  {
    files: [
      'tests/**/*.js',
      'tests/**/*.mjs',
      'scripts/**/*.js',
      'scripts/**/*.mjs',
      '**/*.config.js',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
      'max-len': 'off',
      // An end-to-end flow is inherently sequential: each step depends on the
      // one before it. Waiting for them in parallel would test nothing.
      'no-await-in-loop': 'off',
    },
  },

  prettier,
];
