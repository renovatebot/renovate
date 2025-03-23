import eslintContainerbase from '@containerbase/eslint-plugin';
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginImport from 'eslint-plugin-import';
import vitest from '@vitest/eslint-plugin';
import eslintPluginPromise from 'eslint-plugin-promise';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
      'tools/mkdocs/docs',
      'tools/mkdocs/site',

      // TODO: fix me
      'eslint.config.mjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintPluginImport.flatConfigs.errors,
  eslintPluginImport.flatConfigs.warnings,
  eslintPluginImport.flatConfigs.recommended,
  eslintPluginImport.flatConfigs.typescript,
  eslintPluginPromise.configs['flat/recommended'],
  eslintContainerbase.configs.all,
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },

    languageOptions: {
      globals: {
        ...globals.node,
      },

      ecmaVersion: 'latest',
      sourceType: 'module',

      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: true,
        extraFileExtensions: ['.mjs'],
      },
    },

    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts'],
      },

      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
  },

  eslintConfigPrettier,
  {
    files: ['**/*.{ts,js,cjs,mjs}'],
    rules: {
      'import/default': 2,
      'import/named': 2,
      'import/namespace': 2,
      'import/no-named-as-default-member': 0,

      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '*.config.mjs',
            '*.config.ts',
            'test/**/*',
            '**/*.spec.ts',
          ],
        },
      ],

      'import/prefer-default-export': 0,
      'import/no-cycle': 2,
      'consistent-return': 0,
      eqeqeq: 'error',
      'no-console': 'error',
      'no-negated-condition': 'error',
      'no-param-reassign': 'error',
      'no-template-curly-in-string': 'error',

      'sort-imports': [
        'error',
        {
          ignoreCase: false,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
        },
      ],

      'import/no-unresolved': [
        'error',
        {
          ignore: ['^mdast$'],
        },
      ],

      'import/order': [
        'error',
        {
          alphabetize: {
            order: 'asc',
          },
        },
      ],

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

      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          disallowTypeAnnotations: false,
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

      '@typescript-eslint/prefer-optional-chain': 2,
      '@typescript-eslint/prefer-nullish-coalescing': 2,
      curly: [2, 'all'],
      'require-await': 2,
      '@typescript-eslint/no-unsafe-assignment': 0,
      '@typescript-eslint/no-unsafe-member-access': 0,
      '@typescript-eslint/no-unsafe-return': 0,
      '@typescript-eslint/no-unsafe-call': 0,
      '@typescript-eslint/no-unsafe-argument': 0,

      '@typescript-eslint/restrict-template-expressions': [
        2,
        {
          allowNumber: true,
          allowBoolean: true,
        },
      ],

      '@typescript-eslint/restrict-plus-operands': 2,

      '@typescript-eslint/naming-convention': [
        2,
        {
          selector: 'enumMember',
          format: ['PascalCase'],
        },
      ],

      '@typescript-eslint/unbound-method': [
        2,
        {
          ignoreStatic: true,
        },
      ],

      '@typescript-eslint/no-empty-object-type': [
        2,
        {
          allowInterfaces: 'with-single-extends',
        },
      ],

      // TODO: not compatible with recent versions of typescript-eslint
      // 'typescript-enum/no-const-enum': 2,
      // 'typescript-enum/no-enum': 2,

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

    plugins: { vitest },

    languageOptions: {
      globals: {
        ...globals.vitest,
      },
    },

    settings: {
      vitest: {
        typecheck: true,
      },
    },

    rules: {
      ...vitest.configs.recommended.rules,
      'no-template-curly-in-string': 0,
      'prefer-destructuring': 0,
      'prefer-promise-reject-errors': 0,
      'import/no-dynamic-require': 0,
      'global-require': 0,
      '@typescript-eslint/no-var-requires': 0,
      '@typescript-eslint/no-object-literal-type-assertion': 0,
      '@typescript-eslint/explicit-function-return-type': 0,
      '@typescript-eslint/unbound-method': 0,
      'max-classes-per-file': 0,
      'class-methods-use-this': 0,
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],

    rules: {
      '@typescript-eslint/explicit-function-return-type': 0,
      '@typescript-eslint/explicit-module-boundary-types': 0,
      '@typescript-eslint/restrict-template-expressions': 0,
    },
  },
  {
    files: ['tools/**/*.{ts,js,mjs,cjs}'],

    languageOptions: {
      globals: {
        ...globals.node,
      },
    },

    rules: {
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: true,
        },
      ],

      'no-console': 'off',
    },
  },
  {
    files: ['tools/**/*.{js,cjs}', 'bin/*.{js,cjs}'],

    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
  {
    files: ['**/*.mjs'],

    rules: {
      'import/extensions': 0,
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

    rules: {
      '@typescript-eslint/no-floating-promises': 0,
    },
  },
);
