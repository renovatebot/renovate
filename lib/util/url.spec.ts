import {
  massageUrlProtocol,
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
    expect(validateUrl('github.com')).toBe(false);
    expect(validateUrl('ssh://github.com')).toBe(false);
    expect(validateUrl('http://github.com')).toBe(true);
    expect(validateUrl('https://github.com')).toBe(true);
  });
  it('trimTrailingSlash', () => {
    expect(trimTrailingSlash('foo')).toBe('foo');
    expect(trimTrailingSlash('/foo/bar')).toBe('/foo/bar');
    expect(trimTrailingSlash('foo/')).toBe('foo');
    expect(trimTrailingSlash('foo//////')).toBe('foo');
  });
  it('massageUrlProtocol', () => {
    expect(massageUrlProtocol('')).toBeNull();
    expect(massageUrlProtocol(null)).toBeNull();
    expect(massageUrlProtocol(undefined)).toBeNull();

    expect(massageUrlProtocol('###')).toBeNull();
    expect(massageUrlProtocol('@@@')).toBeNull();
    expect(massageUrlProtocol('123')).toBe('https://123');
    expect(massageUrlProtocol('foo')).toBe('https://foo');

    expect(massageUrlProtocol('github.com')).toBe('https://github.com');
    expect(massageUrlProtocol('github.com', 'http')).toBe('http://github.com');

    expect(massageUrlProtocol('http://github.com')).toBe('http://github.com');
    expect(massageUrlProtocol('https://github.com')).toBe('https://github.com');

    expect(massageUrlProtocol('https://github.com/foo/bar')).toBe(
      'https://github.com/foo/bar'
    );

    const fileUrl =
      'file://lib/datasource/maven/__fixtures__/custom_maven_repo/maven2/';
    expect(massageUrlProtocol(fileUrl)).toBe(fileUrl);

    const s3Url = 's3://somewhere.s3.aws.amazon.com';
    expect(massageUrlProtocol(s3Url)).toBe(s3Url);
  });
});
