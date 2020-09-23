import { resolveBaseUrl } from './url';

describe('util/url', () => {
  test.each([
    ['http://foo.io', '', 'http://foo.io'],
    ['http://foo.io/', '', 'http://foo.io'],
    ['http://foo.io', '/', 'http://foo.io'],
    ['http://foo.io/', '/', 'http://foo.io'],

    ['http://foo.io', '/x', 'http://foo.io/x'],
    ['http://foo.io', 'x', 'http://foo.io/x'],
    ['http://foo.io/', '/x', 'http://foo.io/x'],
    ['http://foo.io/', 'x', 'http://foo.io/x'],

    ['http://foo.io/x', '/y', 'http://foo.io/x/y'],
    ['http://foo.io/x', 'y', 'http://foo.io/x/y'],
    ['http://foo.io/x/', '/y', 'http://foo.io/x/y'],
    ['http://foo.io/x/', 'y', 'http://foo.io/x/y'],

    ['http://foo.io/x', '/y/', 'http://foo.io/x/y'],
    ['http://foo.io/x', 'y/', 'http://foo.io/x/y'],
    ['http://foo.io/x/', '/y/', 'http://foo.io/x/y'],
    ['http://foo.io/x/', 'y/', 'http://foo.io/x/y'],

    ['http://foo.io', 'http://bar.io/y', 'http://bar.io/y'],
    ['http://foo.io/', 'http://bar.io/y', 'http://bar.io/y'],
    ['http://foo.io/x', 'http://bar.io/y', 'http://bar.io/y'],
    ['http://foo.io/x/', 'http://bar.io/y', 'http://bar.io/y'],

    ['http://foo.io', 'x?y=z', 'http://foo.io/x?y=z'],
    ['http://foo.io', '/x?y=z', 'http://foo.io/x?y=z'],
    ['http://foo.io/', 'x?y=z', 'http://foo.io/x?y=z'],
    ['http://foo.io/', '/x?y=z', 'http://foo.io/x?y=z'],
  ])('%s + %s => %s', (baseUrl, x, result) => {
    expect(resolveBaseUrl(baseUrl, x)).toBe(result);
  });
});
