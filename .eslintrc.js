module.exports = {
  root: true,
  env: {
    node: true,
  },
  plugins: ['@renovate', 'typescript-enum', 'jest-formatting'],
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:jest/recommended',
    'plugin:jest/style',
    // https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/eslint-plugin/src/configs
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:promise/recommended',
    'plugin:jest-formatting/recommended',
  ],
  parserOptions: {
    ecmaVersion: 9,
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.lint.json'],
    extraFileExtensions: ['.mjs'],
  },
  rules: {
    /*
     * checks done by typescript.
     *
     * https://github.com/typescript-eslint/typescript-eslint/blob/master/docs/getting-started/linting/FAQ.md#eslint-plugin-import
     * required for esm check
     */
    'import/default': 2,
    'import/named': 2,
    'import/namespace': 2,
    'import/no-named-as-default-member': 0,
    'import/no-extraneous-dependencies': [
      'error',
      { devDependencies: ['test/**/*', '**/*.spec.ts'] },
    ],
    'import/prefer-default-export': 0, // no benefit

    'import/no-cycle': 2, // cycles don't work when moving to esm

    /*
     * This rule is not needed since the project uses typescript and the rule
     * `@typescript-eslint/explicit-function-return-type`.
     *
     * Any non-exhaustive definition of the function will therefore result in a
     * typescript TS2366 error.
     */
    'consistent-return': 0,

    // other rules
    eqeqeq: 'error',
    'no-console': 'error',
    'no-negated-condition': 'error',
    'no-param-reassign': 'error',
    'no-template-curly-in-string': 'error',
    'sort-imports': [
      'error',
      {
        ignoreCase: false,
        ignoreDeclarationSort: true, // conflicts with our other import ordering rules
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
      },
    ],

    // mdast is a types only package `@types/mdast`
    'import/no-unresolved': ['error', { ignore: ['^mdast$'] }],
    'import/order': [
      'error',
      {
        alphabetize: {
          order: 'asc',
        },
      },
    ],

    // disallow direct `nock` module usage as it causes memory issues.
    // disallow `parse-link-header` to allow override ENV https://github.com/thlorenz/parse-link-header#environmental-variables
    // disallow `path` in favor of `upath`
    'no-restricted-imports': [
      2,
      { paths: ['nock', 'parse-link-header', 'path'] },
    ],

    '@typescript-eslint/consistent-type-assertions': [
      'error',
      { assertionStyle: 'as', objectLiteralTypeAssertions: 'allow' },
    ],

    // Makes no sense to allow type inference for expression parameters, but require typing the response
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      { allowExpressions: true, allowTypedFunctionExpressions: true },
    ],

    // TODO: fix lint
    '@typescript-eslint/no-explicit-any': 0,
    // TODO: https://github.com/renovatebot/renovate/discussions/22198
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
    // next 2 rules disabled due to https://github.com/microsoft/TypeScript/issues/20024
    '@typescript-eslint/no-unsafe-assignment': 0,
    '@typescript-eslint/no-unsafe-member-access': 0,

    // TODO: fix me
    '@typescript-eslint/no-unsafe-return': 0,
    '@typescript-eslint/no-unsafe-call': 0,
    '@typescript-eslint/no-unsafe-argument': 0, // thousands of errors :-/

    '@typescript-eslint/restrict-template-expressions': [
      2,
      { allowNumber: true, allowBoolean: true },
    ],
    '@typescript-eslint/restrict-plus-operands': 2,

    '@typescript-eslint/naming-convention': [
      2,
      {
        selector: 'enumMember',
        format: ['PascalCase'],
      },
    ],

    '@typescript-eslint/unbound-method': [2, { ignoreStatic: true }],
    '@typescript-eslint/ban-types': 2,
    '@renovate/jest-root-describe': 2,

    'typescript-enum/no-const-enum': 2,
    'typescript-enum/no-enum': 2,
    'object-shorthand': [
      'error',
      'always',
      {
        avoidQuotes: true,
      },
    ],
  },
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts'],
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true, // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`
        project: 'tsconfig.lint.json',
      },
    },
  },
  overrides: [
    {
      // files to check, so no `--ext` is required
      files: ['**/*.{js,mjs,cjs,ts}'],
    },
    {
      files: ['**/*.spec.ts', 'test/**'],
      env: {
        jest: true,
      },
      rules: {
        'no-template-curly-in-string': 0,
        'prefer-destructuring': 0,
        'prefer-promise-reject-errors': 0,
        'import/no-dynamic-require': 0,
        'global-require': 0,

        '@typescript-eslint/no-var-requires': 0,
        '@typescript-eslint/no-object-literal-type-assertion': 0,
        '@typescript-eslint/explicit-function-return-type': 0,
        '@typescript-eslint/unbound-method': 0,

        'jest/valid-title': [0, { ignoreTypeOfDescribeName: true }],
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
      env: {
        node: true,
      },
      rules: {
        'import/no-extraneous-dependencies': [
          'error',
          { devDependencies: true },
        ],
        'no-console': 'off',
      },
    },
    {
      files: ['tools/**/*.{js,cjs}', 'bin/*.{js,cjs}'],
      rules: {
        // need commonjs
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      files: ['*.mjs'],
      rules: {
        // esm always requires extensions
        'import/extensions': 0,
      },
    },
  ],
};
