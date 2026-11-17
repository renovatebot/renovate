import * as _managers from '../../../../modules/manager/index.ts';
import { resolveRangeStrategy } from './range-strategy.ts';
import type { LookupUpdateConfig } from './types.ts';

vi.mock('../../../../modules/manager/index.ts');
const { getRangeStrategy } = vi.mocked(_managers);

const config: LookupUpdateConfig = {
  datasource: 'npm',
  packageName: 'foo',
  currentValue: '1.0.0',
  versioning: 'npm',
  rangeStrategy: 'replace',
};

describe('workers/repository/process/lookup/range-strategy', () => {
  describe('resolveRangeStrategy()', () => {
    it('returns the manager range strategy', () => {
      getRangeStrategy.mockReturnValueOnce('bump');

      expect(resolveRangeStrategy(config)).toBe('bump');
    });

    it('returns null if the manager has none', () => {
      getRangeStrategy.mockReturnValueOnce(null);

      expect(resolveRangeStrategy(config)).toBeNull();
    });

    it('keeps update-lockfile for vulnerability alerts with a lockedVersion', () => {
      getRangeStrategy.mockReturnValueOnce('update-lockfile');

      expect(
        resolveRangeStrategy({
          ...config,
          isVulnerabilityAlert: true,
          lockedVersion: '1.0.0',
        }),
      ).toBe('update-lockfile');
    });

    it('bumps vulnerability alerts without a lockedVersion', () => {
      getRangeStrategy.mockReturnValueOnce('update-lockfile');

      expect(
        resolveRangeStrategy({ ...config, isVulnerabilityAlert: true }),
      ).toBe('bump');
    });

    it('updates the lockfile for unconstrained vulnerability alerts', () => {
      getRangeStrategy.mockReturnValueOnce('replace');

      expect(
        resolveRangeStrategy({
          ...config,
          isVulnerabilityAlert: true,
          currentValue: undefined,
          lockedVersion: '1.0.0',
        }),
      ).toBe('update-lockfile');
    });
  });
});
