const globals = require("globals");

const tsParser = require('@typescript-eslint/parser');
const tsEslintPlugin = require('@typescript-eslint/eslint-plugin');
const js = require("@eslint/js");

const theConfig = {
  languageOptions: {
    globals: {
      ...globals.browser,
    },
    parser: tsParser,
    parserOptions: {
      project: './tsconfig.json',
      ecmaVersion: 'next',
      sourceType: 'module',
      ecaFeatures: {
        jsx: true,
      },
    },
  },
  files: ["src/**/*.{ts,tsx}"],
  rules: {
    curly: 'error',
    eqeqeq: ['error', 'smart'],

    'require-await': 'error',
    'no-await-in-loop': 'error',

    'padding-line-between-statements': [
      'error',
      {blankLine: 'always', prev: 'multiline-const', next: 'multiline-const'},
      {blankLine: 'always', prev: '*', next: 'function'},
      {blankLine: 'always', prev: '*', next: 'class'},
      {blankLine: 'always', prev: '*', next: 'export'},
    ],

    'no-use-before-define': 'off',

    'no-unused-vars': 'off',

  },
};

module.exports = [
  js.configs.recommended,
  {
    plugins: {
      "@typescript-eslint": tsEslintPlugin,
    },
    rules: {
      ...tsEslintPlugin.configs.recommended.rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',

      // 要検討
      '@typescript-eslint/no-unsafe-assignment': 'off',
      // voidとのunionで微妙な挙動をするので一旦停止
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false,
        },
      ],

      '@typescript-eslint/no-use-before-define': ['error'],
      '@typescript-eslint/prefer-readonly': 'error',
      // '@typescript-eslint/prefer-readonly-parameter-types': ["error", {ignoreInferredTypes: true}],
      '@typescript-eslint/array-type': ['error', {default: 'generic', readonly: 'generic'}],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'none',
          ignoreRestSiblings: true,

          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

    },
  },
  theConfig,
];