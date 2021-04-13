import { getName } from '../../../test/util';
import {
  Limit,
  incLimitedValue,
  isLimitReached,
  resetAllLimits,
  setMaxLimit,
} from './limits';

describe(getName(__filename), () => {
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

  it('resets limit', () => {
    setMaxLimit(Limit.Commits, 1);
    incLimitedValue(Limit.Commits);
    expect(isLimitReached(Limit.Commits)).toBe(true);
    setMaxLimit(Limit.Commits, null);
    expect(isLimitReached(Limit.Commits)).toBe(false);
  });

  it('sets non-positive limit as reached', () => {
    setMaxLimit(Limit.Commits, 0);
    expect(isLimitReached(Limit.Commits)).toBeTrue();
    setMaxLimit(Limit.Commits, -1000);
    expect(isLimitReached(Limit.Commits)).toBeTrue();
  });
});
