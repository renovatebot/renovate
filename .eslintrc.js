module.exports = {
  env: {
    node: true,
  },
  extends: [
    'airbnb-base',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'prettier/@typescript-eslint',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 9,
    project: './tsconfig.json',
  },
  plugins: ['import', 'promise', '@typescript-eslint'],
  rules: {
    'require-await': 'error',
    'no-use-before-define': 0,
    'no-restricted-syntax': 0,
    'no-await-in-loop': 0,
    'prefer-destructuring': 'off',
    'prefer-template': 'off',
    'promise/always-return': 'error',
    'promise/no-return-wrap': 'error',
    'promise/param-names': 'error',
    'promise/catch-or-return': 'error',
    'promise/no-native': 'off',
    'promise/no-nesting': 'warn',
    'promise/no-promise-in-callback': 'warn',
    'promise/no-callback-in-promise': 'warn',
    'promise/avoid-new': 'warn',
    'no-underscore-dangle': 0,

    // TODO: fix lint
    '@typescript-eslint/camelcase': 'off', // disabled until ??
    '@typescript-eslint/no-var-requires': 'off', // disable until all files converted to typescript
    '@typescript-eslint/no-use-before-define': 'off', // disable until all files converted to typescript
    '@typescript-eslint/explicit-member-accessibility': 0,
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/interface-name-prefix': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-non-null-assertion': 0,
  },
  overrides: [
    {
      files: ['*.spec.js', '*.spec.ts'],
      rules: {
        'global-require': 0,
        'prefer-promise-reject-errors': 0,
      },
    },
  ],
  settings: {
    'import/resolver': {
      node: {
        paths: ['lib'],
        extensions: ['.js', '.ts'],
      },
    },
  },
};
