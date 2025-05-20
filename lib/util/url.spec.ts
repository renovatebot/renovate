import {
  createURLFromHostOrURL,
  ensurePathPrefix,
  ensureTrailingSlash,
  getFilenameFromPath,
  getQueryString,
  isHttpUrl,
  joinUrlParts,
  massageHostUrl,
  parseLinkHeader,
  parseUrl,
  replaceUrlPath,
  resolveBaseUrl,
  trimSlashes,
  trimTrailingSlash,
} from './url';

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
    expect(replaceUrlPath(new URL(baseUrl), x)).toBe(result);
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
    expect(isHttpUrl(new URL('https://github.com'))).toBeTrue();
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
      new URL('https://some.test/'),
    );
    expect(createURLFromHostOrURL('some.test')).toEqual(
      new URL('https://some.test/'),
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

  it('getFilenameFromPath handles regular paths', () => {
    expect(getFilenameFromPath('file.txt')).toBe('file.txt');
    expect(getFilenameFromPath('/path/to/file.txt')).toBe('file.txt');
    expect(getFilenameFromPath('path/to/file.txt')).toBe('file.txt');
    expect(getFilenameFromPath('/path/to/file')).toBe('file');
    expect(getFilenameFromPath('/path/to/')).toBe('');
    expect(getFilenameFromPath('/')).toBe('');
  });

  it('getFilenameFromPath handles URLs', () => {
    expect(getFilenameFromPath('https://example.com/file.txt')).toBe(
      'file.txt',
    );
    expect(getFilenameFromPath('https://example.com/path/to/file.txt')).toBe(
      'file.txt',
    );
    expect(getFilenameFromPath('https://example.com/path/to/file')).toBe(
      'file',
    );
    expect(getFilenameFromPath('https://example.com/path/to/')).toBe('');
    expect(getFilenameFromPath('https://example.com/')).toBe('');
  });

  it('getFilenameFromPath handles URL-encoded paths', () => {
    expect(
      getFilenameFromPath('https://example.com/file%20with%20spaces.txt'),
    ).toBe('file with spaces.txt');
    expect(
      getFilenameFromPath(
        'https://example.com/path/to/file%20with%20spaces.txt',
      ),
    ).toBe('file with spaces.txt');
    expect(
      getFilenameFromPath('https://example.com/%40special%23chars.txt'),
    ).toBe('@special#chars.txt');
    expect(
      getFilenameFromPath(
        'https://example.com/path%2Fwith%2Fencoded%2Fslashes.txt',
      ),
    ).toBe('path/with/encoded/slashes.txt');
    expect(getFilenameFromPath('/path/to/file%20with%20spaces.txt')).toBe(
      'file with spaces.txt',
    );
    expect(getFilenameFromPath('file%20with%20spaces.txt')).toBe(
      'file with spaces.txt',
    );
  });

  it('getFilenameFromPath handles URLs with query parameters', () => {
    expect(
      getFilenameFromPath('https://example.com/file.txt?param=value'),
    ).toBe('file.txt');
    expect(
      getFilenameFromPath(
        'https://example.com/path/to/file.txt?param=value&another=123',
      ),
    ).toBe('file.txt');
    expect(getFilenameFromPath('/path/to/file.txt?param=value')).toBe(
      'file.txt',
    );
    expect(getFilenameFromPath('file.txt?param=value')).toBe('file.txt');
  });

  it('getFilenameFromPath handles invalid URLs gracefully', () => {
    expect(getFilenameFromPath('http://[invalid')).toBe('[invalid');
    expect(getFilenameFromPath('not a url or path')).toBe('not a url or path');
    expect(getFilenameFromPath('')).toBe('');
  });
});
