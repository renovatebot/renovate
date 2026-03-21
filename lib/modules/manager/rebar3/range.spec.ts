import { getRangeStrategy } from './range.ts';

describe('modules/manager/rebar3/range', () => {
  it('returns widen for complex ranges with bump strategy', () => {
    expect(
      getRangeStrategy({
        currentValue: '>= 1.0.0 and < 2.0.0',
        rangeStrategy: 'bump',
      }),
    ).toBe('widen');
  });

  it('returns the configured strategy when not auto', () => {
    expect(
      getRangeStrategy({
        currentValue: '~> 1.0',
        rangeStrategy: 'pin',
      }),
    ).toBe('pin');
  });

  it('returns widen for complex ranges with auto strategy', () => {
    expect(
      getRangeStrategy({
        currentValue: '>= 1.0.0 and < 2.0.0',
        rangeStrategy: 'auto',
      }),
    ).toBe('widen');
  });

  it('returns update-lockfile for simple ranges with auto strategy', () => {
    expect(
      getRangeStrategy({
        currentValue: '~> 1.0',
        rangeStrategy: 'auto',
      }),
    ).toBe('update-lockfile');
  });

  it('returns update-lockfile when currentValue is undefined', () => {
    expect(
      getRangeStrategy({
        currentValue: undefined,
        rangeStrategy: 'auto',
      }),
    ).toBe('update-lockfile');
  });
});
