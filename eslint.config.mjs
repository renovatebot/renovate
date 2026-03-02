import eslintContainerbase from '@containerbase/eslint-plugin';
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import * as importX from 'eslint-plugin-import-x';
import oxlint from 'eslint-plugin-oxlint';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintContainerbase.configs.all,
  {
    ...jsFiles,

    extends: [importX.flatConfigs.recommended, importX.flatConfigs.typescript],

    languageOptions: {
      globals: {
        ...globals.node,
      },

      ecmaVersion: 'latest',
      sourceType: 'module',

      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: true,
      },
    },

    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({ project: 'tsconfig.json' }),
      ],
    },
  },

  eslintConfigPrettier,
  {
    ...jsFiles,
    rules: {
      // ESLint-exclusive rules (not available in oxlint/biome):
      'import-x/no-unresolved': [
        'error',
        {
          ignore: ['^mdast$'],
        },
      ],

      'import-x/no-restricted-paths': [
        2,
        {
          zones: [
            {
              target: 'lib/**/*.ts',
              from: 'tools/**/*.ts',
              message: 'Importing the `tools/*` files is not allowed',
            },
          ],
        },
      ],

      // Disabled rules (intentionally turned off)
      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/no-non-null-assertion': 0,
      '@typescript-eslint/no-unsafe-assignment': 0,
      '@typescript-eslint/no-unsafe-member-access': 0,
      '@typescript-eslint/no-unsafe-return': 0,
      '@typescript-eslint/no-unsafe-call': 0,
      '@typescript-eslint/no-unsafe-argument': 0,
      'import-x/no-named-as-default-member': 0,
      '@typescript-eslint/unbound-method': 0,
      '@typescript-eslint/no-floating-promises': 0,
    },
  },
  {
    files: ['**/*.spec.ts', 'test/**'],

    languageOptions: {
      globals: {
        ...globals.vitest,
      },
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
