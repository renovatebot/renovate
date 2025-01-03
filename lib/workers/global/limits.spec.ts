import { partial } from '../../../test/util';
import type { BranchConfig, BranchUpgradeConfig } from '../types';
import {
  calcLimit,
  hasMultipleLimits,
  incCountValue,
  incLimitedValue,
  isLimitReached,
  resetAllLimits,
  setCount,
  setMaxLimit,
} from './limits';

describe('workers/global/limits', () => {
  beforeEach(() => {
    resetAllLimits();
  });

  beforeEach(() => {
    resetAllLimits();
  });

  it('increments limited value', () => {
    setMaxLimit('Commits', 3);

    expect(isLimitReached('Commits')).toBeFalse();

    incLimitedValue('Commits', 2);
    expect(isLimitReached('Commits')).toBeFalse();

    incLimitedValue('Commits');
    expect(isLimitReached('Commits')).toBeTrue();

    incLimitedValue('Commits');
    expect(isLimitReached('Commits')).toBeTrue();
  });

  it('defaults to unlimited', () => {
    expect(isLimitReached('Commits')).toBeFalse();
  });

  it('increments undefined', () => {
    incLimitedValue('Commits');
    expect(isLimitReached('Commits')).toBeFalse();
  });

  it('resets counter', () => {
    setMaxLimit('Commits', 1);
    incLimitedValue('Commits');
    expect(isLimitReached('Commits')).toBeTrue();
    setMaxLimit('Commits', 1);
    expect(isLimitReached('Commits')).toBeFalse();
  });

  it('resets limit', () => {
    setMaxLimit('Commits', 1);
    incLimitedValue('Commits');
    expect(isLimitReached('Commits')).toBeTrue();
    setMaxLimit('Commits', null);
    expect(isLimitReached('Commits')).toBeFalse();
  });

  it('sets non-positive limit as reached', () => {
    setMaxLimit('Commits', 0);
    expect(isLimitReached('Commits')).toBeTrue();
    setMaxLimit('Commits', -1000);
    expect(isLimitReached('Commits')).toBeTrue();
  });

  describe('calcLimit', () => {
    it('handles single upgrade', () => {
      const upgrades = partial<BranchUpgradeConfig>([
        {
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
      ]);

      expect(calcLimit(upgrades, 'prHourlyLimit')).toBe(10);
      expect(calcLimit(upgrades, 'branchConcurrentLimit')).toBe(11);
      expect(calcLimit(upgrades, 'prConcurrentLimit')).toBe(12);
    });

    it('inherits prConcurrentLimit if branchConcurrentLimit is null', () => {
      const upgrades = partial<BranchUpgradeConfig>([
        {
          prHourlyLimit: 10,
          branchConcurrentLimit: null,
          prConcurrentLimit: 12,
        },
      ]);

      expect(calcLimit(upgrades, 'prHourlyLimit')).toBe(10);
      expect(calcLimit(upgrades, 'branchConcurrentLimit')).toBe(12);
      expect(calcLimit(upgrades, 'prConcurrentLimit')).toBe(12);
    });

    it('returns 0 if atleast one upgrade has no limit in the branch', () => {
      const upgrades = partial<BranchUpgradeConfig>([
        {
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          prHourlyLimit: 0,
          branchConcurrentLimit: 0,
          prConcurrentLimit: 0,
        },
        {
          prHourlyLimit: 1,
          branchConcurrentLimit: 1,
          prConcurrentLimit: 1,
        },
      ]);

      expect(calcLimit(upgrades, 'prHourlyLimit')).toBe(0);
      expect(calcLimit(upgrades, 'branchConcurrentLimit')).toBe(0);
      expect(calcLimit(upgrades, 'prConcurrentLimit')).toBe(0);
    });

    it('computes the lowest limit if multiple limits are present', () => {
      const upgrades = partial<BranchUpgradeConfig>([
        {
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          prHourlyLimit: 1,
          branchConcurrentLimit: 1,
          prConcurrentLimit: 1,
        },
        {
          prHourlyLimit: 5,
          branchConcurrentLimit: 6,
          prConcurrentLimit: 3,
        },
        {
          prHourlyLimit: 5,
          branchConcurrentLimit: null,
          prConcurrentLimit: undefined,
        },
        {
          prHourlyLimit: 5,
          branchConcurrentLimit: 6,
          prConcurrentLimit: 2,
        },
      ]);

      expect(calcLimit(upgrades, 'prHourlyLimit')).toBe(1);
      expect(calcLimit(upgrades, 'branchConcurrentLimit')).toBe(1);
      expect(calcLimit(upgrades, 'prConcurrentLimit')).toBe(1);
    });
  });

  describe('hasMultipleLimits', () => {
    it('handles single limit', () => {
      const upgrades = partial<BranchUpgradeConfig>([
        {
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
      ]);
      expect(hasMultipleLimits(upgrades, 'prHourlyLimit')).toBe(false);
      expect(hasMultipleLimits(upgrades, 'branchConcurrentLimit')).toBe(false);
      expect(hasMultipleLimits(upgrades, 'prConcurrentLimit')).toBe(false);
    });

    it('returns false if there are multiple limits with value', () => {
      const upgrades = partial<BranchUpgradeConfig>([
        {
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
      ]);
      expect(hasMultipleLimits(upgrades, 'prHourlyLimit')).toBe(false);
      expect(hasMultipleLimits(upgrades, 'branchConcurrentLimit')).toBe(false);
      expect(hasMultipleLimits(upgrades, 'prConcurrentLimit')).toBe(false);
    });

    it('handles multiple limits', () => {
      const upgrades = partial<BranchUpgradeConfig>([
        {
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          prHourlyLimit: 11,
          branchConcurrentLimit: 12,
          prConcurrentLimit: 13,
        },
        {
          prHourlyLimit: 0,
          branchConcurrentLimit: null,
          prConcurrentLimit: 3,
        },
      ]);
      expect(hasMultipleLimits(upgrades, 'prHourlyLimit')).toBe(true);
      expect(hasMultipleLimits(upgrades, 'branchConcurrentLimit')).toBe(true);
      expect(hasMultipleLimits(upgrades, 'prConcurrentLimit')).toBe(true);
    });
  });

  describe('isLimitReached', () => {
    it('returns false based on concurrent limits', () => {
      setCount('ConcurrentPRs', 1);
      setCount('HourlyPRs', 1);
      incCountValue('Branches'); // using incCountValue so it gets test coverage
      const upgrades = partial<BranchUpgradeConfig>([
        {
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          prHourlyLimit: 11,
          branchConcurrentLimit: 12,
          prConcurrentLimit: 13,
        },
        {
          prHourlyLimit: 0,
          branchConcurrentLimit: null,
          prConcurrentLimit: 3,
        },
      ]);
      expect(
        isLimitReached('Branches', partial<BranchConfig>({ upgrades })),
      ).toBe(false);
      expect(
        isLimitReached('ConcurrentPRs', partial<BranchConfig>({ upgrades })),
      ).toBe(false);
    });

    it('returns true when hourly limit is reached', () => {
      setCount('Branches', 2);
      setCount('ConcurrentPRs', 2);
      setCount('HourlyPRs', 2);
      const upgrades = partial<BranchUpgradeConfig>([
        {
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          prHourlyLimit: 11,
          branchConcurrentLimit: 12,
          prConcurrentLimit: 13,
        },
        {
          prHourlyLimit: 2,
          branchConcurrentLimit: null,
          prConcurrentLimit: 3,
        },
      ]);
      expect(
        isLimitReached('Branches', partial<BranchConfig>({ upgrades })),
      ).toBe(true);
      expect(
        isLimitReached('ConcurrentPRs', partial<BranchConfig>({ upgrades })),
      ).toBe(true);
    });

    it('returns true when concurrent limit is reached', () => {
      setCount('Branches', 3);
      setCount('ConcurrentPRs', 3);
      setCount('HourlyPRs', 4);
      const upgrades = partial<BranchUpgradeConfig>([
        {
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          prHourlyLimit: 11,
          branchConcurrentLimit: 12,
          prConcurrentLimit: 13,
        },
        {
          prHourlyLimit: 5,
          branchConcurrentLimit: null,
          prConcurrentLimit: 3,
        },
      ]);
      expect(
        isLimitReached('Branches', partial<BranchConfig>({ upgrades })),
      ).toBe(true);
      expect(
        isLimitReached('ConcurrentPRs', partial<BranchConfig>({ upgrades })),
      ).toBe(true);
    });
  });
});
