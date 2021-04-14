import { getName } from '../../../test/util';
import { compare, parseMavenBasedRange, parsePrefixRange } from './compare';
import { api } from '.';

describe(getName(__filename), () => {
  it('returns equality', () => {
    expect(compare('1', '1')).toEqual(0);
    expect(compare('a', 'a')).toEqual(0);

    expect(compare('1a1', '1.a.1')).toEqual(0);
    expect(compare('1a1', '1-a-1')).toEqual(0);
    expect(compare('1a1', '1_a_1')).toEqual(0);
    expect(compare('1a1', '1+a+1')).toEqual(0);
    expect(compare('1.a.1', '1a1')).toEqual(0);
    expect(compare('1-a-1', '1a1')).toEqual(0);
    expect(compare('1_a_1', '1a1')).toEqual(0);
    expect(compare('1+a+1', '1a1')).toEqual(0);

    expect(compare('1.a.1', '1-a+1')).toEqual(0);
    expect(compare('1-a+1', '1.a-1')).toEqual(0);
    expect(compare('1.a-1', '1a1')).toEqual(0);

    expect(compare('dev', 'dev')).toEqual(0);
    expect(compare('rc', 'rc')).toEqual(0);
    expect(compare('release', 'release')).toEqual(0);
    expect(compare('final', 'final')).toEqual(0);
    expect(compare('snapshot', 'SNAPSHOT')).toEqual(0);
    expect(compare('SNAPSHOT', 'snapshot')).toEqual(0);
    expect(compare('Hoxton.SR1', 'Hoxton.sr-1')).toEqual(0);
  });
  it('returns less than', () => {
    expect(compare('1.1', '1.2')).toEqual(-1);
    expect(compare('1.a', '1.1')).toEqual(-1);
    expect(compare('1.A', '1.B')).toEqual(-1);
    expect(compare('1.B', '1.a')).toEqual(-1);
    expect(compare('1.a', '1.b')).toEqual(-1);
    expect(compare('1.1', '1.1.0')).toEqual(-1);
    expect(compare('1.1.a', '1.1')).toEqual(-1);
    expect(compare('1.0-dev', '1.0-alpha')).toEqual(-1);
    expect(compare('1.0-alpha', '1.0-rc')).toEqual(-1);
    expect(compare('1.0-zeta', '1.0-rc')).toEqual(-1);
    expect(compare('1.0-rc', '1.0-release')).toEqual(-1);
    expect(compare('1.0-release', '1.0-final')).toEqual(-1);
    expect(compare('1.0-final', '1.0')).toEqual(-1);
    expect(compare('1.0-alpha', '1.0-SNAPSHOT')).toEqual(-1);
    expect(compare('1.0-SNAPSHOT', '1.0-zeta')).toEqual(-1);
    expect(compare('1.0-zeta', '1.0-rc')).toEqual(-1);
    expect(compare('1.0-rc', '1.0')).toEqual(-1);
    expect(compare('1.0', '1.0-20150201.121010-123')).toEqual(-1);
    expect(compare('1.0-20150201.121010-123', '1.1')).toEqual(-1);
    expect(compare('sNaPsHoT', 'snapshot')).toEqual(-1);
    expect(compare('Hoxton.RELEASE', 'Hoxton.SR1')).toEqual(-1);
  });
  it('returns greater than', () => {
    expect(compare('1.2', '1.1')).toEqual(1);
    expect(compare('1.1', '1.1.a')).toEqual(1);
    expect(compare('1.B', '1.A')).toEqual(1);
    expect(compare('1.a', '1.B')).toEqual(1);
    expect(compare('1.b', '1.a')).toEqual(1);
    expect(compare('1.1.0', '1.1')).toEqual(1);
    expect(compare('1.1', '1.a')).toEqual(1);
    expect(compare('1.0-alpha', '1.0-dev')).toEqual(1);
    expect(compare('1.0-rc', '1.0-alpha')).toEqual(1);
    expect(compare('1.0-rc', '1.0-zeta')).toEqual(1);
    expect(compare('1.0-release', '1.0-rc')).toEqual(1);
    expect(compare('1.0-final', '1.0-release')).toEqual(1);
    expect(compare('1.0', '1.0-final')).toEqual(1);
    expect(compare('1.0-SNAPSHOT', '1.0-alpha')).toEqual(1);
    expect(compare('1.0-zeta', '1.0-SNAPSHOT')).toEqual(1);
    expect(compare('1.0-rc', '1.0-zeta')).toEqual(1);
    expect(compare('1.0', '1.0-rc')).toEqual(1);
    expect(compare('1.0-20150201.121010-123', '1.0')).toEqual(1);
    expect(compare('1.1', '1.0-20150201.121010-123')).toEqual(1);
    expect(compare('snapshot', 'sNaPsHoT')).toEqual(1);
    expect(compare('Hoxton.SR1', 'Hoxton.RELEASE')).toEqual(1);
  });

  const invalidPrefixRanges = [
    '',
    '1.2.3-SNAPSHOT', // versions should be handled separately
    '1.2..+',
    '1.2.++',
  ];
  it('filters out incorrect prefix ranges', () => {
    invalidPrefixRanges.forEach((rangeStr) => {
      const range = parsePrefixRange(rangeStr);
      expect(range).toBeNull();
    });
  });

  const invalidMavenBasedRanges = [
    '',
    '1.2.3-SNAPSHOT', // versions should be handled separately
    '[]',
    '(',
    '[',
    ',',
    '[1.0',
    '1.0]',
    '[1.0],',
    ',[1.0]',
    '[2.0,1.0)',
    '[1.2,1.3],1.4',
    '[1.2,,1.3]',
    '[1,[2,3],4]',
    '[1.3,1.2]',
  ];
  it('filters out incorrect maven-based ranges', () => {
    invalidMavenBasedRanges.forEach((rangeStr) => {
      const range = parseMavenBasedRange(rangeStr);
      expect(range).toBeNull();
    });
  });
});

