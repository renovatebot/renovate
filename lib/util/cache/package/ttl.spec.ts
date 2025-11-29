import { GlobalConfig } from '../../../config/global';
import { getTtlOverride, resolveTtlValues } from './ttl';
import type { PackageCacheNamespace } from './types';

describe('util/cache/package/ttl', () => {
  beforeEach(() => {
    GlobalConfig.reset();
  });

  describe('getTtlOverride', () => {
    describe('No configuration', () => {
      it('returns undefined when no cacheTtlOverride config exists', () => {
        GlobalConfig.set({});
        const res = getTtlOverride('datasource-npm' as never);
        expect(res).toBeUndefined();
      });

      it('returns undefined when cacheTtlOverride is empty', () => {
        GlobalConfig.set({ cacheTtlOverride: {} });
        const res = getTtlOverride('datasource-npm' as never);
        expect(res).toBeUndefined();
      });
    });

    describe('Exact match', () => {
      it('returns exact match when namespace exists in config', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 120,
            'datasource-docker': 60,
          },
        });

        const resNpm = getTtlOverride('datasource-npm' as never);
        const resDocker = getTtlOverride('datasource-docker' as never);

        expect(resNpm).toBe(120);
        expect(resDocker).toBe(60);
      });

      it('returns undefined when exact match is not a number', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            // @ts-expect-error -- testing
            'datasource-npm': 'invalid',
          },
        });
        const res = getTtlOverride('datasource-npm' as never);
        expect(res).toBeUndefined();
      });

      it('returns undefined when no matching namespace found', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 120,
          },
        });
        const res = getTtlOverride('datasource-docker' as never);
        expect(res).toBeUndefined();
      });
    });

    describe('Glob patterns', () => {
      it('matches simple glob patterns', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-*': 90,
          },
        });

        const resNpm = getTtlOverride('datasource-npm' as never);
        const resDocker = getTtlOverride('datasource-docker' as never);
        const resMaven = getTtlOverride('datasource-maven' as never);

        expect(resNpm).toBe(90);
        expect(resDocker).toBe(90);
        expect(resMaven).toBe(90);
      });

      it('matches wildcard pattern for all namespaces', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            '*': 45,
          },
        });

        const resDatasource = getTtlOverride('datasource-npm' as never);
        const resChangelog = getTtlOverride(
          'changelog-github-notes@v2' as never,
        );
        const resAny = getTtlOverride(
          'any-namespace' as never as PackageCacheNamespace,
        );

        expect(resDatasource).toBe(45);
        expect(resChangelog).toBe(45);
        expect(resAny).toBe(45);
      });

      it('matches complex glob patterns with braces', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-{npm,docker}': 150,
          },
        });

        const resNpm = getTtlOverride('datasource-npm' as never);
        const resDocker = getTtlOverride('datasource-docker' as never);
        const resMaven = getTtlOverride('datasource-maven' as never);

        expect(resNpm).toBe(150);
        expect(resDocker).toBe(150);
        expect(resMaven).toBeUndefined();
      });

      it('handles special characters in namespace patterns', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm:*': 120,
            'changelog-*@v2': 60,
          },
        });

        const resColon = getTtlOverride(
          'datasource-npm:cache-provider' as never,
        );
        const resAt = getTtlOverride('changelog-github-notes@v2' as never);

        expect(resColon).toBe(120);
        expect(resAt).toBe(60);
      });
    });

    describe('Regex patterns', () => {
      it('matches regex patterns', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            '/^datasource-/': 75,
          },
        });

        const resNpm = getTtlOverride('datasource-npm' as never);
        const resDocker = getTtlOverride('datasource-docker' as never);
        const resChangelog = getTtlOverride(
          'changelog-github-notes@v2' as never,
        );

        expect(resNpm).toBe(75);
        expect(resDocker).toBe(75);
        expect(resChangelog).toBeUndefined();
      });

      it('matches patterns with regex escape sequences', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            '/datasource-\\w+/': 120,
          },
        });

        const resNpm = getTtlOverride('datasource-npm' as never);
        const resNumeric = getTtlOverride('datasource-123' as never);
        const resEmpty = getTtlOverride('datasource-' as never);

        expect(resNpm).toBe(120);
        expect(resNumeric).toBe(120);
        expect(resEmpty).toBeUndefined();
      });
    });

    describe('Priority and multiple patterns', () => {
      it('prioritizes exact match over glob patterns', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-*': 90,
            'datasource-npm': 120,
            '*': 45,
          },
        });

        const resNpm = getTtlOverride('datasource-npm' as never);
        const resDocker = getTtlOverride('datasource-docker' as never);

        expect(resNpm).toBe(120);
        expect(resDocker).toBe(90);
      });

      it('returns longest matching pattern when multiple patterns apply', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-*': 90,
            'datasource-n*': 100,
            '*': 45,
          },
        });

        const res = getTtlOverride('datasource-npm' as never);

        expect(res).toBe(100);
      });

      it('selects longest matching pattern across all configs', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            '*': 10,
            'datasource-*': 20,
            'datasource-npm*': 30,
            'datasource-npm-*': 40,
          },
        });

        const resRegistry = getTtlOverride('datasource-npm-registry' as never);
        const resJs = getTtlOverride('datasource-npmjs' as never);
        const resDocker = getTtlOverride('datasource-docker' as never);

        expect(resRegistry).toBe(40);
        expect(resJs).toBe(30);
        expect(resDocker).toBe(20);
      });

      it('skips non-numeric values and selects next longest matching pattern', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            // @ts-expect-error -- testing
            'datasource-*': 'invalid',
            'datasource-n*': 100,
            '*': 45,
          },
        });

        const res = getTtlOverride('datasource-npm' as never);

        expect(res).toBe(100);
      });

      it('returns undefined when no patterns match', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'changelog-*': 90,
            'preset-*': 100,
          },
        });

        const res = getTtlOverride('datasource-npm' as never);

        expect(res).toBeUndefined();
      });

      it('applies patterns consistently regardless of case in config order', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'Datasource-*': 120,
            'datasource-*': 90,
          },
        });

        const res = getTtlOverride('datasource-docker' as never);

        expect(res).toBe(120);
      });
    });

    describe('Edge cases', () => {
      it('handles empty string pattern', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            '': 30,
            'datasource-npm': 120,
          },
        });

        const resNpm = getTtlOverride('datasource-npm' as never);
        const resEmpty = getTtlOverride('' as never as PackageCacheNamespace);

        expect(resNpm).toBe(120);
        expect(resEmpty).toBe(30);
      });

      it('treats null and undefined values as invalid', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            // @ts-expect-error -- testing
            'datasource-npm': null,
            // @ts-expect-error -- testing
            'datasource-docker': undefined,
            'datasource-maven': 90,
          },
        });

        const resNpm = getTtlOverride('datasource-npm' as never);
        const resDocker = getTtlOverride('datasource-docker' as never);
        const resMaven = getTtlOverride('datasource-maven' as never);

        expect(resNpm).toBeUndefined();
        expect(resDocker).toBeUndefined();
        expect(resMaven).toBe(90);
      });

      it('handles very large numbers', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 999999999,
          },
        });

        const res = getTtlOverride('datasource-npm' as never);

        expect(res).toBe(999999999);
      });

      it('handles negative numbers', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': -100,
          },
        });

        const res = getTtlOverride('datasource-npm' as never);

        expect(res).toBe(-100);
      });

      it('treats string numbers as invalid, only accepts number types', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            // @ts-expect-error -- testing
            'datasource-npm': '120',
            'datasource-docker': 90,
          },
        });

        const resNpm = getTtlOverride('datasource-npm' as never);
        const resDocker = getTtlOverride('datasource-docker' as never);

        expect(resNpm).toBeUndefined();
        expect(resDocker).toBe(90);
      });
    });
  });

  describe('resolveTtlValues', () => {
    describe('Default values', () => {
      it('returns default values when no overrides set', () => {
        GlobalConfig.set({});

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 60,
          hardTtlMinutes: 10080,
        });
      });
    });

    describe('Override application', () => {
      it('uses override for softTtlMinutes when available', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 120,
          },
        });

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 120,
          hardTtlMinutes: 10080,
        });
      });

      it('applies custom cacheHardTtlMinutes from config', () => {
        GlobalConfig.set({
          cacheHardTtlMinutes: 1440,
        });

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 60,
          hardTtlMinutes: 1440,
        });
      });

      it('resolves TTL with glob pattern overrides', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-*': 180,
          },
          cacheHardTtlMinutes: 2880,
        });

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 180,
          hardTtlMinutes: 2880,
        });
      });

      it('resolves TTL correctly with multiple overlapping overrides', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-*': 100,
            'datasource-npm': 200,
            '*': 50,
          },
          cacheHardTtlMinutes: 5760,
        });

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 200,
          hardTtlMinutes: 5760,
        });
      });
    });

    describe('Hard TTL calculation', () => {
      it('uses maximum of softTtlMinutes and cacheHardTtlMinutes for hardTtlMinutes', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 20160,
          },
          cacheHardTtlMinutes: 1440,
        });

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 20160,
          hardTtlMinutes: 20160,
        });
      });

      it('handles negative cacheHardTtlMinutes config', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 120,
          },
          cacheHardTtlMinutes: -1,
        });

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 120,
          hardTtlMinutes: 120,
        });
      });
    });

    describe('Edge cases and special scenarios', () => {
      it('handles zero as valid override value', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            'datasource-npm': 0,
          },
          cacheHardTtlMinutes: 1440,
        });

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 0,
          hardTtlMinutes: 1440,
        });
      });

      it('uses fallback when override is not a number', () => {
        GlobalConfig.set({
          cacheTtlOverride: {
            // @ts-expect-error -- testing
            'datasource-npm': 'invalid',
          },
        });

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 60,
          hardTtlMinutes: 10080,
        });
      });
    });
  });
});
