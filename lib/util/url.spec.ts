import { resolveBaseUrl, compareHosts } from './url';

describe('util/url/resolveBaseUrl', () => {
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
});

describe('util/url/compareHosts', () => {
  test.each([
    ['http://foo.io', 'http://foo.io/aaa', true],
    ['http://foo.io', 'https://foo.io', true],
    ['http://foo.io:80', 'http://foo.io:80', true],
    [new URL('http://foo.io:80'), new URL('http://foo.io:80'), true],

    ['http://foo.io:80', 'http://foo.io:81', false],
    ['http://foo1.io', 'http://foo2.io/aaa', false],
    ['http://foo.io', 'http://', false],
    ['http://foo.io', '', false],
    ['http://foo.io', undefined, false],
    [null, 'http://foo.io', false],
    ['novalidurl', 'novalidurl', false],
    [new URL('http://foo1.io:80'), new URL('http://foo.io2:80'), false],
  ])('%s === %s => %s', (url1, url2, result) => {
    expect(compareHosts(url1, url2)).toBe(result);
  });
});
