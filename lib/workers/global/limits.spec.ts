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
    setMaxLimit(Limit.Commits, 1);
    expect(isLimitReached(Limit.Commits)).toBe(true);
  });

  it('allow zero', () => {
    setMaxLimit(Limit.PullRequests, 0, true);
    expect(isLimitReached(Limit.PullRequests)).toBeTrue();

    setMaxLimit(Limit.PullRequests, 0, false);
    expect(isLimitReached(Limit.PullRequests)).toBeFalse();
  });
});
