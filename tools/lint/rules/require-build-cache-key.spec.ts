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
    `memCache.get(buildCacheKey('jsonata', hash));`,
    `memCache.set(cacheKey, value);`,
    `memCache.set('lookup-stats', data);`,
    `withCache({ namespace, key: config.registryUrl! }, fn);`,
    // other operators and expressions
    `withCache({ namespace, key: a - b }, fn);`,
    `withCache({ namespace, key: a ?? b }, fn);`,
    `withCache({ namespace, key: isDefault ? packageName : url }, fn);`,
    `withCache({ namespace, key: (a as string) || b }, fn);`,
    `withCache({ namespace, key: key satisfies string }, fn);`,
    // options we cannot see into or other properties
    'withCache(options, fn);',
    'withCache();',
    'withCache({ ...options, namespace: `datasource-${id}` }, fn);',
    'withCache({ [key]: `${a}:${b}` }, fn);',
    // calls and joins which are not an array literal join
    'withCache({ namespace, key: getKey(a, b) }, fn);',
    "withCache({ namespace, key: parts.join(':') }, fn);",
    "withCache({ namespace, key: [a, b]['join'](':') }, fn);",
    'withCache({ namespace, key: [a, b].at(0) }, fn);',
    // calls which do not take a cache key
    'other.cached({ key: `${a}:${b}` }, fn);',
    'class Foo { #cached(): void {} run(): void { this.#cached({ key: `${a}:${b}` }, fn); } }',
    "this['cached']({ key: `${a}:${b}` }, fn);",
    'packageCache.cleanup(`${a}:${b}`);',
    'memCache.init(`${a}:${b}`);',
    'memCache.set(key, `${a}:${b}`);',
    'other.memCache.get(`${a}:${b}`);',
    'packageCache.get(`${a}:${b}`, key);',
    'withRetry({ key: `${a}:${b}` }, fn);',
    'getFactory()({ key: `${a}:${b}` });',
    'cache({ namespace, key: `${a}:${b}` });',
    // functions which do not return a cache key
    'function getUrl(a: string): string { return `${a}/b`; }',
    'const getUrl = (a: string): string => `${a}/b`;',
    'const getUrl = function (a: string): string { return `${a}/b`; };',
    'class Foo { getUrl(a: string): string { return `${a}/b`; } }',
    'class Foo { [getCacheKey](a: string): string { return `${a}/b`; } }',
    'class Foo { [getCacheKey] =(a: string): string => `${a}:b`; }',
    'class Foo { getUrl = (a: string): string => `${a}/b`; }',
    'const x = { [getCacheKey]: (a: string) => `${a}:b` };',
    'const x = { getUrl: (a: string) => `${a}/b` };',
    'const x = { [getCacheKey]: fn((a: string) => `${a}:b`) };',
    'const { length } = (a: string): string => `${a}:b`;',
    'return `${a}:b`;',
    'items.map((a) => `${a}:b`);',
    'export default function (a: string): string { return `${a}:b`; }',
    'function getCacheKey(a: string): string { return buildCacheKey(a, b); }',
    'function getCacheKey(): void { return; }',
    'function getCacheKey(a: string): string { const f = () => { return `${a}:b`; }; return f(); }',
    // variables and class properties which do not hold a cache key
    'const cacheKey = buildCacheKey(registryUrl, packageName);',
    'const cacheKey = getCacheKey(registryUrl);',
    "const memKey = 'all';",
    'let cacheKey;',
    'const url = `${a}/b`;',
    'const cacheKeyType = `${a}:b`;',
    'const lockKey = `${a}:b`;',
    'const { cacheKey } = { cacheKey: `${a}:b` };',
    'class Foo { cacheKey; }',
    "class Foo { private static readonly cacheKey = 'OnboardingState'; }",
    'class Foo { [cacheKey] = `${a}:b`; }',
    'class Foo { url = `${a}/b`; }',
    'class Foo { #url = `${a}/b`; }',
    'const key = `${a}:b`;',
    // assignments to targets which do not hold a cache key
    'url = `${a}/b`;',
    'key = `${a}:b`;',
    'this.url = `${a}/b`;',
    'this[cacheKey] = `${a}:b`;',
    '[cacheKey] = [`${a}:b`];',
    'cacheKey = buildCacheKey(a, b);',
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
      code: 'memCache.get(`jsonata:${hash}`);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: "memCache.set('crate-datasource/' + url, value);",
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'withCache({ namespace, key: a ?? `${url}:${packageName}` }, fn);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'withCache({ namespace, key: `${url}:${packageName}` || a }, fn);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'withCache({ namespace, key: a && `${url}:${packageName}` }, fn);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'withCache({ namespace, key: `${url}:${packageName}` as string }, fn);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'withCache({ namespace, key: (url + packageName)! }, fn);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'withCache({ namespace, key: `${url}:${packageName}` satisfies string }, fn);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'withCache({ namespace, key: <string>`${url}:${packageName}` }, fn);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'const cacheKey = `${registryUrl}:${packageName}`; memCache.get(cacheKey);',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: "let memKey = 'crate-datasource:' + url;",
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'const memCacheKey = isDefault ? url : `${url}:${packageName}`;',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'const syncedCacheKey = `${platform}-synced`;',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'class Foo { private cacheKey = `${a}:b`; }',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'class Foo { static memKey = `${a}:b` as string; }',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'class Foo { getCacheKey = `${a}:b`; }',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'class Foo { private cacheKey = (a: string): string => `${a}:b`; }',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'class Foo { getCacheKey = function (a: string): string { return `${a}:b`; }; }',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'const x = { getCacheKey: (a: string) => `${a}:b` };',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'const x = { getCacheKey(a: string): string { return `${a}:b`; } };',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'const { getCacheKey } = { getCacheKey: (a: string) => `${a}:b` };',
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
    // string literal and computed string literal names
    {
      code: "withCache({ 'key': `${a}:${b}` }, fn);",
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: "withCache({ ['key']: `${a}:${b}` }, fn);",
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: "class Foo { 'getCacheKey'(a: string): string { return `${a}/b`; } }",
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: "class Foo { 'cacheKey' = `${a}:b`; }",
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: "const x = { ['getCacheKey']: (a: string) => `${a}:b` };",
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    // named function expressions
    {
      code: 'const getCacheKey = function build(a: string): string { return `${a}:b`; };',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'class Foo { getCacheKey = function inner(a: string): string { return `${a}:b`; }; }',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'const x = { build: function getCacheKey(a: string): string { return `${a}:b`; } };',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    // private members
    {
      code: 'class Foo { #getCacheKey(a: string): string { return `${a}/b`; } }',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'class Foo { #cacheKey = `${a}:b`; }',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    // assignments
    {
      code: 'let cacheKey; cacheKey = `${a}:b`;',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: "memKey = a + ':' + b;",
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'class Foo { run(): void { this.cacheKey = `${a}:b`; } }',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: 'class Foo { #cacheKey; run(): void { this.#cacheKey = `${a}:b`; } }',
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    // array literal joins
    {
      code: "withCache({ namespace, key: [registryUrl, packageName].join(':') }, fn);",
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: "packageCache.get(namespace, [url, type].join(':'));",
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: "memCache.set([a, b].join('-'), value);",
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: "function getCacheKey(a: string): string { return [a, 'b'].join(':'); }",
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: "const cacheKey = [a, b].join(':');",
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
    {
      code: "class Foo { run(): void { this.cacheKey = [a, b].join(':'); } }",
      errors: [{ messageId: 'requireBuildCacheKey' }],
    },
  ],
});
