// Import options to populate the global option defaults registry
import './options/index.ts';
import { GlobalConfig } from './global.ts';

describe('config/global', () => {
  beforeEach(() => {
    GlobalConfig.reset();
  });

  it('all values in OPTIONS are sorted', () => {
    const defined = GlobalConfig.OPTIONS;

    const sorted = [...defined].sort();

    expect(defined, 'OPTIONS should be sorted alphabetically').toStrictEqual(
      sorted,
    );
  });

  describe('get()', () => {
    it('returns option default when value is not set', () => {
      expect(GlobalConfig.get('binarySource')).toBe('install');
    });

    it('returns option default for array options', () => {
      expect(GlobalConfig.get('allowedUnsafeExecutions')).toStrictEqual([]);
    });

    it('returns a new array instance on each call to prevent mutation', () => {
      const first = GlobalConfig.get('allowedUnsafeExecutions');
      const second = GlobalConfig.get('allowedUnsafeExecutions');
      expect(first).toStrictEqual(second);
      expect(first).not.toBe(second);
    });

    it('returns explicitly set value over option default', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(GlobalConfig.get('binarySource')).toBe('docker');
    });

    it('returns undefined for options without a defined default', () => {
      expect(GlobalConfig.get('cacheDir')).toBeUndefined();
    });

    it('falls back to provided defaultValue when option has no defined default', () => {
      expect(GlobalConfig.get('cacheDir', '/tmp/cache')).toBe('/tmp/cache');
    });
  });
});
