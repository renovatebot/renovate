const base = require('./.eslintrc');

module.exports = {
  ...base,
  extends: [
    'airbnb-base',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'prettier/@typescript-eslint',
  ],
  parserOptions: {
    project: './tsconfig.json',
  },
  plugins: [...base.plugins, '@typescript-eslint'],
  rules: {
    ...base.rules,

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
      files: ['*.spec.ts'],
      rules: {
        'global-require': 0,
        'prefer-promise-reject-errors': 0,
      },
    },
  ],
};
