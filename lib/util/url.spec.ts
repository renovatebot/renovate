import {
  createURLFromHostOrURL,
  encodeUrlPathSegments,
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

  describe('encodeUrlPathSegments', () => {
    it('encodes a space in a path segment (collection)', () => {
      expect(
        encodeUrlPathSegments(
          'https://dev.azure.com/my org/my-project/_git/my-repo/',
        ),
      ).toBe('https://dev.azure.com/my%20org/my-project/_git/my-repo/');
    });

    it('encodes a space in a path segment (project)', () => {
      expect(
        encodeUrlPathSegments(
          'https://dev.azure.com/my-org/my project/_git/my-repo/',
        ),
      ).toBe('https://dev.azure.com/my-org/my%20project/_git/my-repo/');
    });

    it('encodes a space in a path segment (repository)', () => {
      expect(
        encodeUrlPathSegments(
          'https://dev.azure.com/my-org/my-project/_git/my repo/',
        ),
      ).toBe('https://dev.azure.com/my-org/my-project/_git/my%20repo/');
    });

    it('encodes spaces in multiple path segments', () => {
      expect(
        encodeUrlPathSegments(
          'https://dev.azure.com/my org/my project/_git/my repo/',
        ),
      ).toBe('https://dev.azure.com/my%20org/my%20project/_git/my%20repo/');
    });

    it('leaves the origin untouched', () => {
      const origin = 'https://dev.azure.com:443/';
      const encoded = encodeUrlPathSegments(
        `${origin}my org/my project/_git/my repo`,
      );
      expect(encoded.startsWith('https://dev.azure.com/')).toBe(true);
    });

    it('preserves non-default ports', () => {
      const origin = 'https://azure-devops.interal.corp:8080/tfs/';
      const encoded = encodeUrlPathSegments(
        `${origin}my org/my project/_git/my repo`,
      );
      expect(encoded.startsWith(origin)).toBe(true);
    });

    it('leaves a plain URL with no special characters unchanged (regression baseline)', () => {
      expect(
        encodeUrlPathSegments(
          'https://dev.azure.com/renovate12345/some/_git/repo',
        ),
      ).toBe('https://dev.azure.com/renovate12345/some/_git/repo');
    });

    it('preserves an on-prem Azure DevOps Server collection path unchanged', () => {
      const url =
        'https://azure-devops.internal.corp:8080/tfs/DefaultCollection/my-project/_git/my-repo';
      expect(encodeUrlPathSegments(url)).toBe(url);
    });

    it('encodes a literal "%" in a path segment instead of throwing', () => {
      // A segment may contain a literal '%' that isn't part of a valid
      // percent-encoded sequence (e.g. a project named "50% off"). This must
      // not throw "URI malformed" and must behave like encodeURIComponent()
      // would have on the raw name (turning '%' into '%25').
      expect(
        encodeUrlPathSegments(
          'https://dev.azure.com/renovate12345/50% off/_git/repo',
        ),
      ).toBe('https://dev.azure.com/renovate12345/50%25%20off/_git/repo');
    });

    it('handles credentials in the URL (PAT in userinfo)', () => {
      expect(
        encodeUrlPathSegments(
          'https://pat123@dev.azure.com/my org/project name/_git/my repo',
        ),
      ).toBe(
        'https://pat123@dev.azure.com/my%20org/project%20name/_git/my%20repo',
      );
    });

    it('returns the input unchanged for an invalid URL', () => {
      expect(encodeUrlPathSegments('not a url')).toBe('not a url');
    });

    it('is idempotent - does not double-encode an already-encoded segment', () => {
      const once = encodeUrlPathSegments(
        'https://dev.azure.com/my org/my proj/_git/my repo',
      );
      const twice = encodeUrlPathSegments(once);
      expect(twice).toBe(once);
    });
  });
});
