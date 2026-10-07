import { RuleTester } from 'oxlint/plugins-dev';
import rule from './require-build-cache-key.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

ruleTester.run('require-build-cache-key', rule, {
  valid: [
    // keys built with the helper, plain values and constants
    `withCache({ namespace, key: buildCacheKey(registryUrl, packageName) }, fn);`,
    `withCache({ namespace, key: packageName }, fn);`,
    `withCache({ namespace, key: config.packageName }, fn);`,
    `withCache({ namespace, key: 'all' }, fn);`,
    'withCache({ namespace, key: `all` }, fn);',
    `withCache({ namespace, key }, fn);`,
    `this.cached({ key: this.getCacheKey(registryUrl, repo, 'tags') }, fn);`,
    `packageCache.get(namespace, cacheKey);`,
    `packageCache.set(namespace, buildCacheKey(url, type), value, 60);`,
    `packageCache.setWithRawTtl(namespace, url, value, 60);`,
    `@cache({ namespace, key: (url: string) => buildCacheKey('get', url) }) class Foo {}`,
    '@cache({ namespace, key: (url: string) => { return `get:${url}`; } }) class Foo {}',
    // other operators and expressions
    `withCache({ namespace, key: a - b }, fn);`,
    `withCache({ namespace, key: a ?? b }, fn);`,
    `withCache({ namespace, key: isDefault ? packageName : url }, fn);`,
    // options we cannot see into or other properties
    'withCache(options, fn);',
    'withCache();',
    'withCache({ ...options, namespace: `datasource-${id}` }, fn);',
    'withCache({ [key]: `${a}:${b}` }, fn);',
    "withCache({ 'key': `${a}:${b}` }, fn);",
    // calls which do not take a cache key
    'other.cached({ key: `${a}:${b}` }, fn);',
    'class Foo { #cached(): void {} run(): void { this.#cached({ key: `${a}:${b}` }, fn); } }',
    "this['cached']({ key: `${a}:${b}` }, fn);",
    'packageCache.cleanup(`${a}:${b}`);',
    'memCache.get(`${a}:${b}`);',
    'packageCache.get(`${a}:${b}`, key);',
    'withRetry({ key: `${a}:${b}` }, fn);',
    'getFactory()({ key: `${a}:${b}` });',
    // functions which do not return a cache key
    'function getUrl(a: string): string { return `${a}/b`; }',
    'const getUrl = (a: string): string => `${a}/b`;',
    'const getUrl = function (a: string): string { return `${a}/b`; };',
    'class Foo { getUrl(a: string): string { return `${a}/b`; } }',
    'class Foo { [getCacheKey](a: string): string { return `${a}/b`; } }',
    "class Foo { 'getCacheKey'(a: string): string { return `${a}/b`; } }",
    'class Foo { #getCacheKey(a: string): string { return `${a}/b`; } }',
    'const { getCacheKey } = { getCacheKey: (a: string) => `${a}:b` };',
    'const { length } = (a: string): string => `${a}:b`;',
    'return `${a}:b`;',
    'items.map((a) => `${a}:b`);',
    'export default function (a: string): string { return `${a}:b`; }',
    'function getCacheKey(a: string): string { return buildCacheKey(a, b); }',
    'function getCacheKey(): void { return; }',
    'function getCacheKey(a: string): string { const f = () => { return `${a}:b`; }; return f(); }',
  ],
  invalid: [
    {
      code: 'withCache({ namespace, key: `${registryUrl}:${packageName}` }, fn);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'withCache({ namespace, key: `getReleases:${packageName}` }, fn);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: `withCache({ namespace, key: registryUrl + ':' + packageName }, fn);`,
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'withCache({ namespace, key: isDefault ? packageName : `${url}:${packageName}` }, fn);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'withCache({ namespace, key: isDefault ? `${url}:${packageName}` : packageName }, fn);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'this.cached({ key: `${registryUrl}:${packageName}` }, fn);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'packageCache.get(namespace, `${url}:${type}`);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'packageCache.set(namespace, `${url}:${type}`, value, 60);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'packageCache.setWithRawTtl(namespace, method + url, value, 60);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: '@cache({ namespace, key: (url: string) => `get:${url}` }) class Foo {}',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'function getCacheKey(a: string): string { return `${a}:b`; }',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'const getVersionedCacheKey = function (a: string): string { return `${a}:b`; };',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'const x = function getCacheKey(a: string): string { return a + b; };',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'const syncedCacheKey = (a: string): string => `${a}-synced`;',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'class Foo { private cacheKey(method: string, url: string): string { return `${method}:${url}`; } }',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'class Foo { static getCacheKey(a: string): string { if (a) { return `${a}:b`; } return a; } }',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
  ],
});
