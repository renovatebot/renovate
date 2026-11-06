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

  describe('get()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('falls back to the default of a defaulted option', () => {
      GlobalConfig.set({ dockerChildPrefix: undefined, onboarding: undefined });

      const prefix = GlobalConfig.get('dockerChildPrefix');
      const onboarding = GlobalConfig.get('onboarding');
      const toolSettings = GlobalConfig.get('toolSettings');

      expectTypeOf(prefix).toEqualTypeOf<string>();
      expectTypeOf(onboarding).toEqualTypeOf<boolean>();
      expect(prefix).toBe('renovate_');
      expect(onboarding).toBeTrue();
      expect(toolSettings).toEqual({ jvmMaxMemory: 512, jvmMemory: 512 });
    });

    it('prefers the configured value over the default', () => {
      GlobalConfig.set({ dockerChildPrefix: 'custom_' });

      expect(GlobalConfig.get('dockerChildPrefix')).toBe('custom_');
    });

    it('has no value for an option without a default', () => {
      const endpoint = GlobalConfig.get('endpoint');

      expectTypeOf(endpoint).toEqualTypeOf<string | undefined>();
      expect(endpoint).toBeUndefined();
    });

    it('gives the config as it was set without a key', () => {
      GlobalConfig.set({ endpoint: 'https://e' });

      const config = GlobalConfig.get();

      expectTypeOf(config.dockerChildPrefix).toEqualTypeOf<
        string | undefined
      >();
      expect(config.endpoint).toBe('https://e');
      expect(config.dockerChildPrefix).toBeUndefined();
    });
  });

  describe('getRequired()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('gives the directory', () => {
      GlobalConfig.set({ localDir: '/local', cacheDir: '/cache' });

      expect(GlobalConfig.getRequired('localDir')).toBe('/local');
      expect(GlobalConfig.getRequired('cacheDir')).toBe('/cache');
    });

    it('throws when the directory is not set', () => {
      expect(() => GlobalConfig.getRequired('localDir')).toThrow(
        'Global config localDir is not set',
      );
    });
  });

  it('all values in OPTIONS are sorted', () => {
    const defined = GlobalConfig.OPTIONS;

    const sorted = [...defined].sort();

    expect(defined, 'OPTIONS should be sorted alphabetically').toStrictEqual(
      sorted,
    );
  });
});
