module.exports = {
    'env': {
      'node': true,
    },
    'extends': [
      'airbnb-base',
      'prettier',
    ],
    'plugins': [
      'import',
      'promise',
      'prettier',
    ],
    'rules': {
      'no-use-before-define': 0,
      'no-restricted-syntax': 0,
      'no-await-in-loop': 0,
      'prettier/prettier': ['error', { 'trailingComma': 'es5', 'singleQuote': true }],
      'promise/always-return': 'error',
      'promise/no-return-wrap': 'error',
      'promise/param-names': 'error',
      'promise/catch-or-return': 'error',
      'promise/no-native': 'off',
      'promise/no-nesting': 'warn',
      'promise/no-promise-in-callback': 'warn',
      'promise/no-callback-in-promise': 'warn',
      'promise/avoid-new': 'warn'
    }
};
