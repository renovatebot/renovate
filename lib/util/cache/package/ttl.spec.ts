import { GlobalConfig } from '../../../config/global';
import { getTtlOverride, resolveTtlValues } from './ttl';
import type { PackageCacheNamespace } from './types';

describe('util/cache/package/ttl', () => {
  beforeEach(() => {
    GlobalConfig.reset();
  });

  describe('getTtlOverride', () => {
    describe('basic functionality', () => {
      it('returns undefined when no cacheTtlOverride config', () => {
        GlobalConfig.set({});
        expect(getTtlOverride('datasource-npm' as never)).toBeUndefined();
      });

      it('returns undefined when cacheTtlOverride is empty', () => {
        GlobalConfig.set({ cacheTtlOverride: {} });
        expect(getTtlOverride('datasource-npm' as never)).toBeUndefined();
      });

      it('returns exact match when namespace exists', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 120,
            'datasource-docker': 60,
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBe(120);
        expect(getTtlOverride('datasource-docker' as never)).toBe(60);
      });

      it('returns undefined when exact match is not a number', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 'invalid',
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBeUndefined();
      });

      it('returns undefined when no match found', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 120,
          },
        });
        expect(getTtlOverride('datasource-docker' as never)).toBeUndefined();
      });
    });

    describe('pattern matching', () => {
      it('matches glob patterns', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-*': 90,
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBe(90);
        expect(getTtlOverride('datasource-docker' as never)).toBe(90);
        expect(getTtlOverride('datasource-maven' as never)).toBe(90);
      });

      it('matches wildcard pattern for all namespaces', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            '*': 45,
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBe(45);
        expect(getTtlOverride('changelog-github-notes@v2' as never)).toBe(45);
        expect(
          getTtlOverride('any-namespace' as never as PackageCacheNamespace),
        ).toBe(45);
      });

      it('matches regex patterns', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            '/^datasource-/': 75,
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBe(75);
        expect(getTtlOverride('datasource-docker' as never)).toBe(75);
        expect(
          getTtlOverride('changelog-github-notes@v2' as never),
        ).toBeUndefined();
      });

      it('handles complex glob patterns', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-{npm,docker}': 150,
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBe(150);
        expect(getTtlOverride('datasource-docker' as never)).toBe(150);
        expect(getTtlOverride('datasource-maven' as never)).toBeUndefined();
      });

      it('handles patterns with escape sequences', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            '/datasource-\\w+/': 120,
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBe(120);
        expect(getTtlOverride('datasource-123' as never)).toBe(120);
        expect(getTtlOverride('datasource-' as never)).toBeUndefined(); // No word characters after dash
      });
    });

    describe('priority and multiple patterns', () => {
      it('prioritizes exact match over glob patterns', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-*': 90,
            'datasource-npm': 120,
            '*': 45,
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBe(120);
        expect(getTtlOverride('datasource-docker' as never)).toBe(90); // 'datasource-*' wins because it's longer than '*'
      });

      it('applies longest matching pattern when multiple patterns match', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-*': 90,
            'datasource-n*': 100,
            '*': 45,
          },
        });
        // Should return 100 because 'datasource-n*' is the longest matching pattern
        expect(getTtlOverride('datasource-npm' as never)).toBe(100);
      });

      it('demonstrates longer pattern wins over shorter patterns', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            '*': 10, // length 1
            'datasource-*': 20, // length 12
            'datasource-npm*': 30, // length 15
            'datasource-npm-*': 40, // length 16
          },
        });
        // Should return 40 because 'datasource-npm-*' is the longest matching pattern
        expect(getTtlOverride('datasource-npm-registry' as never)).toBe(40);
        // Should return 30 because 'datasource-npm*' is the longest matching pattern for this namespace
        expect(getTtlOverride('datasource-npmjs' as never)).toBe(30);
        // Should return 20 because 'datasource-*' is the longest matching pattern for this namespace
        expect(getTtlOverride('datasource-docker' as never)).toBe(20);
      });

      it('skips non-numeric values and finds next longest matching pattern', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-*': 'invalid',
            'datasource-n*': 100,
            '*': 45,
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBe(100);
      });

      it('returns undefined when no patterns match', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'changelog-*': 90,
            'preset-*': 100,
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBeUndefined();
      });
    });

    describe('edge cases', () => {
      it('handles edge case with empty string pattern', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            '': 30,
            'datasource-npm': 120,
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBe(120);
        expect(getTtlOverride('' as never as PackageCacheNamespace)).toBe(30);
      });

      it('handles null and undefined values in overrides', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': null,
            'datasource-docker': undefined,
            'datasource-maven': 90,
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBeUndefined();
        expect(getTtlOverride('datasource-docker' as never)).toBeUndefined();
        expect(getTtlOverride('datasource-maven' as never)).toBe(90);
      });

      it('handles very large numbers', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 999999999,
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBe(999999999);
      });

      it('handles negative numbers', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': -100,
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBe(-100);
      });

      it('handles string numbers correctly', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': '120',
            'datasource-docker': 90,
          },
        });
        expect(getTtlOverride('datasource-npm' as never)).toBeUndefined(); // string '120' is not a number
        expect(getTtlOverride('datasource-docker' as never)).toBe(90);
      });

      it('handles special characters in patterns', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm:*': 120,
            'changelog-*@v2': 60,
          },
        });
        expect(getTtlOverride('datasource-npm:cache-provider' as never)).toBe(
          120,
        );
        expect(getTtlOverride('changelog-github-notes@v2' as never)).toBe(60);
      });

      it('handles case sensitivity in patterns', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'Datasource-*': 120,
            'datasource-*': 90,
          },
        });
        // minimatch should be case-insensitive by default
        expect(getTtlOverride('datasource-docker' as never)).toBe(120); // First match wins when patterns are equal length
      });
    });
  });

  describe('resolveTtlValues', () => {
    describe('basic functionality', () => {
      it('returns default values when no override', () => {
        GlobalConfig.set({});
        const result = resolveTtlValues('datasource-npm' as never, 60);
        expect(result).toEqual({
          softTtlMinutes: 60,
          hardTtlMinutes: 10080, // 7 * 24 * 60 = 10080 (default cacheHardTtlMinutes)
        });
      });

      it('uses override for softTtlMinutes', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 120,
          },
        });
        const result = resolveTtlValues('datasource-npm' as never, 60);
        expect(result).toEqual({
          softTtlMinutes: 120,
          hardTtlMinutes: 10080, // max(120, 10080) = 10080
        });
      });

      it('uses custom cacheHardTtlMinutes', () => {
        GlobalConfig.set({
          cacheHardTtlMinutes: 1440, // 24 hours
        });
        const result = resolveTtlValues('datasource-npm' as never, 60);
        expect(result).toEqual({
          softTtlMinutes: 60,
          hardTtlMinutes: 1440, // max(60, 1440) = 1440
        });
      });

      it('uses max of softTtlMinutes and cacheHardTtlMinutes for hardTtlMinutes', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 20160, // 14 days
          },
          cacheHardTtlMinutes: 1440, // 1 day
        });
        const result = resolveTtlValues('datasource-npm' as never, 60);
        expect(result).toEqual({
          softTtlMinutes: 20160,
          hardTtlMinutes: 20160, // max(20160, 1440) = 20160
        });
      });

      it('works with glob pattern overrides', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-*': 180,
          },
          cacheHardTtlMinutes: 2880, // 2 days
        });
        const result = resolveTtlValues('datasource-npm' as never, 60);
        expect(result).toEqual({
          softTtlMinutes: 180,
          hardTtlMinutes: 2880, // max(180, 2880) = 2880
        });
      });
    });

    describe('edge cases and special scenarios', () => {
      it('handles zero override values', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 0,
          },
          cacheHardTtlMinutes: 1440,
        });
        const result = resolveTtlValues('datasource-npm' as never, 60);
        expect(result).toEqual({
          softTtlMinutes: 0,
          hardTtlMinutes: 1440, // max(0, 1440) = 1440
        });
      });

      it('handles negative cacheHardTtlMinutes', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 120,
          },
          cacheHardTtlMinutes: -1,
        });
        const result = resolveTtlValues('datasource-npm' as never, 60);
        expect(result).toEqual({
          softTtlMinutes: 120,
          hardTtlMinutes: 120, // max(120, -1) = 120
        });
      });

      it('uses fallback when override is not a number', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 'invalid',
          },
        });
        const result = resolveTtlValues('datasource-npm' as never, 60);
        expect(result).toEqual({
          softTtlMinutes: 60,
          hardTtlMinutes: 10080, // max(60, 10080) = 10080
        });
      });

      it('handles complex scenario with multiple overrides', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-*': 100,
            'datasource-npm': 200,
            '*': 50,
          },
          cacheHardTtlMinutes: 5760, // 4 days
        });
        const result = resolveTtlValues('datasource-npm' as never, 60);
        expect(result).toEqual({
          softTtlMinutes: 200, // exact match has priority
          hardTtlMinutes: 5760, // max(200, 5760) = 5760
        });
      });
    });
  });
});
