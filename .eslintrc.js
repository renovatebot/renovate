module.exports = {
    'env': {
      'node': true,
    },
    'extends': [
      'airbnb-base',
    ],
    'plugins': [
        'import',
        'promise',
    ],
    'rules': {
      'no-use-before-define': 0,
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
