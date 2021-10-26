import {
  REV_TYPE_LATEST,
  REV_TYPE_RANGE,
  REV_TYPE_SUBREV,
  parseDynamicRevision,
} from './parse';
import ivy from '.';

const { getNewValue, isValid, isVersion, matches } = ivy;

describe('versioning/ivy/index', () => {
  it('parses dynamic revisions', () => {
    expect(parseDynamicRevision(null)).toBeNull();
    expect(parseDynamicRevision('')).toBeNull();

    expect(parseDynamicRevision('latest')).toEqual({
      type: REV_TYPE_LATEST,
      value: null,
    });
    expect(parseDynamicRevision('latest.release')).toEqual({
      type: REV_TYPE_LATEST,
      value: 'release',
    });
    expect(parseDynamicRevision('latest.milestone')).toEqual({
      type: REV_TYPE_LATEST,
      value: 'milestone',
    });
    expect(parseDynamicRevision('latest.integration')).toEqual({
      type: REV_TYPE_LATEST,
      value: null,
    });

    expect(parseDynamicRevision('.+')).toBeNull();
    expect(parseDynamicRevision('1.0.+')).toEqual({
      type: REV_TYPE_SUBREV,
      value: '1.0',
    });
    expect(parseDynamicRevision('1.2.3.+')).toEqual({
      type: REV_TYPE_SUBREV,
      value: '1.2.3',
    });

    [
      '[1.0,2.0]',
      '[1.0,2.0[',
      ']1.0,2.0]',
      ']1.0,2.0[',
      '[1.0,)',
      ']1.0,)',
      '(,2.0]',
      '(,2.0[',
    ].forEach((value) => {
      expect(parseDynamicRevision(value)).toEqual({
        type: REV_TYPE_RANGE,
        value,
      });
    });

    expect(parseDynamicRevision('[0,1),(1,)')).toBeNull();
  });

  it('isValid', () => {
    expect(isValid('')).toBeFalse();
    expect(isValid('1.0.0')).toBeTrue();
    expect(isValid('0')).toBeTrue();
    expect(isValid('0.1-2-sp')).toBeTrue();
    expect(isValid('1-final')).toBeTrue();
    expect(isValid('v1.0.0')).toBeTrue();
    expect(isValid('x1.0.0')).toBeTrue();
    expect(isValid('2.1.1.RELEASE')).toBeTrue();
    expect(isValid('Greenwich.SR1')).toBeTrue();
    expect(isValid('.1')).toBeFalse();
    expect(isValid('1.')).toBeFalse();
    expect(isValid('-1')).toBeFalse();
    expect(isValid('1-')).toBeFalse();

    expect(isValid('latest')).toBeTrue();
    expect(isValid('latest.release')).toBeTrue();
    expect(isValid('latest.milestone')).toBeTrue();
    expect(isValid('latest.integration')).toBeTrue();
    expect(isValid('1.0.+')).toBeTrue();
    expect(isValid('1.0+')).toBeFalse();
    expect(isValid(']0,1[')).toBeTrue();
    expect(isValid('[0,1]')).toBeTrue();
    expect(isValid('[0,1),(1,2]')).toBeFalse();
  });
  it('isVersion', () => {
    expect(isVersion('')).toBeFalse();
    expect(isVersion('1.0.0')).toBeTrue();
    expect(isVersion('0')).toBeTrue();
    expect(isVersion('0.1-2-sp')).toBeTrue();
    expect(isVersion('1-final')).toBeTrue();
    expect(isVersion('v1.0.0')).toBeTrue();
    expect(isVersion('x1.0.0')).toBeTrue();
    expect(isVersion('2.1.1.RELEASE')).toBeTrue();
    expect(isVersion('Greenwich.SR1')).toBeTrue();
    expect(isVersion('.1')).toBeFalse();
    expect(isVersion('1.')).toBeFalse();
    expect(isVersion('-1')).toBeFalse();
    expect(isVersion('1-')).toBeFalse();

    expect(isVersion('latest')).toBeFalse();
    expect(isVersion('latest.release')).toBeFalse();
    expect(isVersion('latest.milestone')).toBeFalse();
    expect(isVersion('latest.integration')).toBeFalse();
    expect(isVersion('1.0.+')).toBeFalse();
    expect(isVersion('1.0+')).toBeFalse();
    expect(isVersion(']0,1[')).toBeFalse();
    expect(isVersion('[0,1]')).toBeFalse();
    expect(isVersion('[0,1),(1,2]')).toBeFalse();
  });
  it('matches', () => {
    expect(matches('', 'latest')).toBeFalse();
    expect(matches('0', '')).toBeFalse();
    expect(matches('0', 'latest')).toBeTrue();
    expect(matches('0', 'latest.integration')).toBeTrue();

    expect(matches('0', 'latest.release')).toBeFalse();
    expect(matches('release', 'latest.release')).toBeTrue();
    expect(matches('0.release', 'latest.release')).toBeTrue();
    expect(matches('0-release', 'latest.release')).toBeTrue();
    expect(matches('0release', 'latest.release')).toBeTrue();
    expect(matches('0.RELEASE', 'latest.release')).toBeTrue();

    expect(matches('0', 'latest.milestone')).toBeFalse();
    expect(matches('milestone', 'latest.milestone')).toBeTrue();
    expect(matches('0.milestone', 'latest.milestone')).toBeTrue();
    expect(matches('0-milestone', 'latest.milestone')).toBeTrue();
    expect(matches('0milestone', 'latest.milestone')).toBeTrue();
    expect(matches('0.MILESTONE', 'latest.milestone')).toBeTrue();

    expect(matches('0', '1.0.+')).toBeFalse();
    expect(matches('1.1.0', '1.2.+')).toBeFalse();
    expect(matches('1.2.0', '1.2.+')).toBeTrue();
    expect(matches('1.2.milestone', '1.2.+')).toBeTrue();
    expect(matches('1.3', '1.2.+')).toBeFalse();

    expect(matches('1', '1')).toBeTrue();
    expect(matches('1', '0')).toBeFalse();
    expect(matches('1', '[0,1]')).toBeTrue();
    expect(matches('0', '(0,1)')).toBeFalse();
    expect(matches('0', '(0,1[')).toBeFalse();
    expect(matches('0', ']0,1)')).toBeFalse();
    expect(matches('1', '(0,1)')).toBeFalse();
    expect(matches('1', '(0,2)')).toBeTrue();
    expect(matches('1', '[0,2]')).toBeTrue();
    expect(matches('1', '(,1]')).toBeTrue();
    expect(matches('1', '(,1)')).toBeFalse();
    expect(matches('1', '[1,)')).toBeTrue();
    expect(matches('1', '(1,)')).toBeFalse();
  });
  it('api', () => {
    expect(ivy.isGreaterThan('1.1', '1')).toBeTrue();
    expect(ivy.getSatisfyingVersion(['0', '1', '2'], '(,2)')).toBe('1');
    expect(
      ivy.getNewValue({
        currentValue: '1',
        rangeStrategy: 'auto',
        currentVersion: '1',
        newVersion: '1.1',
      })
    ).toBe('1.1');
    expect(
      ivy.getNewValue({
        currentValue: '[1.2.3,]',
        rangeStrategy: 'auto',
        currentVersion: '1.2.3',
        newVersion: '1.2.4',
      })
    ).toBe('[1.2.3,]');
  });
  it('pin', () => {
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
      ['latest.integration', '1.0', '2.0'],
      ['latest', '1.0', '2.0'],
    ];
    sample.forEach(([currentValue, currentVersion, newVersion]) => {
      expect(
        getNewValue({
          currentValue,
          rangeStrategy: 'pin',
          currentVersion,
          newVersion,
        })
      ).toEqual(newVersion);
    });
  });
});
