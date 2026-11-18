import { GlobalConfig } from './global.ts';
import type { InternalGlobalConfigOptions, RepoGlobalConfig } from './types.ts';

describe('config/global', () => {
  it('OPTIONS contains every key of RepoGlobalConfig', () => {
    // If this fails to compile, a field was added to (or removed from) `RepoGlobalConfig` without updating `GlobalConfig.OPTIONS` to match
    // Unlike the forward direction (every entry in OPTIONS is a valid key of RepoGlobalConfig), which is enforced by the `satisfies` clause on OPTIONS itself, this direction can't be caught by the compiler any other way: adding an optional field to an interface doesn't require every array of its keys to be updated
    //
    // In more rare cases, it's been missed from InternalGlobalConfigOptions
    expectTypeOf<(typeof GlobalConfig.OPTIONS)[number]>().toEqualTypeOf<
      keyof RepoGlobalConfig | keyof InternalGlobalConfigOptions
    >();
  });

  it('all values in OPTIONS are sorted', () => {
    const defined = GlobalConfig.OPTIONS;

    const sorted = [...defined].sort();

    expect(defined, 'OPTIONS should be sorted alphabetically').toStrictEqual(
      sorted,
    );
  });

  describe('get()', () => {
    afterEach(() => {
      GlobalConfig.reset();
    });

    it('returns the defaults of an object option which is not set', () => {
      GlobalConfig.set({});

      expect(GlobalConfig.get('packageCache')).toEqual({
        hardTtlMinutes: 10080,
        presetPersistence: false,
        privatePackages: false,
        ttlOverride: {},
      });
    });

    it('fills in the defaults of the fields an object option does not set', () => {
      GlobalConfig.set({
        packageCache: { privatePackages: true },
        repositoryCache: { state: 'enabled' },
      });

      expect(GlobalConfig.get('packageCache')).toEqual({
        hardTtlMinutes: 10080,
        presetPersistence: false,
        privatePackages: true,
        ttlOverride: {},
      });
      expect(GlobalConfig.get('repositoryCache')).toEqual({
        state: 'enabled',
        type: 'local',
        forceLocal: false,
        maximumHttpDays: 90,
        prSyncMaxPages: 100,
      });
    });

    it('does not fill in the defaults of other object options', () => {
      GlobalConfig.set({ productLinks: { homepage: 'https://example.com' } });

      expect(GlobalConfig.get('productLinks')).toEqual({
        homepage: 'https://example.com',
      });
    });
  });
});
