module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    'airbnb-typescript/base',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:jest/recommended',
    'plugin:jest/style',
    // https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/eslint-plugin/src/configs
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:promise/recommended',
    'prettier',
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
     */
    'import/default': 0,
    'import/named': 0,
    'import/namespace': 0,
    'import/no-named-as-default-member': 0,

    // other rules
    'import/prefer-default-export': 0, // no benefit
    'no-restricted-syntax': 0,
    'no-await-in-loop': 0,
    'prefer-destructuring': 0,
    'prefer-template': 0,
    'no-underscore-dangle': 0,
    'no-negated-condition': 'error',
    'sort-imports': [
      'error',
      {
        ignoreCase: false,
        ignoreDeclarationSort: true, // conflicts with our other import ordering rules
        ignoreMemberSort: false,
        memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
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

    // Makes no sense to allow type inference for expression parameters, but require typing the response
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      { allowExpressions: true, allowTypedFunctionExpressions: true },
    ],

    // TODO: fix lint
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-non-null-assertion': 2,
    '@typescript-eslint/no-unused-vars': [
      2,
      {
        vars: 'all',
        args: 'none',
        ignoreRestSiblings: false,
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

    '@typescript-eslint/restrict-template-expressions': [
      1,
      { allowNumber: true, allowBoolean: true },
    ],
    '@typescript-eslint/restrict-plus-operands': 2,

    '@typescript-eslint/naming-convention': 2,

    '@typescript-eslint/unbound-method': 2,
    '@typescript-eslint/ban-types': 2,
  },
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts'],
    },
  },
  overrides: [
    {
      files: ['**/*.spec.ts', 'test/**'],
      env: {
        jest: true,
      },
      rules: {
        'prefer-destructuring': 0,
        'prefer-promise-reject-errors': 0,
        'import/no-dynamic-require': 0,
        'global-require': 0,

        '@typescript-eslint/no-var-requires': 0,
        '@typescript-eslint/no-object-literal-type-assertion': 0,
        '@typescript-eslint/explicit-function-return-type': 0,
        '@typescript-eslint/unbound-method': 0,

        'jest/valid-title': [0, { ignoreTypeOfDescribeName: true }],
      },
    },
    {
      files: ['**/*.mjs'],

      rules: {
        '@typescript-eslint/explicit-function-return-type': 0,
        '@typescript-eslint/explicit-module-boundary-types': 0,
        '@typescript-eslint/restrict-template-expressions': 0,
      },
    },
  ],
};
