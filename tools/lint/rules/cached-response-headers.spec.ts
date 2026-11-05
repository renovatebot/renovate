import path from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { persistedResponseHeaders } from '../../../lib/util/http/cache/persisted-headers.ts';
import rule, { persistedHeaders } from './cached-response-headers.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const repoRoot = path.resolve(import.meta.dirname, '../../..');

const datasourceFile = path.join(
  repoRoot,
  'lib/modules/datasource/foo/index.ts',
);
const cacheFile = path.join(
  repoRoot,
  'lib/util/http/cache/foo-http-cache-provider.ts',
);
const wrapperFile = path.join(repoRoot, 'lib/util/http/foo.ts');

const importRepoCacheProvider = `import { repoCacheProvider } from '../../../util/http/cache/repository-http-cache-provider.ts';`;
const importPackageCacheProvider = `import { PackageHttpCacheProvider } from '../../../util/http/cache/package-http-cache-provider.ts';`;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
  cwd: repoRoot,
});

describe('tools/lint/rules/cached-response-headers', () => {
  it('keeps the same header list as the cache providers', () => {
    expect(persistedHeaders).toEqual(persistedResponseHeaders);
  });

  ruleTester.run('cached-response-headers', rule, {
    valid: [
      // persisted headers may be read
      {
        code: `${importRepoCacheProvider}\nconst next = res.headers.link;`,
        filename: datasourceFile,
      },
      {
        code: `${importPackageCacheProvider}\nconst ts = res?.headers?.['last-modified'];`,
        filename: datasourceFile,
      },
      {
        code: `const etag = resp.headers?.etag;`,
        filename: cacheFile,
      },
      {
        code: `${importRepoCacheProvider}\nconst { deprecation, sunset, link } = res.headers;`,
        filename: datasourceFile,
      },
      // persisted headers may be read from `headers` destructured from a response
      {
        code: `${importRepoCacheProvider}\nconst { headers } = res;\nconst next = headers.link;\nconst tag = headers['etag'];`,
        filename: datasourceFile,
      },
      {
        code: `${importRepoCacheProvider}\nconst { headers: { etag, link } } = res;`,
        filename: datasourceFile,
      },
      // a variable of the same name in another scope is not bound to the response headers
      {
        code: `${importRepoCacheProvider}\nconst { headers } = res;\nfunction auth(headers) {\n  return headers.authorization;\n}`,
        filename: datasourceFile,
      },
      // headers destructured from a request or an error response are not checked
      {
        code: `${importRepoCacheProvider}\nconst { headers } = options;\nconst auth = headers.authorization;`,
        filename: datasourceFile,
      },
      {
        code: `${importRepoCacheProvider}\nconst { headers } = err.response;\nconst retry = headers['retry-after'];`,
        filename: datasourceFile,
      },
      {
        code: `${importRepoCacheProvider}\nconst { headers = {} } = res;`,
        filename: datasourceFile,
      },
      // persisted headers may be read through an alias of the response headers, or a binding with a default value
      {
        code: `${importRepoCacheProvider}\nconst headers = res.headers;\nconst next = headers.link;`,
        filename: datasourceFile,
      },
      {
        code: `${importRepoCacheProvider}\nconst { headers = {} } = res;\nconst tag = headers.etag;`,
        filename: datasourceFile,
      },
      {
        code: `${importRepoCacheProvider}\nconst headers = options.headers;\nconst auth = headers.authorization;`,
        filename: datasourceFile,
      },
      {
        code: `${importRepoCacheProvider}\nconst headers = { accept: 'application/json' };\nconst accept = headers.accept;`,
        filename: datasourceFile,
      },
      // persisted headers may be destructured from a variable bound to response headers
      {
        code: `${importRepoCacheProvider}\nconst h = res.headers;\nconst { etag, link } = h;`,
        filename: datasourceFile,
      },
      {
        code: `${importRepoCacheProvider}\nconst { headers } = res;\nconst h2 = headers;\nconst { link } = h2;`,
        filename: datasourceFile,
      },
      {
        code: `${importRepoCacheProvider}\nconst h = options.headers;\nconst { authorization } = h;`,
        filename: datasourceFile,
      },
      // request headers are not response headers
      {
        code: `${importRepoCacheProvider}\nconst auth = options.headers.authorization;`,
        filename: datasourceFile,
      },
      {
        code: `${importRepoCacheProvider}\nconst { accept } = opts.headers;`,
        filename: datasourceFile,
      },
      {
        code: `${importRepoCacheProvider}\nconst { date } = res.body;`,
        filename: datasourceFile,
      },
      {
        code: `opts.headers['If-None-Match'] = etag;`,
        filename: cacheFile,
      },
      // an error response never comes from the cache
      {
        code: `${importRepoCacheProvider}\nconst retry = err.response.headers['retry-after'];`,
        filename: datasourceFile,
      },
      {
        code: `${importRepoCacheProvider}\nconst { date } = error.response.headers;`,
        filename: datasourceFile,
      },
      // a dynamic name cannot be checked
      {
        code: `${importRepoCacheProvider}\nconst value = res.headers[name];`,
        filename: datasourceFile,
      },
      // files without a persisted cache provider only see fresh responses
      {
        code: `const remaining = res.headers['x-ratelimit-remaining'];`,
        filename: datasourceFile,
      },
      {
        code: `const remaining = res.headers['x-ratelimit-remaining'];`,
        filename: path.join(repoRoot, 'lib/modules/http/foo.ts'),
      },
      // the http wrappers may read persisted headers and error headers
      {
        code: `const total = res.headers['x-total-count'];`,
        filename: wrapperFile,
      },
      {
        code: `const next = parseLinkHeader(result?.headers?.link);`,
        filename: wrapperFile,
      },
      {
        code: `const rateLimit = err.headers?.['x-ratelimit-limit'];`,
        filename: wrapperFile,
      },
      {
        code: `import { memCacheProvider } from '../../../util/http/cache/memory-http-cache-provider.ts';\nconst digest = res.headers['docker-content-digest'];`,
        filename: datasourceFile,
      },
      // specs are exempt
      {
        code: `${importRepoCacheProvider}\nconst remaining = res.headers['x-ratelimit-remaining'];`,
        filename: path.join(
          repoRoot,
          'lib/modules/datasource/foo/index.spec.ts',
        ),
      },
    ],
    invalid: [
      {
        code: `${importRepoCacheProvider}\nconst remaining = res.headers['x-ratelimit-remaining'];`,
        filename: datasourceFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `const remaining = res.headers['x-ratelimit-remaining'];`,
        filename: wrapperFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `const { link, date } = result.headers;`,
        filename: wrapperFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `${importPackageCacheProvider}\nconst date = res.headers.date;`,
        filename: datasourceFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `import { RepositoryHttpCacheProvider } from '../../../util/http/cache/repository-http-cache-provider.ts';\nconst date = res.headers.date;`,
        filename: datasourceFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `${importRepoCacheProvider}\nconst { link, date, 'x-ratelimit-remaining': remaining } = res.headers;`,
        filename: datasourceFile,
        errors: [
          { messageId: 'headerNotPersisted' },
          { messageId: 'headerNotPersisted' },
        ],
      },
      {
        code: `${importRepoCacheProvider}\nconst { headers } = res;\nconst remaining = headers['x-ratelimit-remaining'];`,
        filename: datasourceFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `${importRepoCacheProvider}\nconst { body, headers: h } = await http.get(url);\nconst date = h.date;`,
        filename: datasourceFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `${importRepoCacheProvider}\nconst { headers: { 'x-foo': foo, link } } = res;`,
        filename: datasourceFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `${importRepoCacheProvider}\nconst headers = res.headers;\nconst remaining = headers['x-ratelimit-remaining'];`,
        filename: datasourceFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `${importRepoCacheProvider}\nconst { headers = {} } = res;\nconst date = headers.date;`,
        filename: datasourceFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `${importRepoCacheProvider}\nconst { headers: h = {} } = await http.get(url);\nconst date = h.date;`,
        filename: datasourceFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `${importRepoCacheProvider}\nconst { headers: { 'x-foo': foo } = {} } = res;`,
        filename: datasourceFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `${importRepoCacheProvider}\nconst h = res.headers;\nconst { date } = h;`,
        filename: datasourceFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `${importRepoCacheProvider}\nconst { headers } = res;\nconst { 'x-ratelimit-remaining': remaining } = headers;`,
        filename: datasourceFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `${importRepoCacheProvider}\nconst h = res.headers;\nconst h2 = h;\nconst date = h2.date;`,
        filename: datasourceFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `const cookie = resp.headers?.['set-cookie'];`,
        filename: cacheFile,
        errors: [{ messageId: 'headerNotPersisted' }],
      },
      {
        code: `class FooHttpCacheProvider extends AbstractHttpCacheProvider {\n  protected override readonly persistedHeaders = null;\n}`,
        filename: cacheFile,
        errors: [{ messageId: 'keepsAllHeaders' }],
      },
    ],
  });
});
