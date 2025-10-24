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
import { partial } from '~test/util';

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
          commitHourlyLimit: 9,
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
      ]);

      expect(calcLimit(upgrades, 'commitHourlyLimit')).toBe(9);
      expect(calcLimit(upgrades, 'prHourlyLimit')).toBe(10);
      expect(calcLimit(upgrades, 'branchConcurrentLimit')).toBe(11);
      expect(calcLimit(upgrades, 'prConcurrentLimit')).toBe(12);
    });

    it('inherits prConcurrentLimit if branchConcurrentLimit is null', () => {
      const upgrades = partial<BranchUpgradeConfig>([
        {
          commitHourlyLimit: 9,
          prHourlyLimit: 10,
          branchConcurrentLimit: null,
          prConcurrentLimit: 12,
        },
      ]);

      expect(calcLimit(upgrades, 'commitHourlyLimit')).toBe(9);
      expect(calcLimit(upgrades, 'prHourlyLimit')).toBe(10);
      expect(calcLimit(upgrades, 'branchConcurrentLimit')).toBe(12);
      expect(calcLimit(upgrades, 'prConcurrentLimit')).toBe(12);
    });

    it('returns 0 if atleast one upgrade has no limit in the branch', () => {
      const upgrades = partial<BranchUpgradeConfig>([
        {
          commitHourlyLimit: 9,
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          commitHourlyLimit: 0,
          prHourlyLimit: 0,
          branchConcurrentLimit: 0,
          prConcurrentLimit: 0,
        },
        {
          commitHourlyLimit: 1,
          prHourlyLimit: 1,
          branchConcurrentLimit: 1,
          prConcurrentLimit: 1,
        },
      ]);

      expect(calcLimit(upgrades, 'commitHourlyLimit')).toBe(0);
      expect(calcLimit(upgrades, 'prHourlyLimit')).toBe(0);
      expect(calcLimit(upgrades, 'branchConcurrentLimit')).toBe(0);
      expect(calcLimit(upgrades, 'prConcurrentLimit')).toBe(0);
    });

    it('computes the lowest limit if multiple limits are present', () => {
      const upgrades = partial<BranchUpgradeConfig>([
        {
          commitHourlyLimit: 9,
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          commitHourlyLimit: 10,
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          commitHourlyLimit: 5,
          prHourlyLimit: 1,
          branchConcurrentLimit: 1,
          prConcurrentLimit: 1,
        },
        {
          commitHourlyLimit: 5,
          prHourlyLimit: 5,
          branchConcurrentLimit: 6,
          prConcurrentLimit: 3,
        },
        {
          commitHourlyLimit: 5,
          prHourlyLimit: 5,
          branchConcurrentLimit: null,
          prConcurrentLimit: undefined,
        },
        {
          commitHourlyLimit: 5,
          prHourlyLimit: 5,
          branchConcurrentLimit: 6,
          prConcurrentLimit: 2,
        },
      ]);

      expect(calcLimit(upgrades, 'commitHourlyLimit')).toBe(5);
      expect(calcLimit(upgrades, 'prHourlyLimit')).toBe(1);
      expect(calcLimit(upgrades, 'branchConcurrentLimit')).toBe(1);
      expect(calcLimit(upgrades, 'prConcurrentLimit')).toBe(1);
    });
  });

  describe('hasMultipleLimits', () => {
    it('handles single limit', () => {
      const upgrades = partial<BranchUpgradeConfig>([
        {
          commitHourlyLimit: 9,
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
      ]);
      expect(hasMultipleLimits(upgrades, 'commitHourlyLimit')).toBe(false);
      expect(hasMultipleLimits(upgrades, 'prHourlyLimit')).toBe(false);
      expect(hasMultipleLimits(upgrades, 'branchConcurrentLimit')).toBe(false);
      expect(hasMultipleLimits(upgrades, 'prConcurrentLimit')).toBe(false);
    });

    it('returns false if there are multiple limits with value', () => {
      const upgrades = partial<BranchUpgradeConfig>([
        {
          commitHourlyLimit: 9,
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          commitHourlyLimit: 9,
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
      ]);
      expect(hasMultipleLimits(upgrades, 'commitHourlyLimit')).toBe(false);
      expect(hasMultipleLimits(upgrades, 'prHourlyLimit')).toBe(false);
      expect(hasMultipleLimits(upgrades, 'branchConcurrentLimit')).toBe(false);
      expect(hasMultipleLimits(upgrades, 'prConcurrentLimit')).toBe(false);
    });

    it('handles multiple limits', () => {
      const upgrades = partial<BranchUpgradeConfig>([
        {
          commitHourlyLimit: 9,
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          commitHourlyLimit: 10,
          prHourlyLimit: 11,
          branchConcurrentLimit: 12,
          prConcurrentLimit: 13,
        },
        {
          commitHourlyLimit: 5,
          prHourlyLimit: 0,
          branchConcurrentLimit: null,
          prConcurrentLimit: 3,
        },
      ]);
      expect(hasMultipleLimits(upgrades, 'commitHourlyLimit')).toBe(true);
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
          commitHourlyLimit: 9,
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          commitHourlyLimit: 10,
          prHourlyLimit: 11,
          branchConcurrentLimit: 12,
          prConcurrentLimit: 13,
        },
        {
          commitHourlyLimit: 5,
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

    it('returns false when commit hourly limit is 0 (unlimited)', () => {
      setCount('HourlyCommits', 100);
      const upgrades = partial<BranchUpgradeConfig>([
        {
          commitHourlyLimit: 0, // Unlimited
        },
      ]);
      expect(
        isLimitReached('HourlyCommits', partial<BranchConfig>({ upgrades })),
      ).toBe(false);
    });

    it('returns false when commit hourly limit is not reached', () => {
      setCount('HourlyCommits', 2);
      const upgrades = partial<BranchUpgradeConfig>([
        {
          commitHourlyLimit: 5,
        },
      ]);
      expect(
        isLimitReached('HourlyCommits', partial<BranchConfig>({ upgrades })),
      ).toBe(false);
    });

    it('returns true when pr hourly limit is reached', () => {
      setCount('Branches', 2);
      setCount('ConcurrentPRs', 2);
      setCount('HourlyCommits', 3);
      setCount('HourlyPRs', 2);
      const upgrades = partial<BranchUpgradeConfig>([
        {
          commitHourlyLimit: 9,
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          commitHourlyLimit: 10,
          prHourlyLimit: 11,
          branchConcurrentLimit: 12,
          prConcurrentLimit: 13,
        },
        {
          commitHourlyLimit: 5,
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

    it('returns true when commit hourly limit is reached for HourlyCommits check', () => {
      setCount('Branches', 2);
      setCount('ConcurrentPRs', 2);
      setCount('HourlyCommits', 3);
      setCount('HourlyPRs', 1);
      const upgrades = partial<BranchUpgradeConfig>([
        {
          commitHourlyLimit: 9,
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          commitHourlyLimit: 10,
          prHourlyLimit: 11,
          branchConcurrentLimit: 12,
          prConcurrentLimit: 13,
        },
        {
          commitHourlyLimit: 3,
          prHourlyLimit: 2,
          branchConcurrentLimit: null,
          prConcurrentLimit: 3,
        },
      ]);
      // Commit hourly limit should only affect HourlyCommits check
      expect(
        isLimitReached('HourlyCommits', partial<BranchConfig>({ upgrades })),
      ).toBe(true);
      // Commit hourly limit should NOT affect Branches check
      expect(
        isLimitReached('Branches', partial<BranchConfig>({ upgrades })),
      ).toBe(false);
      // Commit hourly limit should NOT affect ConcurrentPRs check
      expect(
        isLimitReached('ConcurrentPRs', partial<BranchConfig>({ upgrades })),
      ).toBe(false);
    });

    it('returns true when concurrent limit is reached', () => {
      setCount('Branches', 3);
      setCount('ConcurrentPRs', 3);
      setCount('HourlyCommits', 4);
      setCount('HourlyPRs', 4);
      const upgrades = partial<BranchUpgradeConfig>([
        {
          commitHourlyLimit: 9,
          prHourlyLimit: 10,
          branchConcurrentLimit: 11,
          prConcurrentLimit: 12,
        },
        {
          commitHourlyLimit: 10,
          prHourlyLimit: 11,
          branchConcurrentLimit: 12,
          prConcurrentLimit: 13,
        },
        {
          commitHourlyLimit: 5,
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

    it('commit hourly limit does not block branch or PR creation', () => {
      setCount('Branches', 0);
      setCount('ConcurrentPRs', 1);
      setCount('HourlyCommits', 2); // Commit limit reached
      setCount('HourlyPRs', 0); // PR limit not reached
      const upgrades = partial<BranchUpgradeConfig>([
        {
          commitHourlyLimit: 2, // Limit reached
          prHourlyLimit: 10, // Limit not reached
          branchConcurrentLimit: 10,
          prConcurrentLimit: 0, // Unlimited
        },
      ]);
      // Commit limit should only block HourlyCommits
      expect(
        isLimitReached('HourlyCommits', partial<BranchConfig>({ upgrades })),
      ).toBe(true);
      // Should NOT block branch creation check (concurrent branch limit still OK)
      expect(
        isLimitReached('Branches', partial<BranchConfig>({ upgrades })),
      ).toBe(false);
      // Should NOT block PR creation
      expect(
        isLimitReached('ConcurrentPRs', partial<BranchConfig>({ upgrades })),
      ).toBe(false);
    });

    it('returns false for branches when hourly PR limit is 0 (unlimited)', () => {
      setCount('Branches', 5);
      setCount('HourlyPRs', 100);
      const upgrades = partial<BranchUpgradeConfig>([
        {
          prHourlyLimit: 0, // Unlimited
          branchConcurrentLimit: 10,
        },
      ]);
      expect(
        isLimitReached('Branches', partial<BranchConfig>({ upgrades })),
      ).toBe(false);
    });

    it('returns false for concurrent PRs when hourly PR limit is 0 (unlimited)', () => {
      setCount('ConcurrentPRs', 5);
      setCount('HourlyPRs', 100);
      const upgrades = partial<BranchUpgradeConfig>([
        {
          prHourlyLimit: 0, // Unlimited
          prConcurrentLimit: 10,
        },
      ]);
      expect(
        isLimitReached('ConcurrentPRs', partial<BranchConfig>({ upgrades })),
      ).toBe(false);
    });

    it('returns true when concurrent branch limit reached but not hourly PR limit', () => {
      setCount('Branches', 5);
      setCount('HourlyPRs', 1);
      const upgrades = partial<BranchUpgradeConfig>([
        {
          prHourlyLimit: 10,
          branchConcurrentLimit: 5,
        },
      ]);
      expect(
        isLimitReached('Branches', partial<BranchConfig>({ upgrades })),
      ).toBe(true);
    });

    it('returns true when concurrent PR limit reached but not hourly PR limit', () => {
      setCount('ConcurrentPRs', 3);
      setCount('HourlyPRs', 1);
      const upgrades = partial<BranchUpgradeConfig>([
        {
          prHourlyLimit: 10,
          prConcurrentLimit: 3,
        },
      ]);
      expect(
        isLimitReached('ConcurrentPRs', partial<BranchConfig>({ upgrades })),
      ).toBe(true);
    });
  });
});
