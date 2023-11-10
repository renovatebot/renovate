import {
  createURLFromHostOrURL,
  ensurePathPrefix,
  ensureTrailingSlash,
  getQueryString,
  joinUrlParts,
  parseLinkHeader,
  parseUrl,
  replaceUrlPath,
  resolveBaseUrl,
  trimSlashes,
  trimTrailingSlash,
  validateUrl,
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

  it('validates URLs', () => {
    expect(validateUrl(undefined)).toBeFalse();
    expect(validateUrl('')).toBeFalse();
    expect(validateUrl(null)).toBeFalse();
    expect(validateUrl('foo')).toBeFalse();
    expect(validateUrl('ssh://github.com')).toBeFalse();
    expect(validateUrl('http://github.com')).toBeTrue();
    expect(validateUrl('https://github.com')).toBeTrue();
    expect(validateUrl('https://github.com', false)).toBeTrue();
  });

  it('parses URL', () => {
    expect(parseUrl(null)).toBeNull();
    expect(parseUrl(undefined)).toBeNull();

    const url = parseUrl('https://github.com/renovatebot/renovate');
    expect(url?.protocol).toBe('https:');
    expect(url?.host).toBe('github.com');
    expect(url?.pathname).toBe('/renovatebot/renovate');
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
});
