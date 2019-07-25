module.exports = {
  env: {
    jest: true,
  },
  globals: {
    platform: true,
  },
  rules: {
    'prefer-destructuring': 0,
    'prefer-promise-reject-errors': 0,
    'import/no-dynamic-require': 0,
    'import/no-extraneous-dependencies': 0,
    'import/no-named-as-default-member': 0,
    'global-require': 0,

    '@typescript-eslint/no-object-literal-type-assertion': 0,
  },
};
