import { minimatch, minimatchFilter } from './minimatch';

describe('util/minimatch', () => {
  describe('minimatch', () => {
    it('caches minimatch', () => {
      expect(minimatch('foo')).toBe(minimatch('foo'));
      expect(minimatch('foo', { dot: true })).toBe(
        minimatch('foo', { dot: true }),
      );
    });

    it('does not cache minimatch', () => {
      expect(minimatch('foo', undefined, false)).not.toBe(
        minimatch('foo', undefined, false),
      );
      expect(minimatch('foo')).not.toBe(minimatch('foo', undefined, false));
      expect(minimatch('foo', { dot: true })).not.toBe(minimatch('foo'));
    });

    it('matches', () => {
      const matcher = minimatch('@opentelemetry{/,}**');
      expect(matcher.match('@opentelemetry-http')).toBeTrue();
      expect(matcher.match('@opentelemetry/http')).toBeTrue();
      expect(matcher.match('@opentelemetry/http/client')).toBeTrue();
      expect(
        minimatch('@opentelemetry**').match('@opentelemetry/http'),
      ).toBeFalse();
    });
  });

  describe('minimatchFilter', () => {
    it('should return a function', () => {
      expect(minimatchFilter('*.js')).toBeFunction();
      expect(minimatchFilter('*.js', undefined, false)).toBeFunction();
    });

    it('should correctly match filenames', () => {
      const filterFunc = minimatchFilter('*.js');
      expect(filterFunc('test.js')).toBe(true);
      expect(filterFunc('test.txt')).toBe(false);
    });
  });
});