describe(getName(__filename), () => {
  it('isValid', () => {
    expect(api.isValid('1.0.0')).toBe(true);
    expect(api.isValid('[1.12.6,1.18.6]')).toBe(true);
    expect(api.isValid(undefined)).toBe(false);
  });

  it('isVersion', () => {
    expect(api.isVersion('')).toBe(false);

    expect(api.isVersion('latest.integration')).toBe(false);
    expect(api.isVersion('latest.release')).toBe(false);
    expect(api.isVersion('latest')).toBe(false);

    expect(api.isVersion('1')).toBe(true);
    expect(api.isVersion('a')).toBe(true);
    expect(api.isVersion('A')).toBe(true);
    expect(api.isVersion('1a1')).toBe(true);
    expect(api.isVersion('1.a.1')).toBe(true);
    expect(api.isVersion('1-a-1')).toBe(true);
    expect(api.isVersion('1_a_1')).toBe(true);
    expect(api.isVersion('1+a+1')).toBe(true);
    expect(api.isVersion('1!a!1')).toBe(false);

    expect(api.isVersion('1.0-20150201.121010-123')).toBe(true);
    expect(api.isVersion('dev')).toBe(true);
    expect(api.isVersion('rc')).toBe(true);
    expect(api.isVersion('release')).toBe(true);
    expect(api.isVersion('final')).toBe(true);
    expect(api.isVersion('SNAPSHOT')).toBe(true);

    expect(api.isVersion('1.2')).toBe(true);
    expect(api.isVersion('1..2')).toBe(false);
    expect(api.isVersion('1++2')).toBe(false);
    expect(api.isVersion('1--2')).toBe(false);
    expect(api.isVersion('1__2')).toBe(false);
  });
  it('checks if version is stable', () => {
    expect(api.isStable('')).toBeNull();
    expect(api.isStable('foobar')).toBe(true);
    expect(api.isStable('final')).toBe(true);
    expect(api.isStable('1')).toBe(true);
    expect(api.isStable('1.2')).toBe(true);
    expect(api.isStable('1.2.3')).toBe(true);
    expect(api.isStable('1.2.3.4')).toBe(true);
    expect(api.isStable('v1.2.3.4')).toBe(true);
    expect(api.isStable('1-alpha-1')).toBe(false);
    expect(api.isStable('1-b1')).toBe(false);
    expect(api.isStable('1-foo')).toBe(true);
    expect(api.isStable('1-final-1.0.0')).toBe(true);
    expect(api.isStable('1-release')).toBe(true);
    expect(api.isStable('1.final')).toBe(true);
    expect(api.isStable('1.0milestone1')).toBe(false);
    expect(api.isStable('1-sp')).toBe(true);
    expect(api.isStable('1-ga-1')).toBe(true);
    expect(api.isStable('1.3-groovy-2.5')).toBe(true);
    expect(api.isStable('1.3-RC1-groovy-2.5')).toBe(false);
    expect(api.isStable('Hoxton.RELEASE')).toBe(true);
    expect(api.isStable('Hoxton.SR')).toBe(true);
    expect(api.isStable('Hoxton.SR1')).toBe(true);

    // https://github.com/renovatebot/renovate/pull/5789
    expect(api.isStable('1.3.5-native-mt-1.3.71-release-429')).toBe(false);
  });
  it('returns major version', () => {
    expect(api.getMajor('')).toBeNull();
    expect(api.getMajor('1')).toEqual(1);
    expect(api.getMajor('1.2')).toEqual(1);
    expect(api.getMajor('1.2.3')).toEqual(1);
    expect(api.getMajor('v1.2.3')).toEqual(1);
    expect(api.getMajor('1rc42')).toEqual(1);
  });
  it('returns minor version', () => {
    expect(api.getMinor('')).toBeNull();
    expect(api.getMinor('1')).toEqual(0);
    expect(api.getMinor('1.2')).toEqual(2);
    expect(api.getMinor('1.2.3')).toEqual(2);
    expect(api.getMinor('v1.2.3')).toEqual(2);
    expect(api.getMinor('1.2.3.4')).toEqual(2);
    expect(api.getMinor('1-rc42')).toEqual(0);
  });
  it('returns patch version', () => {
    expect(api.getPatch('')).toBeNull();
    expect(api.getPatch('1')).toEqual(0);
    expect(api.getPatch('1.2')).toEqual(0);
    expect(api.getPatch('1.2.3')).toEqual(3);
    expect(api.getPatch('v1.2.3')).toEqual(3);
    expect(api.getPatch('1.2.3.4')).toEqual(3);
    expect(api.getPatch('1-rc10')).toEqual(0);
    expect(api.getPatch('1-rc42-1')).toEqual(0);
  });
  it('matches against maven ranges', () => {
    expect(api.matches('0', '[0,1]')).toBe(true);
    expect(api.matches('1', '[0,1]')).toBe(true);
    expect(api.matches('0', '(0,1)')).toBe(false);
    expect(api.matches('1', '(0,1)')).toBe(false);
    expect(api.matches('1', '(0,2)')).toBe(true);
    expect(api.matches('1', '[0,2]')).toBe(true);
    expect(api.matches('1', '(,1]')).toBe(true);
    expect(api.matches('1', '(,1)')).toBe(false);
    expect(api.matches('1', '[1,)')).toBe(true);
    expect(api.matches('1', '(1,)')).toBe(false);
    expect(api.matches('1', '[[]]')).toBeNull();
    expect(api.matches('0', '')).toBe(false);
    expect(api.matches('1', '1')).toBe(true);
    expect(api.matches('1.2.3', '1.2.+')).toBe(true);
    expect(api.matches('1.2.3.4', '1.2.+')).toBe(true);
    expect(api.matches('1.3.0', '1.2.+')).toBe(false);
    expect(api.matches('foo', '+')).toBe(true);
    expect(api.matches('1', '+')).toBe(true);
    expect(api.matches('99999999999', '+')).toBe(true);
  });
  it('api', () => {
    expect(api.isGreaterThan('1.1', '1')).toBe(true);
    expect(api.minSatisfyingVersion(['0', '1.5', '1', '2'], '1.+')).toBe('1');
    expect(api.getSatisfyingVersion(['0', '1', '1.5', '2'], '1.+')).toBe('1.5');
    expect(
      api.getNewValue({
        currentValue: '1',
        rangeStrategy: null,
        currentVersion: null,
        newVersion: '1.1',
      })
    ).toBe('1.1');
    expect(
      api.getNewValue({
        currentValue: '[1.2.3,]',
        rangeStrategy: null,
        currentVersion: null,
        newVersion: '1.2.4',
      })
    ).toBeNull();
  });
  it('pins maven ranges', () => {
    const sample = [
      ['[1.2.3]', '1.2.3', '1.2.4'],
      ['[1.0.0,1.2.3]', '1.0.0', '1.2.4'],
      ['[1.0.0,1.2.23]', '1.0.0', '1.2.23'],
      ['(,1.0]', '0.0.1', '2.0'],
      ['],1.0]', '0.0.1', '2.0'],
      ['(,1.0)', '0.1', '2.0'],
      ['],1.0[', '2.0', '],2.0['],
      ['[1.0,1.2],[1.3,1.5)', '1.0', '1.2.4'],
      ['[1.0,1.2],[1.3,1.5[', '1.0', '1.2.4'],
      ['[1.2.3,)', '1.2.3', '1.2.4'],
      ['[1.2.3,[', '1.2.3', '1.2.4'],
    ];
    sample.forEach(([currentValue, currentVersion, newVersion]) => {
      expect(
        api.getNewValue({
          currentValue,
          rangeStrategy: 'pin',
          currentVersion,
          newVersion,
        })
      ).toEqual(newVersion);
    });
  });
});
