import {
  Limit,
  incLimitedValue,
  isLimitReached,
  resetAllLimits,
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
    setMaxLimit(Limit.Commits, 3);

    expect(isLimitReached(Limit.Commits)).toBeFalse();

    incLimitedValue(Limit.Commits, 2);
    expect(isLimitReached(Limit.Commits)).toBeFalse();

    incLimitedValue(Limit.Commits);
    expect(isLimitReached(Limit.Commits)).toBeTrue();

    incLimitedValue(Limit.Commits);
    expect(isLimitReached(Limit.Commits)).toBeTrue();
  });

  it('defaults to unlimited', () => {
    expect(isLimitReached(Limit.Commits)).toBeFalse();
  });

  it('increments undefined', () => {
    incLimitedValue(Limit.Commits);
    expect(isLimitReached(Limit.Commits)).toBeFalse();
  });

  it('resets counter', () => {
    setMaxLimit(Limit.Commits, 1);
    incLimitedValue(Limit.Commits);
    expect(isLimitReached(Limit.Commits)).toBeTrue();
    setMaxLimit(Limit.Commits, 1);
    expect(isLimitReached(Limit.Commits)).toBeFalse();
  });

  it('resets limit', () => {
    setMaxLimit(Limit.Commits, 1);
    incLimitedValue(Limit.Commits);
    expect(isLimitReached(Limit.Commits)).toBeTrue();
    setMaxLimit(Limit.Commits, null);
    expect(isLimitReached(Limit.Commits)).toBeFalse();
  });

  it('sets non-positive limit as reached', () => {
    setMaxLimit(Limit.Commits, 0);
    expect(isLimitReached(Limit.Commits)).toBeTrue();
    setMaxLimit(Limit.Commits, -1000);
    expect(isLimitReached(Limit.Commits)).toBeTrue();
  });
});
