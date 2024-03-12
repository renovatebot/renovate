import * as memCache from '../../../util/cache/memory';
import { parseGoproxy, parseNoproxy } from './goproxy-parser';

describe('modules/datasource/go/goproxy-parser', () => {
  beforeEach(() => {
    memCache.init();
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
      expect(parseGoproxy(undefined)).toBeEmpty();
      expect(parseGoproxy('')).toBeEmpty();
      expect(parseGoproxy('off')).toMatchObject([
        { url: 'off', fallback: '|' },
      ]);
      expect(parseGoproxy('direct')).toMatchObject([
        { url: 'direct', fallback: '|' },
      ]);
      expect(parseGoproxy('foo,off|direct,qux')).toMatchObject([
        { url: 'foo', fallback: ',' },
        { url: 'off', fallback: '|' },
        { url: 'direct', fallback: ',' },
        { url: 'qux', fallback: '|' },
      ]);
    });

    it('caches results', () => {
      expect(parseGoproxy('foo,bar')).toBe(parseGoproxy('foo,bar'));
    });
  });

  describe('parseNoproxy', () => {
    it('produces regex', () => {
      expect(parseNoproxy(undefined)).toBeNull();
      expect(parseNoproxy(null)).toBeNull();
      expect(parseNoproxy('')).toBeNull();
      expect(parseNoproxy('/')).toBeNull();
      expect(parseNoproxy('*')?.source).toBe('^(?:[^\\/]*)(?:\\/.*)?$');
      expect(parseNoproxy('?')?.source).toBe('^(?:[^\\/])(?:\\/.*)?$');
      expect(parseNoproxy('foo')?.source).toBe('^(?:foo)(?:\\/.*)?$');
      expect(parseNoproxy('\\f\\o\\o')?.source).toBe('^(?:foo)(?:\\/.*)?$');
      expect(parseNoproxy('foo,bar')?.source).toBe('^(?:foo|bar)(?:\\/.*)?$');
      expect(parseNoproxy('[abc]')?.source).toBe('^(?:[abc])(?:\\/.*)?$');
      expect(parseNoproxy('[a-c]')?.source).toBe('^(?:[a-c])(?:\\/.*)?$');
      expect(parseNoproxy('[\\a-\\c]')?.source).toBe('^(?:[a-c])(?:\\/.*)?$');
      expect(parseNoproxy('a.b.c')?.source).toBe('^(?:a\\.b\\.c)(?:\\/.*)?$');
      expect(parseNoproxy('trailing/')?.source).toBe(
        '^(?:trailing)(?:\\/.*)?$',
      );
    });

    it('matches on real package prefixes', () => {
      expect(parseNoproxy('ex.co')?.test('ex.co/foo')).toBeTrue();
      expect(parseNoproxy('ex.co/')?.test('ex.co/foo')).toBeTrue();
      expect(parseNoproxy('ex.co/foo/bar')?.test('ex.co/foo/bar')).toBeTrue();
      expect(parseNoproxy('ex.co/foo/bar')?.test('ex.co/foo/bar')).toBeTrue();
      expect(parseNoproxy('*/foo/*')?.test('example.com/foo/bar')).toBeTrue();
      expect(parseNoproxy('ex.co/foo/*')?.test('ex.co/foo/bar')).toBeTrue();
      expect(parseNoproxy('ex.co/foo/*')?.test('ex.co/foo/baz')).toBeTrue();
      expect(parseNoproxy('ex.co')?.test('ex.co/foo/v2')).toBeTrue();

      expect(parseNoproxy('ex.co/foo/bar')?.test('ex.co/foo/bar')).toBeTrue();
      expect(parseNoproxy('*/foo/*')?.test('example.com/foo/bar')).toBeTrue();
      expect(parseNoproxy('ex.co/foo/*')?.test('ex.co/foo/bar')).toBeTrue();
      expect(parseNoproxy('ex.co/foo/*')?.test('ex.co/foo/baz')).toBeTrue();
      expect(
        parseNoproxy('ex.co/foo/bar,ex.co/foo/baz')?.test('ex.co/foo/bar'),
      ).toBeTrue();
      expect(
        parseNoproxy('ex.co/foo/bar,ex.co/foo/baz')?.test('ex.co/foo/baz'),
      ).toBeTrue();
      expect(
        parseNoproxy('ex.co/foo/bar,ex.co/foo/baz')?.test('ex.co/foo/qux'),
      ).toBeFalse();

      expect(parseNoproxy('ex')?.test('ex.co/foo')).toBeFalse();

      expect(parseNoproxy('aba')?.test('x/aba')).toBeFalse();
      expect(parseNoproxy('x/b')?.test('x/aba')).toBeFalse();
      expect(parseNoproxy('x/ab')?.test('x/aba')).toBeFalse();
      expect(parseNoproxy('x/ab[a-b]')?.test('x/aba')).toBeTrue();
    });

    it('matches on wildcards', () => {
      expect(parseNoproxy('/*/')?.test('ex.co/foo')).toBeFalse();
      expect(parseNoproxy('*/foo')?.test('ex.co/foo')).toBeTrue();
      expect(parseNoproxy('*/fo')?.test('ex.co/foo')).toBeFalse();
      expect(parseNoproxy('*/fo?')?.test('ex.co/foo')).toBeTrue();
      expect(parseNoproxy('*/fo*')?.test('ex.co/foo')).toBeTrue();
      expect(parseNoproxy('*fo*')?.test('ex.co/foo')).toBeFalse();

      expect(parseNoproxy('*.co')?.test('ex.co/foo')).toBeTrue();
      expect(parseNoproxy('ex*')?.test('ex.co/foo')).toBeTrue();
      expect(parseNoproxy('*/foo')?.test('ex.co/foo/v2')).toBeTrue();
      expect(parseNoproxy('*/foo/')?.test('ex.co/foo/v2')).toBeTrue();
      expect(parseNoproxy('*/foo/*')?.test('ex.co/foo/v2')).toBeTrue();
      expect(parseNoproxy('*/foo/*/')?.test('ex.co/foo/v2')).toBeTrue();
      expect(parseNoproxy('*/v2')?.test('ex.co/foo/v2')).toBeFalse();
      expect(parseNoproxy('*/*/v2')?.test('ex.co/foo/v2')).toBeTrue();
      expect(parseNoproxy('*/*/*')?.test('ex.co/foo/v2')).toBeTrue();
      expect(parseNoproxy('*/*/*/')?.test('ex.co/foo/v2')).toBeTrue();
      expect(parseNoproxy('*/*/*')?.test('ex.co/foo')).toBeFalse();
      expect(parseNoproxy('*/*/*/')?.test('ex.co/foo')).toBeFalse();

      expect(parseNoproxy('*/*/*,,')?.test('ex.co/repo')).toBeFalse();
      expect(parseNoproxy('*/*/*,,*/repo')?.test('ex.co/repo')).toBeTrue();
      expect(parseNoproxy(',,*/repo')?.test('ex.co/repo')).toBeTrue();
    });

    it('matches on character ranges', () => {
      expect(parseNoproxy('x/ab[a-b]')?.test('x/aba')).toBeTrue();
      expect(parseNoproxy('x/ab[a-b]')?.test('x/abc')).toBeFalse();
    });

    it('caches results', () => {
      expect(parseNoproxy('foo/bar')).toBe(parseNoproxy('foo/bar'));
    });
  });
});
