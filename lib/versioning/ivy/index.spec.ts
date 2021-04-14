import { getName } from '../../../test/util';
import {
  REV_TYPE_LATEST,
  REV_TYPE_RANGE,
  REV_TYPE_SUBREV,
  parseDynamicRevision,
} from './parse';
import ivy from '.';

const { getNewValue, isValid, isVersion, matches } = ivy;

describe(getName(__filename), () => {
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
});

describe(getName(__filename), () => {
  it('isValid', () => {
    expect(isValid('')).toBe(false);
    expect(isValid('1.0.0')).toBe(true);
    expect(isValid('0')).toBe(true);
    expect(isValid('0.1-2-sp')).toBe(true);
    expect(isValid('1-final')).toBe(true);
    expect(isValid('v1.0.0')).toBe(true);
    expect(isValid('x1.0.0')).toBe(true);
    expect(isValid('2.1.1.RELEASE')).toBe(true);
    expect(isValid('Greenwich.SR1')).toBe(true);
    expect(isValid('.1')).toBe(false);
    expect(isValid('1.')).toBe(false);
    expect(isValid('-1')).toBe(false);
    expect(isValid('1-')).toBe(false);

    expect(isValid('latest')).toBe(true);
    expect(isValid('latest.release')).toBe(true);
    expect(isValid('latest.milestone')).toBe(true);
    expect(isValid('latest.integration')).toBe(true);
    expect(isValid('1.0.+')).toBe(true);
    expect(isValid('1.0+')).toBe(false);
    expect(isValid(']0,1[')).toBe(true);
    expect(isValid('[0,1]')).toBe(true);
    expect(isValid('[0,1),(1,2]')).toBe(false);
  });
  it('isVersion', () => {
    expect(isVersion('')).toBe(false);
    expect(isVersion('1.0.0')).toBe(true);
    expect(isVersion('0')).toBe(true);
    expect(isVersion('0.1-2-sp')).toBe(true);
    expect(isVersion('1-final')).toBe(true);
    expect(isVersion('v1.0.0')).toBe(true);
    expect(isVersion('x1.0.0')).toBe(true);
    expect(isVersion('2.1.1.RELEASE')).toBe(true);
    expect(isVersion('Greenwich.SR1')).toBe(true);
    expect(isVersion('.1')).toBe(false);
    expect(isVersion('1.')).toBe(false);
    expect(isVersion('-1')).toBe(false);
    expect(isVersion('1-')).toBe(false);

    expect(isVersion('latest')).toBe(false);
    expect(isVersion('latest.release')).toBe(false);
    expect(isVersion('latest.milestone')).toBe(false);
    expect(isVersion('latest.integration')).toBe(false);
    expect(isVersion('1.0.+')).toBe(false);
    expect(isVersion('1.0+')).toBe(false);
    expect(isVersion(']0,1[')).toBe(false);
    expect(isVersion('[0,1]')).toBe(false);
    expect(isVersion('[0,1),(1,2]')).toBe(false);
  });
  it('matches', () => {
    expect(matches('', 'latest')).toBe(false);
    expect(matches('0', '')).toBe(false);
    expect(matches('0', 'latest')).toBe(true);
    expect(matches('0', 'latest.integration')).toBe(true);

    expect(matches('0', 'latest.release')).toBe(false);
    expect(matches('release', 'latest.release')).toBe(true);
    expect(matches('0.release', 'latest.release')).toBe(true);
    expect(matches('0-release', 'latest.release')).toBe(true);
    expect(matches('0release', 'latest.release')).toBe(true);
    expect(matches('0.RELEASE', 'latest.release')).toBe(true);

    expect(matches('0', 'latest.milestone')).toBe(false);
    expect(matches('milestone', 'latest.milestone')).toBe(true);
    expect(matches('0.milestone', 'latest.milestone')).toBe(true);
    expect(matches('0-milestone', 'latest.milestone')).toBe(true);
    expect(matches('0milestone', 'latest.milestone')).toBe(true);
    expect(matches('0.MILESTONE', 'latest.milestone')).toBe(true);

    expect(matches('0', '1.0.+')).toBe(false);
    expect(matches('1.1.0', '1.2.+')).toBe(false);
    expect(matches('1.2.0', '1.2.+')).toBe(true);
    expect(matches('1.2.milestone', '1.2.+')).toBe(true);
    expect(matches('1.3', '1.2.+')).toBe(false);

    expect(matches('1', '1')).toBe(true);
    expect(matches('1', '0')).toBe(false);
    expect(matches('1', '[0,1]')).toBe(true);
    expect(matches('0', '(0,1)')).toBe(false);
    expect(matches('0', '(0,1[')).toBe(false);
    expect(matches('0', ']0,1)')).toBe(false);
    expect(matches('1', '(0,1)')).toBe(false);
    expect(matches('1', '(0,2)')).toBe(true);
    expect(matches('1', '[0,2]')).toBe(true);
    expect(matches('1', '(,1]')).toBe(true);
    expect(matches('1', '(,1)')).toBe(false);
    expect(matches('1', '[1,)')).toBe(true);
    expect(matches('1', '(1,)')).toBe(false);
  });
  it('api', () => {
    expect(ivy.isGreaterThan('1.1', '1')).toBe(true);
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
