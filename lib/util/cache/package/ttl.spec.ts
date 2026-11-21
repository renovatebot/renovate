import { GlobalConfig } from '../../../config/global.ts';
import { getTtlOverride, resolveTtlValues } from './ttl.ts';

describe('util/cache/package/ttl', () => {
  beforeEach(() => {
    GlobalConfig.reset();
  });

  describe('getTtlOverride', () => {
    describe('No configuration', () => {
      it('returns undefined when no packageCache.ttlOverride config exists', () => {
        GlobalConfig.set({});

        const res = getTtlOverride('datasource-npm' as never);

        expect(res).toBeUndefined();
      });

      it('returns undefined when packageCache.ttlOverride is empty', () => {
        GlobalConfig.set({ packageCache: { ttlOverride: {} } });

        const res = getTtlOverride('datasource-npm' as never);

        expect(res).toBeUndefined();
      });
    });

    describe('Exact match', () => {
      it('returns exact match when namespace exists in config', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              'datasource-npm': 120,
              'datasource-docker': 60,
            },
          },
        });

        const resNpm = getTtlOverride('datasource-npm' as never);
        const resDocker = getTtlOverride('datasource-docker' as never);

        expect(resNpm).toBe(120);
        expect(resDocker).toBe(60);
      });

      it('returns undefined when exact match is not a number', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              // @ts-expect-error -- testing
              'datasource-npm': 'invalid',
            },
          },
        });

        const res = getTtlOverride('datasource-npm' as never);

        expect(res).toBeUndefined();
      });

      it('returns undefined when no matching namespace found', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              'datasource-npm': 120,
            },
          },
        });

        const res = getTtlOverride('datasource-docker' as never);

        expect(res).toBeUndefined();
      });
    });

    describe('Glob patterns', () => {
      it('matches simple glob patterns', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              'datasource-*': 90,
            },
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
          packageCache: {
            ttlOverride: {
              '*': 45,
            },
          },
        });

        const resDatasource = getTtlOverride('datasource-npm' as never);
        const resChangelog = getTtlOverride('changelog-github-notes@v2');
        const resAny = getTtlOverride('any-namespace' as never);

        expect(resDatasource).toBe(45);
        expect(resChangelog).toBe(45);
        expect(resAny).toBe(45);
      });

      it('matches complex glob patterns with braces', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              'datasource-{npm,docker}': 150,
            },
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
          packageCache: {
            ttlOverride: {
              'datasource-npm:*': 120,
              'changelog-*@v2': 60,
            },
          },
        });

        const resColon = getTtlOverride('datasource-npm:cache-provider');
        const resAt = getTtlOverride('changelog-github-notes@v2');

        expect(resColon).toBe(120);
        expect(resAt).toBe(60);
      });
    });

    describe('Regex patterns', () => {
      it('matches regex patterns', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              '/^datasource-/': 75,
            },
          },
        });

        const resNpm = getTtlOverride('datasource-npm' as never);
        const resDocker = getTtlOverride('datasource-docker' as never);
        const resChangelog = getTtlOverride('changelog-github-notes@v2');

        expect(resNpm).toBe(75);
        expect(resDocker).toBe(75);
        expect(resChangelog).toBeUndefined();
      });

      it('matches patterns with regex escape sequences', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              '/datasource-\\w+/': 120,
            },
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
          packageCache: {
            ttlOverride: {
              'datasource-*': 90,
              'datasource-npm': 120,
              '*': 45,
            },
          },
        });

        const resNpm = getTtlOverride('datasource-npm' as never);
        const resDocker = getTtlOverride('datasource-docker' as never);

        expect(resNpm).toBe(120);
        expect(resDocker).toBe(90);
      });

      it('returns longest matching pattern when multiple patterns apply', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              'datasource-*': 90,
              'datasource-n*': 100,
              '*': 45,
            },
          },
        });

        const res = getTtlOverride('datasource-npm' as never);

        expect(res).toBe(100);
      });

      it('selects longest matching pattern across all configs', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              '*': 10,
              'datasource-*': 20,
              'datasource-npm*': 30,
              'datasource-npm-*': 40,
            },
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
          packageCache: {
            ttlOverride: {
              // @ts-expect-error -- testing
              'datasource-*': 'invalid',
              'datasource-n*': 100,
              '*': 45,
            },
          },
        });

        const res = getTtlOverride('datasource-npm' as never);

        expect(res).toBe(100);
      });

      it('returns undefined when no patterns match', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              'changelog-*': 90,
              'preset-*': 100,
            },
          },
        });

        const res = getTtlOverride('datasource-npm' as never);

        expect(res).toBeUndefined();
      });

      it('applies patterns consistently regardless of case in config order', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              'Datasource-*': 120,
              'datasource-*': 90,
            },
          },
        });

        const res = getTtlOverride('datasource-docker' as never);

        expect(res).toBe(120);
      });
    });

    describe('Edge cases', () => {
      it('handles empty string pattern', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              '': 30,
              'datasource-npm': 120,
            },
          },
        });

        const resNpm = getTtlOverride('datasource-npm' as never);
        const resEmpty = getTtlOverride('' as never);

        expect(resNpm).toBe(120);
        expect(resEmpty).toBe(30);
      });

      it('treats null and undefined values as invalid', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              // @ts-expect-error -- testing
              'datasource-npm': null,
              // @ts-expect-error -- testing
              'datasource-docker': undefined,
              'datasource-maven': 90,
            },
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
          packageCache: {
            ttlOverride: {
              'datasource-npm': 999999999,
            },
          },
        });

        const res = getTtlOverride('datasource-npm' as never);

        expect(res).toBe(999999999);
      });

      it('handles negative numbers', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              'datasource-npm': -100,
            },
          },
        });

        const res = getTtlOverride('datasource-npm' as never);

        expect(res).toBe(-100);
      });

      it('treats string numbers as invalid, only accepts number types', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              // @ts-expect-error -- testing
              'datasource-npm': '120',
              'datasource-docker': 90,
            },
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
          packageCache: {
            ttlOverride: {
              'datasource-npm': 120,
            },
          },
        });

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 120,
          hardTtlMinutes: 10080,
        });
      });

      it('applies custom packageCache.hardTtlMinutes from config', () => {
        GlobalConfig.set({ packageCache: { hardTtlMinutes: 1440 } });

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 60,
          hardTtlMinutes: 1440,
        });
      });

      it('resolves TTL with glob pattern overrides', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              'datasource-*': 180,
            },
            hardTtlMinutes: 2880,
          },
        });

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 180,
          hardTtlMinutes: 2880,
        });
      });

      it('resolves TTL correctly with multiple overlapping overrides', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              'datasource-*': 100,
              'datasource-npm': 200,
              '*': 50,
            },
            hardTtlMinutes: 5760,
          },
        });

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 200,
          hardTtlMinutes: 5760,
        });
      });
    });

    describe('Hard TTL calculation', () => {
      it('uses maximum of softTtlMinutes and packageCache.hardTtlMinutes for hardTtlMinutes', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              'datasource-npm': 20160,
            },
            hardTtlMinutes: 1440,
          },
        });

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 20160,
          hardTtlMinutes: 20160,
        });
      });

      it('handles negative packageCache.hardTtlMinutes config', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              'datasource-npm': 120,
            },
            hardTtlMinutes: -1,
          },
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
          packageCache: {
            ttlOverride: {
              'datasource-npm': 0,
            },
            hardTtlMinutes: 1440,
          },
        });

        const res = resolveTtlValues('datasource-npm' as never, 60);

        expect(res).toEqual({
          softTtlMinutes: 0,
          hardTtlMinutes: 1440,
        });
      });

      it('uses fallback when override is not a number', () => {
        GlobalConfig.set({
          packageCache: {
            ttlOverride: {
              // @ts-expect-error -- testing
              'datasource-npm': 'invalid',
            },
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
