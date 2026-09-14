import {
  createURLFromHostOrURL,
  ensurePathPrefix,
  ensureTrailingSlash,
  getQueryString,
  isHttpUrl,
  joinUrlParts,
  massageHostUrl,
  parseLinkHeader,
  parseUrl,
  replaceUrlPath,
  resolveBaseUrl,
  resolveSameOriginUrl,
  trimSlashes,
  trimTrailingSlash,
} from './url.ts';

describe('util/url', () => {
  it.each`
    baseUrl                 | x                       | result
    ${'http://foo.io'}      | ${''}                   | ${'http://foo.io'}
    ${'http://foo.io/'}     | ${''}                   | ${'http://foo.io'}
    ${'http://foo.io'}      | ${'/'}                  | ${'http://foo.io/'}
    ${'http://foo.io/'}     | ${'/'}                  | ${'http://foo.io/'}
    ${'http://foo.io'}      | ${'/aaa'}               | ${'http://foo.io/aaa'}
    ${'http://foo.io'}      | ${'aaa'}                | ${'http://foo.io/aaa'}
    ${'http://foo.io/'}     | ${'/aaa'}               | ${'http://foo.io/aaa'}
    ${'http://foo.io/'}     | ${'aaa'}                | ${'http://foo.io/aaa'}
    ${'http://foo.io'}      | ${'/aaa/'}              | ${'http://foo.io/aaa/'}
    ${'http://foo.io'}      | ${'aaa/'}               | ${'http://foo.io/aaa/'}
    ${'http://foo.io/'}     | ${'/aaa/'}              | ${'http://foo.io/aaa/'}
    ${'http://foo.io/'}     | ${'aaa/'}               | ${'http://foo.io/aaa/'}
    ${'http://foo.io/aaa'}  | ${'/bbb'}               | ${'http://foo.io/aaa/bbb'}
    ${'http://foo.io/aaa'}  | ${'bbb'}                | ${'http://foo.io/aaa/bbb'}
    ${'http://foo.io/aaa/'} | ${'/bbb'}               | ${'http://foo.io/aaa/bbb'}
    ${'http://foo.io/aaa/'} | ${'bbb'}                | ${'http://foo.io/aaa/bbb'}
    ${'http://foo.io/aaa'}  | ${'/bbb/'}              | ${'http://foo.io/aaa/bbb/'}
    ${'http://foo.io/aaa'}  | ${'bbb/'}               | ${'http://foo.io/aaa/bbb/'}
    ${'http://foo.io/aaa/'} | ${'/bbb/'}              | ${'http://foo.io/aaa/bbb/'}
    ${'http://foo.io/aaa/'} | ${'bbb/'}               | ${'http://foo.io/aaa/bbb/'}
    ${'http://foo.io'}      | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io/'}     | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io/aaa'}  | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io/aaa/'} | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io'}      | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io/'}     | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io/aaa'}  | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io/aaa/'} | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io'}      | ${'aaa?bbb=z'}          | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io'}      | ${'/aaa?bbb=z'}         | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io/'}     | ${'aaa?bbb=z'}          | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io/'}     | ${'/aaa?bbb=z'}         | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io'}      | ${'aaa/?bbb=z'}         | ${'http://foo.io/aaa?bbb=z'}
  `('$baseUrl + $x => $result', ({ baseUrl, x, result }) => {
    expect(resolveBaseUrl(baseUrl, x)).toBe(result);
  });

  it.each`
    baseUrl                 | x                       | result
    ${'http://foo.io'}      | ${''}                   | ${'http://foo.io'}
    ${'http://foo.io/'}     | ${''}                   | ${'http://foo.io'}
    ${'http://foo.io'}      | ${'/'}                  | ${'http://foo.io/'}
    ${'http://foo.io/'}     | ${'/'}                  | ${'http://foo.io/'}
    ${'http://foo.io'}      | ${'/aaa'}               | ${'http://foo.io/aaa'}
    ${'http://foo.io'}      | ${'aaa'}                | ${'http://foo.io/aaa'}
    ${'http://foo.io/'}     | ${'/aaa'}               | ${'http://foo.io/aaa'}
    ${'http://foo.io/'}     | ${'aaa'}                | ${'http://foo.io/aaa'}
    ${'http://foo.io'}      | ${'/aaa/'}              | ${'http://foo.io/aaa/'}
    ${'http://foo.io'}      | ${'aaa/'}               | ${'http://foo.io/aaa/'}
    ${'http://foo.io/'}     | ${'/aaa/'}              | ${'http://foo.io/aaa/'}
    ${'http://foo.io/'}     | ${'aaa/'}               | ${'http://foo.io/aaa/'}
    ${'http://foo.io/aaa'}  | ${'/bbb'}               | ${'http://foo.io/bbb'}
    ${'http://foo.io/aaa'}  | ${'bbb'}                | ${'http://foo.io/bbb'}
    ${'http://foo.io/aaa/'} | ${'/bbb'}               | ${'http://foo.io/bbb'}
    ${'http://foo.io/aaa/'} | ${'bbb'}                | ${'http://foo.io/bbb'}
    ${'http://foo.io/aaa'}  | ${'/bbb/'}              | ${'http://foo.io/bbb/'}
    ${'http://foo.io/aaa'}  | ${'bbb/'}               | ${'http://foo.io/bbb/'}
    ${'http://foo.io/aaa/'} | ${'/bbb/'}              | ${'http://foo.io/bbb/'}
    ${'http://foo.io/aaa/'} | ${'bbb/'}               | ${'http://foo.io/bbb/'}
    ${'http://foo.io'}      | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io/'}     | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io/aaa'}  | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io/aaa/'} | ${'http://bar.io/bbb'}  | ${'http://bar.io/bbb'}
    ${'http://foo.io'}      | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io/'}     | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io/aaa'}  | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io/aaa/'} | ${'http://bar.io/bbb/'} | ${'http://bar.io/bbb/'}
    ${'http://foo.io'}      | ${'aaa?bbb=z'}          | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io'}      | ${'/aaa?bbb=z'}         | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io/'}     | ${'aaa?bbb=z'}          | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io/'}     | ${'/aaa?bbb=z'}         | ${'http://foo.io/aaa?bbb=z'}
    ${'http://foo.io'}      | ${'aaa/?bbb=z'}         | ${'http://foo.io/aaa?bbb=z'}
  `('replaceUrlPath("$baseUrl", "$x") => $result', ({ baseUrl, x, result }) => {
    expect(replaceUrlPath(baseUrl, x)).toBe(result);
    expect(replaceUrlPath(parseUrl(baseUrl)!, x)).toBe(result);
  });

  it('getQueryString', () => {
    expect(getQueryString({ a: 1, b: [1, 2] })).toBe('a=1&b=1&b=2');
  });

  it('validates http-based URLs', () => {
    expect(isHttpUrl(undefined)).toBeFalse();
    expect(isHttpUrl('')).toBeFalse();
    expect(isHttpUrl(null)).toBeFalse();
    expect(isHttpUrl('foo')).toBeFalse();
    expect(isHttpUrl('ssh://github.com')).toBeFalse();
    expect(isHttpUrl('http://github.com')).toBeTrue();
    expect(isHttpUrl('https://github.com')).toBeTrue();
    expect(isHttpUrl(parseUrl('https://github.com')!)).toBeTrue();
  });

  it('parses URL', () => {
    expect(parseUrl(null)).toBeNull();
    expect(parseUrl(undefined)).toBeNull();

    const url = parseUrl('https://github.com/renovatebot/renovate');
    expect(url?.protocol).toBe('https:');
    expect(url?.host).toBe('github.com');
    expect(url?.pathname).toBe('/renovatebot/renovate');
    expect(parseUrl(url)).toBe(url);
  });

  it('trimTrailingSlash', () => {
    expect(trimTrailingSlash('foo')).toBe('foo');
    expect(trimTrailingSlash('/foo/bar')).toBe('/foo/bar');
    expect(trimTrailingSlash('foo/')).toBe('foo');
    expect(trimTrailingSlash('foo//////')).toBe('foo');
  });

  it('trimSlashes', () => {
    expect(trimSlashes('foo')).toBe('foo');
    expect(trimSlashes('/foo')).toBe('foo');
    expect(trimSlashes('foo/')).toBe('foo');
    expect(trimSlashes('//////foo//////')).toBe('foo');
    expect(trimSlashes('foo/bar')).toBe('foo/bar');
    expect(trimSlashes('/foo/bar')).toBe('foo/bar');
    expect(trimSlashes('foo/bar/')).toBe('foo/bar');
    expect(trimSlashes('/foo/bar/')).toBe('foo/bar');
  });

  it('ensureTrailingSlash', () => {
    expect(ensureTrailingSlash('')).toBe('/');
    expect(ensureTrailingSlash('/')).toBe('/');
  });

  it('ensures path prefix', () => {
    expect(ensurePathPrefix('https://index.docker.io', '/v2')).toBe(
      'https://index.docker.io/v2/',
    );
    expect(ensurePathPrefix('https://index.docker.io/v2', '/v2')).toBe(
      'https://index.docker.io/v2',
    );
    expect(
      ensurePathPrefix('https://index.docker.io/v2/something', '/v2'),
    ).toBe('https://index.docker.io/v2/something');
    expect(ensurePathPrefix('https://index.docker.io:443', '/v2')).toBe(
      'https://index.docker.io/v2/',
    );
    expect(
      ensurePathPrefix('https://index.docker.io/something?with=query', '/v2'),
    ).toBe('https://index.docker.io/v2/something?with=query');
  });

  it('joinUrlParts', () => {
    const registryUrl = 'https://some.test';
    expect(joinUrlParts(registryUrl, 'foo')).toBe(`${registryUrl}/foo`);
    expect(joinUrlParts(registryUrl, '/?foo')).toBe(`${registryUrl}?foo`);
    expect(joinUrlParts(registryUrl, '/foo/bar/')).toBe(
      `${registryUrl}/foo/bar/`,
    );
    expect(joinUrlParts(`${registryUrl}/foo/`, '/foo/bar')).toBe(
      `${registryUrl}/foo/foo/bar`,
    );
    expect(joinUrlParts(`${registryUrl}/api/`, '/foo/bar')).toBe(
      `${registryUrl}/api/foo/bar`,
    );
    expect(joinUrlParts('foo//////')).toBe('foo/');
  });

  it('createURLFromHostOrURL', () => {
    expect(createURLFromHostOrURL('https://some.test')).toEqual(
      parseUrl('https://some.test/')!,
    );
    expect(createURLFromHostOrURL('some.test')).toEqual(
      parseUrl('https://some.test/')!,
    );
  });

  it('parseLinkHeader', () => {
    expect(parseLinkHeader(null)).toBeNull();
    expect(parseLinkHeader(' '.repeat(2001))).toBeNull();
    expect(
      parseLinkHeader(
        '<https://api.github.com/user/9287/repos?page=3&per_page=100>; rel="next",' +
          '<https://api.github.com/user/9287/repos?page=1&per_page=100>; rel="prev"; pet="cat", ' +
          '<https://api.github.com/user/9287/repos?page=5&per_page=100>; rel="last"',
      ),
    ).toStrictEqual({
      next: {
        page: '3',
        per_page: '100',
        rel: 'next',
        url: 'https://api.github.com/user/9287/repos?page=3&per_page=100',
      },
      prev: {
        page: '1',
        per_page: '100',
        rel: 'prev',
        pet: 'cat',
        url: 'https://api.github.com/user/9287/repos?page=1&per_page=100',
      },
      last: {
        page: '5',
        per_page: '100',
        rel: 'last',
        url: 'https://api.github.com/user/9287/repos?page=5&per_page=100',
      },
    });
  });

  it('massageHostUrl', () => {
    expect(massageHostUrl('domain.com')).toBe('domain.com');
    expect(massageHostUrl('domain.com:8080')).toBe('https://domain.com:8080');
    expect(massageHostUrl('domain.com/some/path')).toBe(
      'https://domain.com/some/path',
    );
    expect(massageHostUrl('https://domain.com')).toBe('https://domain.com');
  });

  describe('resolveSameOriginUrl', () => {
    it('resolves a same-origin absolute URL', () => {
      expect(
        resolveSameOriginUrl(
          'https://registry.example.com/v2/foo/tags/list?n=10',
          'https://registry.example.com/v2/foo/tags/list?n=10&last=z',
        ),
      ).toBe('https://registry.example.com/v2/foo/tags/list?n=10&last=z');
    });

    it('upgrades an HTTP URL to HTTPS when the host is the same', () => {
      expect(
        resolveSameOriginUrl(
          'https://community.chocolatey.org/api/v2/FindPackagesById',
          'http://community.chocolatey.org/api/v2/FindPackagesById?page=2',
        ),
      ).toBe('https://community.chocolatey.org/api/v2/FindPackagesById?page=2');
    });

    it('does not upgrade HTTP to HTTPS when the next URL has a non-standard port', () => {
      expect(
        resolveSameOriginUrl(
          'https://community.chocolatey.org/api/v2/FindPackagesById',
          'http://community.chocolatey.org:8080/api/v2/FindPackagesById?page=2',
        ),
      ).toBeNull();
    });

    it('rejects a different port on the same host', () => {
      expect(
        resolveSameOriginUrl(
          'https://registry.example.com:8443/v2/foo',
          'https://registry.example.com/v2/foo?page=2',
        ),
      ).toBeNull();
    });

    it('resolves a relative next URL against the base', () => {
      expect(
        resolveSameOriginUrl(
          'https://registry.example.com/v2/foo/tags/list?n=10',
          '/v2/foo/tags/list?n=10&last=z',
        ),
      ).toBe('https://registry.example.com/v2/foo/tags/list?n=10&last=z');
    });

    it('rejects a cross-origin next URL', () => {
      expect(
        resolveSameOriginUrl(
          'https://registry.example.com/v2/foo/tags/list?n=10',
          'https://attacker.example.com/v2/steal/tags/list',
        ),
      ).toBeNull();
    });

    it('rejects when the base URL is invalid', () => {
      expect(
        resolveSameOriginUrl('not a url', 'https://registry.example.com/next'),
      ).toBeNull();
    });

    it('rejects when the next URL is invalid', () => {
      expect(
        resolveSameOriginUrl('https://registry.example.com/v2/', 'http://'),
      ).toBeNull();
    });

    it('accepts a URL instance as the base', () => {
      expect(
        resolveSameOriginUrl(
          parseUrl('https://registry.example.com/v2/foo?n=10')!,
          'https://registry.example.com/v2/foo?n=10&page=2',
        ),
      ).toBe('https://registry.example.com/v2/foo?n=10&page=2');
    });
  });
});
