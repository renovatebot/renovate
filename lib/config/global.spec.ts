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
    it('mirrors packageRules from set()', () => {
      const packageRules: PackageRule[] = [
        { matchPackageNames: ['containerbase/node-prebuild'] },
      ];

      const result = GlobalConfig.set({ packageRules });

      expect(GlobalConfig.getPackageRules()).toBe(packageRules);
      expect(result.packageRules).toBe(packageRules);

      GlobalConfig.reset();

      expect(GlobalConfig.getPackageRules()).toEqual([]);
    });
  });
});
