import {
  Limit,
  incLimitedValue,
  isLimitReached,
  resetAllLimits,
  setMaxLimit,
} from './limits';

describe('lib/workers/global/limits', () => {
  beforeEach(() => {
    resetAllLimits();
  });

  beforeEach(() => {
    resetAllLimits();
  });

  it('increments limited value', () => {
    setMaxLimit(Limit.Commits, 3);

    expect(isLimitReached(Limit.Commits)).toBe(false);

    incLimitedValue(Limit.Commits, 2);
    expect(isLimitReached(Limit.Commits)).toBe(false);

    incLimitedValue(Limit.Commits);
    expect(isLimitReached(Limit.Commits)).toBe(true);

    incLimitedValue(Limit.Commits);
    expect(isLimitReached(Limit.Commits)).toBe(true);
  });

  it('defaults to unlimited', () => {
    expect(isLimitReached(Limit.Commits)).toBe(false);
  });

  it('increments undefined', () => {
    incLimitedValue(Limit.Commits);
    expect(isLimitReached(Limit.Commits)).toBe(false);
  });

  it('resets counter', () => {
    setMaxLimit(Limit.Commits, 1);
    incLimitedValue(Limit.Commits);
    expect(isLimitReached(Limit.Commits)).toBe(true);
    setMaxLimit(Limit.Commits, 1);
    expect(isLimitReached(Limit.Commits)).toBe(false);
  });

  it('zero as unlimited', () => {
    setMaxLimit(Limit.Commits, 0);
    expect(isLimitReached(Limit.Commits)).toBeFalse();
  });

  it('zero as limit', () => {
    setMaxLimit(Limit.Commits, 0, false);
    expect(isLimitReached(Limit.Commits)).toBeTrue();
  });
});
