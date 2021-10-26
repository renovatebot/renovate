import { compare, parseMavenBasedRange, parsePrefixRange } from './compare';
import { api } from '.';

describe('versioning/gradle/index', () => {
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
    expect(compare('1.0-rc', '1.0-final')).toEqual(-1);
    expect(compare('1.0-final', '1.0-ga')).toEqual(-1);
    expect(compare('1.0-ga', '1.0-release')).toEqual(-1);
    expect(compare('1.0-rc', '1.0-release')).toEqual(-1);
    expect(compare('1.0-final', '1.0')).toEqual(-1);
    expect(compare('1.0-alpha', '1.0-SNAPSHOT')).toEqual(-1);
    expect(compare('1.0-zeta', '1.0-SNAPSHOT')).toEqual(-1);
    expect(compare('1.0-zeta', '1.0-rc')).toEqual(-1);
    expect(compare('1.0-rc', '1.0')).toEqual(-1);
    expect(compare('1.0', '1.0-20150201.121010-123')).toEqual(-1);
    expect(compare('1.0-20150201.121010-123', '1.1')).toEqual(-1);
    expect(compare('Hoxton.RELEASE', 'Hoxton.SR1')).toEqual(-1);
    expect(compare('1.0-release', '1.0-sp-1')).toEqual(-1);
    expect(compare('1.0-sp-1', '1.0-sp-2')).toEqual(-1);
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
    expect(compare('1.0-final', '1.0-rc')).toEqual(1);
    expect(compare('1.0-ga', '1.0-final')).toEqual(1);
    expect(compare('1.0-release', '1.0-ga')).toEqual(1);
    expect(compare('1.0-release', '1.0-final')).toEqual(1);
    expect(compare('1.0', '1.0-final')).toEqual(1);
    expect(compare('1.0-SNAPSHOT', '1.0-alpha')).toEqual(1);
    expect(compare('1.0-SNAPSHOT', '1.0-zeta')).toEqual(1);
    expect(compare('1.0-rc', '1.0-zeta')).toEqual(1);
    expect(compare('1.0', '1.0-rc')).toEqual(1);
    expect(compare('1.0-20150201.121010-123', '1.0')).toEqual(1);
    expect(compare('1.1', '1.0-20150201.121010-123')).toEqual(1);
    expect(compare('Hoxton.SR1', 'Hoxton.RELEASE')).toEqual(1);
    expect(compare('1.0-sp-1', '1.0-release')).toEqual(1);
    expect(compare('1.0-sp-2', '1.0-sp-1')).toEqual(1);
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

  it('isValid', () => {
    expect(api.isValid('1.0.0')).toBeTrue();
    expect(api.isValid('[1.12.6,1.18.6]')).toBeTrue();
    expect(api.isValid(undefined)).toBeFalse();
  });

  it('isVersion', () => {
    expect(api.isVersion('')).toBeFalse();

    expect(api.isVersion('latest.integration')).toBeFalse();
    expect(api.isVersion('latest.release')).toBeFalse();
    expect(api.isVersion('latest')).toBeFalse();

    expect(api.isVersion('1')).toBeTrue();
    expect(api.isVersion('a')).toBeTrue();
    expect(api.isVersion('A')).toBeTrue();
    expect(api.isVersion('1a1')).toBeTrue();
    expect(api.isVersion('1.a.1')).toBeTrue();
    expect(api.isVersion('1-a-1')).toBeTrue();
    expect(api.isVersion('1_a_1')).toBeTrue();
    expect(api.isVersion('1+a+1')).toBeTrue();
    expect(api.isVersion('1!a!1')).toBeFalse();

    expect(api.isVersion('1.0-20150201.121010-123')).toBeTrue();
    expect(api.isVersion('dev')).toBeTrue();
    expect(api.isVersion('rc')).toBeTrue();
    expect(api.isVersion('release')).toBeTrue();
    expect(api.isVersion('final')).toBeTrue();
    expect(api.isVersion('SNAPSHOT')).toBeTrue();

    expect(api.isVersion('1.2')).toBeTrue();
    expect(api.isVersion('1..2')).toBeFalse();
    expect(api.isVersion('1++2')).toBeFalse();
    expect(api.isVersion('1--2')).toBeFalse();
    expect(api.isVersion('1__2')).toBeFalse();
  });
  it('checks if version is stable', () => {
    expect(api.isStable('')).toBeNull();
    expect(api.isStable('foobar')).toBeTrue();
    expect(api.isStable('final')).toBeTrue();
    expect(api.isStable('1')).toBeTrue();
    expect(api.isStable('1.2')).toBeTrue();
    expect(api.isStable('1.2.3')).toBeTrue();
    expect(api.isStable('1.2.3.4')).toBeTrue();
    expect(api.isStable('v1.2.3.4')).toBeTrue();
    expect(api.isStable('1-alpha-1')).toBeFalse();
    expect(api.isStable('1-b1')).toBeFalse();
    expect(api.isStable('1-foo')).toBeTrue();
    expect(api.isStable('1-final-1.0.0')).toBeTrue();
    expect(api.isStable('1-release')).toBeTrue();
    expect(api.isStable('1.final')).toBeTrue();
    expect(api.isStable('1.0milestone1')).toBeFalse();
    expect(api.isStable('1-sp')).toBeTrue();
    expect(api.isStable('1-ga-1')).toBeTrue();
    expect(api.isStable('1.3-groovy-2.5')).toBeTrue();
    expect(api.isStable('1.3-RC1-groovy-2.5')).toBeFalse();
    expect(api.isStable('Hoxton.RELEASE')).toBeTrue();
    expect(api.isStable('Hoxton.SR')).toBeTrue();
    expect(api.isStable('Hoxton.SR1')).toBeTrue();

    // https://github.com/renovatebot/renovate/pull/5789
    expect(api.isStable('1.3.5-native-mt-1.3.71-release-429')).toBeFalse();
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
    expect(api.matches('0', '[0,1]')).toBeTrue();
    expect(api.matches('1', '[0,1]')).toBeTrue();
    expect(api.matches('0', '(0,1)')).toBeFalse();
    expect(api.matches('1', '(0,1)')).toBeFalse();
    expect(api.matches('1', '(0,2)')).toBeTrue();
    expect(api.matches('1', '[0,2]')).toBeTrue();
    expect(api.matches('1', '(,1]')).toBeTrue();
    expect(api.matches('1', '(,1)')).toBeFalse();
    expect(api.matches('1', '[1,)')).toBeTrue();
    expect(api.matches('1', '(1,)')).toBeFalse();
    expect(api.matches('1', '[[]]')).toBeNull();
    expect(api.matches('0', '')).toBeFalse();
    expect(api.matches('1', '1')).toBeTrue();
    expect(api.matches('1.2.3', '1.2.+')).toBeTrue();
    expect(api.matches('1.2.3.4', '1.2.+')).toBeTrue();
    expect(api.matches('1.3.0', '1.2.+')).toBeFalse();
    expect(api.matches('foo', '+')).toBeTrue();
    expect(api.matches('1', '+')).toBeTrue();
    expect(api.matches('99999999999', '+')).toBeTrue();
  });
  it('api', () => {
    expect(api.isGreaterThan('1.1', '1')).toBeTrue();
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
