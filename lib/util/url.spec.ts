import {
  ensurePathPrefix,
  joinUrlParts,
  parseUrl,
  resolveBaseUrl,
  trimTrailingSlash,
  validateUrl,
} from './url';

describe('util/url', () => {
  test.each([
    ['http://foo.io', '', 'http://foo.io'],
    ['http://foo.io/', '', 'http://foo.io'],
    ['http://foo.io', '/', 'http://foo.io/'],
    ['http://foo.io/', '/', 'http://foo.io/'],

    ['http://foo.io', '/aaa', 'http://foo.io/aaa'],
    ['http://foo.io', 'aaa', 'http://foo.io/aaa'],
    ['http://foo.io/', '/aaa', 'http://foo.io/aaa'],
    ['http://foo.io/', 'aaa', 'http://foo.io/aaa'],
    ['http://foo.io', '/aaa/', 'http://foo.io/aaa/'],
    ['http://foo.io', 'aaa/', 'http://foo.io/aaa/'],
    ['http://foo.io/', '/aaa/', 'http://foo.io/aaa/'],
    ['http://foo.io/', 'aaa/', 'http://foo.io/aaa/'],

    ['http://foo.io/aaa', '/bbb', 'http://foo.io/aaa/bbb'],
    ['http://foo.io/aaa', 'bbb', 'http://foo.io/aaa/bbb'],
    ['http://foo.io/aaa/', '/bbb', 'http://foo.io/aaa/bbb'],
    ['http://foo.io/aaa/', 'bbb', 'http://foo.io/aaa/bbb'],

    ['http://foo.io/aaa', '/bbb/', 'http://foo.io/aaa/bbb/'],
    ['http://foo.io/aaa', 'bbb/', 'http://foo.io/aaa/bbb/'],
    ['http://foo.io/aaa/', '/bbb/', 'http://foo.io/aaa/bbb/'],
    ['http://foo.io/aaa/', 'bbb/', 'http://foo.io/aaa/bbb/'],

    ['http://foo.io', 'http://bar.io/bbb', 'http://bar.io/bbb'],
    ['http://foo.io/', 'http://bar.io/bbb', 'http://bar.io/bbb'],
    ['http://foo.io/aaa', 'http://bar.io/bbb', 'http://bar.io/bbb'],
    ['http://foo.io/aaa/', 'http://bar.io/bbb', 'http://bar.io/bbb'],

    ['http://foo.io', 'http://bar.io/bbb/', 'http://bar.io/bbb/'],
    ['http://foo.io/', 'http://bar.io/bbb/', 'http://bar.io/bbb/'],
    ['http://foo.io/aaa', 'http://bar.io/bbb/', 'http://bar.io/bbb/'],
    ['http://foo.io/aaa/', 'http://bar.io/bbb/', 'http://bar.io/bbb/'],

    ['http://foo.io', 'aaa?bbb=z', 'http://foo.io/aaa?bbb=z'],
    ['http://foo.io', '/aaa?bbb=z', 'http://foo.io/aaa?bbb=z'],
    ['http://foo.io/', 'aaa?bbb=z', 'http://foo.io/aaa?bbb=z'],
    ['http://foo.io/', '/aaa?bbb=z', 'http://foo.io/aaa?bbb=z'],

    ['http://foo.io', 'aaa/?bbb=z', 'http://foo.io/aaa?bbb=z'],
  ])('%s + %s => %s', (baseUrl, x, result) => {
    expect(resolveBaseUrl(baseUrl, x)).toBe(result);
  });

  it('validates URLs', () => {
    expect(validateUrl()).toBe(false);
    expect(validateUrl(null)).toBe(false);
    expect(validateUrl('foo')).toBe(false);
    expect(validateUrl('ssh://github.com')).toBe(false);
    expect(validateUrl('http://github.com')).toBe(true);
    expect(validateUrl('https://github.com')).toBe(true);
  });

  it('parses URL', () => {
    expect(parseUrl(null)).toBeNull();
    expect(parseUrl(undefined)).toBeNull();

    const url = parseUrl('https://github.com/renovatebot/renovate');
    expect(url.protocol).toBe('https:');
    expect(url.host).toBe('github.com');
    expect(url.pathname).toBe('/renovatebot/renovate');
  });

  it('trimTrailingSlash', () => {
    expect(trimTrailingSlash('foo')).toBe('foo');
    expect(trimTrailingSlash('/foo/bar')).toBe('/foo/bar');
    expect(trimTrailingSlash('foo/')).toBe('foo');
    expect(trimTrailingSlash('foo//////')).toBe('foo');
  });

  it('ensures path prefix', () => {
    expect(ensurePathPrefix('https://index.docker.io', '/v2')).toBe(
      'https://index.docker.io/v2/'
    );
    expect(ensurePathPrefix('https://index.docker.io/v2', '/v2')).toBe(
      'https://index.docker.io/v2'
    );
    expect(
      ensurePathPrefix('https://index.docker.io/v2/something', '/v2')
    ).toBe('https://index.docker.io/v2/something');
    expect(ensurePathPrefix('https://index.docker.io:443', '/v2')).toBe(
      'https://index.docker.io/v2/'
    );
    expect(
      ensurePathPrefix('https://index.docker.io/something?with=query', '/v2')
    ).toBe('https://index.docker.io/v2/something?with=query');
  });

  it('joinUrlParts', () => {
    const registryUrl = 'https://some.test';
    expect(joinUrlParts(registryUrl, 'foo')).toBe(`${registryUrl}/foo`);
    expect(joinUrlParts(registryUrl, '/?foo')).toBe(`${registryUrl}?foo`);
    expect(joinUrlParts(registryUrl, '/foo/bar/')).toBe(
      `${registryUrl}/foo/bar/`
    );
    expect(joinUrlParts(`${registryUrl}/foo/`, '/foo/bar')).toBe(
      `${registryUrl}/foo/foo/bar`
    );
    expect(joinUrlParts(`${registryUrl}/api/`, '/foo/bar')).toBe(
      `${registryUrl}/api/foo/bar`
    );
    expect(joinUrlParts('foo//////')).toBe('foo/');
  });
});
