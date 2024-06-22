import {
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
});
