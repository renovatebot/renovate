import { GlobalConfig } from './global.ts';
import type { PackageRule } from './types.ts';

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

  describe('getPackageRules()', () => {
    it('returns packageRules passed to set()', () => {
      const packageRules: PackageRule[] = [
        { matchPackageNames: ['containerbase/node-prebuild'] },
      ];

      GlobalConfig.set({ packageRules });

      expect(GlobalConfig.getPackageRules()).toBe(packageRules);
    });

    it('does not strip packageRules from set() result', () => {
      const packageRules: PackageRule[] = [
        { matchPackageNames: ['containerbase/node-prebuild'] },
      ];

      const result = GlobalConfig.set({ packageRules });

      expect(result.packageRules).toBe(packageRules);
    });

    it('is cleared by reset()', () => {
      GlobalConfig.set({
        packageRules: [{ matchPackageNames: ['containerbase/node-prebuild'] }],
      });

      GlobalConfig.reset();

      expect(GlobalConfig.getPackageRules()).toEqual([]);
    });
  });
});
