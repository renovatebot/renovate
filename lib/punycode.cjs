/**
 * punycode workaround
 *
 * Load punycode.js module to cache and override node built-in.
 *
 * See <https://github.com/renovatebot/renovate/issues/32395>
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('punycode/');
require.cache.punycode = require.cache[require.resolve('punycode/')];
