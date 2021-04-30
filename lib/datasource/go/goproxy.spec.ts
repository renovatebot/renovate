import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import * as memCache from '../../util/cache/memory';
import {
  encodeCase,
  listVersions,
  parseGoproxy,
  parseNoproxy,
  versionInfo,
} from './goproxy';

describe(getName(), () => {
  beforeEach(() => {
    memCache.init();
  });

  afterEach(() => {
    memCache.reset();
  });

  it('encodeCase', () => {
    expect(encodeCase('foo')).toBe('foo');
    expect(encodeCase('Foo')).toBe('!foo');
    expect(encodeCase('FOO')).toBe('!f!o!o');
  });

  describe('requests', () => {
    beforeEach(() => {
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
    });

    const baseUrl = 'https://proxy.golang.org';
    const lookupName = 'github.com/go-kit/kit';

    it('listVersions', async () => {
      httpMock.scope(baseUrl).get('/github.com/go-kit/kit/@v/list').reply(
        200,
        `
        v0.7.0
        v0.3.0
        v0.8.0
        v0.6.0
        v0.10.0
        v0.5.0
        v0.9.0
        v0.4.0
        v0.1.0
        v0.2.0
        `
      );

      const versions = await listVersions(baseUrl, lookupName);

      expect(versions).not.toBeEmpty();
      expect(versions).toHaveLength(10);
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('versionInfo', async () => {
      httpMock
        .scope(baseUrl)
        .get('/github.com/go-kit/kit/@v/v0.5.0.info')
        .reply(200, { Version: 'v0.5.0', Time: '2017-06-08T17:28:36Z' });

      const release = await versionInfo(baseUrl, lookupName, 'v0.5.0');

      expect(release).toEqual({
        version: 'v0.5.0',
        releaseTimestamp: '2017-06-08T17:28:36Z',
      });
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('parseGoproxy', () => {
    it('parses single url', () => {
      const result = parseGoproxy('foo');
      expect(result).toMatchObject([{ url: 'foo' }]);
    });
    it('parses multiple urls', () => {
      const result = parseGoproxy('foo,bar|baz,qux');
      expect(result).toMatchObject([
        { url: 'foo', fallback: ',' },
        { url: 'bar', fallback: '|' },
        { url: 'baz', fallback: ',' },
        { url: 'qux' },
      ]);
    });
    it('ignores everything starting from "direct" and "off" keywords', () => {
      expect(parseGoproxy(undefined)).toBeEmpty();
      expect(parseGoproxy(null)).toBeEmpty();
      expect(parseGoproxy('')).toBeEmpty();
      expect(parseGoproxy('off')).toBeEmpty();
      expect(parseGoproxy('direct')).toBeEmpty();
      expect(parseGoproxy('foo,off|direct,qux')).toMatchObject([
        { url: 'foo', fallback: ',' },
      ]);
    });
  });

  describe('parseNoproxy', () => {
    it('produces regex', () => {
      expect(parseNoproxy(undefined)).toBeNull();
      expect(parseNoproxy(null)).toBeNull();
      expect(parseNoproxy('')).toBeNull();
      expect(parseNoproxy('*')?.source).toEqual('^(?:[^\\/]*)$');
      expect(parseNoproxy('?')?.source).toEqual('^(?:[^\\/])$');
      expect(parseNoproxy('foo')?.source).toEqual('^(?:foo)$');
      expect(parseNoproxy('\\f\\o\\o')?.source).toEqual('^(?:foo)$');
      expect(parseNoproxy('foo,bar')?.source).toEqual('^(?:foo|bar)$');
      expect(parseNoproxy('[abc]')?.source).toEqual('^(?:[abc])$');
      expect(parseNoproxy('[a-c]')?.source).toEqual('^(?:[a-c])$');
      expect(parseNoproxy('[\\a-\\c]')?.source).toEqual('^(?:[a-c])$');
    });

    it('matches on real package prefixes', () => {
      expect(parseNoproxy('ex.co/foo/bar').test('ex.co/foo/bar')).toBeTrue();
      expect(parseNoproxy('*/foo/*').test('example.com/foo/bar')).toBeTrue();
      expect(parseNoproxy('ex.co/foo/*').test('ex.co/foo/bar')).toBeTrue();
      expect(parseNoproxy('ex.co/foo/*').test('ex.co/foo/baz')).toBeTrue();
      expect(
        parseNoproxy('ex.co/foo/bar,ex.co/foo/baz').test('ex.co/foo/bar')
      ).toBeTrue();
      expect(
        parseNoproxy('ex.co/foo/bar,ex.co/foo/baz').test('ex.co/foo/baz')
      ).toBeTrue();
      expect(
        parseNoproxy('ex.co/foo/bar,ex.co/foo/baz').test('ex.co/foo/qux')
      ).toBeFalse();
    });

    it('Matches from start to end', () => {
      expect(parseNoproxy('x').test('x/aba')).toBeFalse();
      expect(parseNoproxy('aba').test('x/aba')).toBeFalse();
      expect(parseNoproxy('x/b').test('x/aba')).toBeFalse();
      expect(parseNoproxy('x/ab').test('x/aba')).toBeFalse();
      expect(parseNoproxy('x/ab[a-b]').test('x/aba')).toBeTrue();
    });
  });
});
