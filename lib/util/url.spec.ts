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
  trimLeadingSlash,
  trimSlashes,
  trimTrailingSlash,
} from './url';

describe('util/url', () => {
  describe('getFilenameFromPath', () => {
    it('extracts filename from simple path', () => {
      expect(getFilenameFromPath('/path/to/file.json')).toBe('file.json');
      expect(getFilenameFromPath('file.json')).toBe('file.json');
      expect(getFilenameFromPath('/path/to/file.json5')).toBe('file.json5');
    });

    it('extracts filename from paths with query parameters', () => {
      expect(getFilenameFromPath('/path/to/file.json?ref=main')).toBe(
        'file.json',
      );
      expect(getFilenameFromPath('file.json?ref=main')).toBe('file.json');
    });

    it('extracts filename from URLs', () => {
      expect(getFilenameFromPath('https://example.com/path/to/file.json')).toBe(
        'file.json',
      );

      expect(
        getFilenameFromPath('https://example.com/path/to/file.json?ref=main'),
      ).toBe('file.json');
    });

    it('extracts filename from URL with special characters', () => {
      expect(
        getFilenameFromPath(
          'https://example.com/path/to/file-with-dashes.json',
        ),
      ).toBe('file-with-dashes.json');

      expect(
        getFilenameFromPath(
          'https://example.com/path/to/file_with_underscores.json',
        ),
      ).toBe('file_with_underscores.json');
    });

    it('handles paths with no extension', () => {
      expect(getFilenameFromPath('/path/to/file')).toBe('file');
      expect(getFilenameFromPath('/path/to/file?ref=main')).toBe('file');
    });

    it('handles URL-encoded paths', () => {
      expect(getFilenameFromPath('/path/to/file%20with%20spaces.json')).toBe(
        'file%20with%20spaces.json',
      );
    });
  });

  it('joins url parts', () => {
    expect(joinUrlParts('a', 'b', 'c')).toBe('a/b/c');
    expect(joinUrlParts('a/', '/b/', '/c/')).toBe('a/b/c/');
    expect(joinUrlParts('a/', 'b', 'c/')).toBe('a/b/c/');
  });

  it('ensures path prefix', () => {
    expect(ensurePathPrefix('http://g.com/a/b', '/a/')).toBe(
      'http://g.com/a/b',
    );
    expect(ensurePathPrefix('http://g.com/b', '/a/')).toBe('http://g.com/a//b');
    expect(ensurePathPrefix('http://g.com/a', '/a/')).toBe('http://g.com/a//a');
  });

  it('ensures trailing slash', () => {
    expect(ensureTrailingSlash('http://g.com/a')).toBe('http://g.com/a/');
    expect(ensureTrailingSlash('http://g.com/a/')).toBe('http://g.com/a/');
  });

  it('trims trailing slash', () => {
    expect(trimTrailingSlash('http://g.com/a')).toBe('http://g.com/a');
    expect(trimTrailingSlash('http://g.com/a/')).toBe('http://g.com/a');
    expect(trimTrailingSlash('http://g.com/a//')).toBe('http://g.com/a');
  });

  it('trims leading slash', () => {
    expect(trimLeadingSlash('foo/bar')).toBe('foo/bar');
    expect(trimLeadingSlash('/foo/bar')).toBe('foo/bar');
    expect(trimLeadingSlash('//foo/bar')).toBe('foo/bar');
  });

  it('trims slashes', () => {
    expect(trimSlashes('foo/bar')).toBe('foo/bar');
    expect(trimSlashes('/foo/bar')).toBe('foo/bar');
    expect(trimSlashes('//foo/bar/')).toBe('foo/bar');
    expect(trimSlashes('//foo/bar//')).toBe('foo/bar');
  });

  it('resolves base url', () => {
    expect(resolveBaseUrl('http://g.com/a', '')).toBe('http://g.com/a');
    expect(resolveBaseUrl('http://g.com/a', 'b')).toBe('http://g.com/a/b');
    expect(resolveBaseUrl('http://g.com/a/', 'b')).toBe('http://g.com/a/b');
    expect(resolveBaseUrl('http://g.com/a', '/b')).toBe('http://g.com/a/b');
    expect(resolveBaseUrl('http://g.com', '/b')).toBe('http://g.com/b');
    expect(resolveBaseUrl('http://g.com/', '/b')).toBe('http://g.com/b');
    expect(resolveBaseUrl('http://g.com/a/', 'b/c')).toBe('http://g.com/a/b/c');
    expect(resolveBaseUrl('http://g.com/a/', '/b/c')).toBe(
      'http://g.com/a/b/c',
    );
    expect(resolveBaseUrl('http://g.com', 'https://x.com')).toBe(
      'https://x.com',
    );
    expect(resolveBaseUrl('https://g.com', new URL('https://x.com'))).toBe(
      'https://x.com/',
    );
  });

  it('replaces url path', () => {
    expect(replaceUrlPath('http://g.com/a', 'b')).toBe('http://g.com/b');
    expect(replaceUrlPath('http://g.com/a', '/b')).toBe('http://g.com/b');
    expect(replaceUrlPath('http://g.com/a/', 'b')).toBe('http://g.com/b');
    expect(replaceUrlPath('http://g.com/a/', '/b')).toBe('http://g.com/b');
    expect(replaceUrlPath('http://g.com', '/b')).toBe('http://g.com/b');
    expect(replaceUrlPath('http://g.com/', '/b')).toBe('http://g.com/b');
    expect(replaceUrlPath('http://g.com/a/', 'b/c')).toBe('http://g.com/b/c');
    expect(replaceUrlPath('http://g.com/a/', '/b/c')).toBe('http://g.com/b/c');
    expect(replaceUrlPath('http://g.com', 'https://x.com')).toBe(
      'https://x.com',
    );
    expect(replaceUrlPath(new URL('http://g.com/a'), '/b/c')).toBe(
      'http://g.com/b/c',
    );
  });

  it('returns query string from params object', () => {
    expect(getQueryString({ a: 1, b: [1, 2, 3] })).toBe('a=1&b=1&b=2&b=3');
  });

  it('validates http URLs', () => {
    expect(isHttpUrl('http://g.com')).toBeTrue();
    expect(isHttpUrl('https://g.com')).toBeTrue();
    expect(isHttpUrl(new URL('https://g.com'))).toBeTrue();
    expect(isHttpUrl('g.com')).toBeFalse();
    expect(isHttpUrl(null)).toBeFalse();
    expect(isHttpUrl(undefined)).toBeFalse();
    expect(isHttpUrl('')).toBeFalse();
  });

  it('returns URL object', () => {
    expect(parseUrl('https://g.com')).toBeInstanceOf(URL);
    expect(parseUrl('g.com')).toBeNull();
    expect(parseUrl(null)).toBeNull();
    expect(parseUrl(undefined)).toBeNull();
    expect(parseUrl(new URL('https://g.com'))).toBeInstanceOf(URL);
  });

  it('creates URL from hostname or URL', () => {
    expect(createURLFromHostOrURL('https://g.com')).toBeInstanceOf(URL);
    expect(createURLFromHostOrURL('g.com')).toBeInstanceOf(URL);
    expect(
      createURLFromHostOrURL('https://x.com:8080/some-endpoint'),
    ).toBeInstanceOf(URL);
  });

  it('parses link header', () => {
    expect(
      parseLinkHeader(
        '<https://api.github.com/user/9287/repos?page=3&per_page=100>; rel="next", ' +
          '<https://api.github.com/user/9287/repos?page=1&per_page=100>; rel="prev", ' +
          '<https://api.github.com/user/9287/repos?page=5&per_page=100>; rel="last", ' +
          '<https://api.github.com/user/9287/repos?page=1&per_page=100>; rel="first"',
      ),
    ).toMatchObject({
      next: {
        page: '3',
        per_page: '100',
        rel: 'next',
        url: 'https://api.github.com/user/9287/repos?page=3&per_page=100',
      },
    });
    expect(parseLinkHeader(null)).toBeNull();
    expect(parseLinkHeader('')).toBeNull();
    expect(parseLinkHeader('a'.repeat(3000))).toBeNull();
  });

  it('massages host URL', () => {
    expect(massageHostUrl('g.com')).toBe('g.com');
    expect(massageHostUrl('g.com/path')).toBe('https://g.com/path');
    expect(massageHostUrl('g.com:8080')).toBe('https://g.com:8080');
  });
});
