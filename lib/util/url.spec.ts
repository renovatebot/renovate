import { getName } from '../../test/util';
import {
  parseUrl,
  resolveBaseUrl,
  trimTrailingSlash,
  validateUrl,
} from './url';

describe(getName(__filename), () => {
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
});
