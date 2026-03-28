import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import oxlint from 'eslint-plugin-oxlint';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import renovatePlugin from './tools/lint/rules.js';

const jsFiles = { files: ['**/*.{js,cjs,mjs,mts,ts}'] };

export default tseslint.config(
  {
    ignores: [
      '**/node_modules',
      '**/.pnpm-store',
      '**/dist',
      '**/coverage',
      '**/__fixtures__/**/*',
      '**/__mocks__/**/*',
      '**/*.d.ts',
      'config.js',
      '**/.clinic/',
      '**/.cache/',
      '**/*.generated.ts',
      'tools/dist',
      'patches',
      '**/tmp/',
      '**/.venv/',
      'tools/mkdocs/.cache',
      'tools/mkdocs/docs',
      'tools/mkdocs/site',
      '.github/workflows/**/*.js',
      '.worktrees/**/*',
      '.markdownlint-cli2.mjs',
      '**/.agents/**',
      '**/.claude/**',
      '**/.opencode/**',
      '**/AGENTS.md',
      '**/CLAUDE.md',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    plugins: { renovate: renovatePlugin },
    rules: {
      'renovate/no-tools-import': 'error',
      'renovate/test-root-describe': 'error',
    },
  },
  {
    ...jsFiles,

    languageOptions: {
      globals: {
        ...globals.node,
      },

      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },

  eslintConfigPrettier,
  {
    ...jsFiles,
    rules: {
      'no-restricted-imports': [
        2,
        {
          paths: ['nock', 'parse-link-header', 'path'],
        },
      ],

      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'as',
          objectLiteralTypeAssertions: 'allow',
        },
      ],

      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],

      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/no-non-null-assertion': 0,

      '@typescript-eslint/no-unused-vars': [
        2,
        {
          vars: 'all',
          args: 'none',
          ignoreRestSiblings: true,
        },
      ],

      '@typescript-eslint/no-empty-object-type': [
        2,
        {
          allowInterfaces: 'with-single-extends',
        },
      ],

      'object-shorthand': [
        'error',
        'always',
        {
          avoidQuotes: true,
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', 'test/**'],

    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },

    rules: {
      'prefer-destructuring': 0,
      'prefer-promise-reject-errors': 0,
      'global-require': 0,
      '@typescript-eslint/no-var-requires': 0,
      '@typescript-eslint/no-object-literal-type-assertion': 0,
      '@typescript-eslint/explicit-function-return-type': 0,
      'max-classes-per-file': 0,
      'class-methods-use-this': 0,
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],

    rules: {
      '@typescript-eslint/explicit-function-return-type': 0,
      '@typescript-eslint/explicit-module-boundary-types': 0,
    },
  },
  {
    files: [
      '*.config.{cjs,cts,js,mjs,mts,ts}',
      'tools/**/*.{cjs,cts,js,mjs,mts,ts}',
      '.markdownlint-cli.mjs',
    ],

    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['tools/**/*.{js,cjs}', 'bin/*.{js,cjs}'],

    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
  {
    files: ['tools/docs/test/**/*.mjs'],

    languageOptions: {
      globals: {
        ...Object.fromEntries(
          Object.entries(globals.vitest).map(([key]) => [key, 'off']),
        ),
      },
    },
  },

  // Disable ESLint rules that oxlint handles (must be last).
  // This reads .oxlintrc.json and turns off corresponding ESLint rules,
  // avoiding duplicate diagnostics while allowing gradual migration to oxlint.
  ...oxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
);
