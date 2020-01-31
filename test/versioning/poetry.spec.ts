import { api as poetry } from '../../lib/versioning/poetry';
import { getNewValueTestSuite, NewValueTestConfig } from './common';
import * as npmSpec from './npm.spec';
import * as pep440Spec from './pep440.spec';

describe('semver.isValid(input)', () => {
  test.each([
    '==1.2.3',
    '0.2',
    '1.1.0',
    '1.0a1',
    '1.0b2',
    '1.0rc1',
    '1.0.dev4',
    '1.0c1',
    '2012.2',
    '1.0.dev456',
    '1.0a1',
    '1.0a2.dev456',
    '1.0a12.dev456',
    '1.0a12',
    '1.0b1.dev456',
    '1.0b2',
    '1.0b2.post345.dev456',
    '1.0b2.post345',
    '1.0rc1.dev456',
    '1.0rc1',
    '1.0',
    '1.0+abc.5',
    '1.0+abc.7',
    '1.0+5',
    '1.0.post456.dev34',
    '1.0.post456',
    '1.1.dev1',
    '~=3.1', // version 3.1 or later, but not version 4.0 or later.
    '~=3.1.2', // version 3.1.2 or later, but not version 3.2.0 or later.
    '~=3.1a1', // version 3.1a1 or later, but not version 4.0 or later.
    '==3.1', // specifically version 3.1 (or 3.1.0), excludes all pre-releases, post releases, developmental releases and any 3.1.x maintenance releases.
    '==3.1.*', // any version that starts with 3.1. Equivalent to the ~=3.1.0 compatible release clause.
    '~=3.1.0, !=3.1.3', // version 3.1.0 or later, but not version 3.1.3 and not version 3.2.0 or later.
    '<=2.0',
    '<2.0',
  ])('%s', input => {
    expect(poetry.isValid(input)).toBeTruthy();
  });
  it('should support simple semver', () => {
    expect(poetry.isValid('1.2.3')).toBeTruthy();
  });
  it('should support semver with dash', () => {
    expect(poetry.isValid('1.2.3-foo')).toBeTruthy();
  });
  it('should reject semver without dash', () => {
    expect(poetry.isValid('1.2.3foo')).toBeFalsy();
  });
  it('should support ranges', () => {
    expect(poetry.isValid('~1.2.3')).toBeTruthy();
    expect(poetry.isValid('^1.2.3')).toBeTruthy();
    expect(poetry.isValid('>1.2.3')).toBeTruthy();
  });
  it('should reject github repositories', () => {
    expect(poetry.isValid('renovatebot/renovate')).toBeFalsy();
    expect(poetry.isValid('renovatebot/renovate#master')).toBeFalsy();
    expect(
      poetry.isValid('https://github.com/renovatebot/renovate.git')
    ).toBeFalsy();
  });
});
describe('semver.isSingleVersion()', () => {
  it('returns true if naked version', () => {
    expect(poetry.isSingleVersion('1.2.3')).toBeTruthy();
    expect(poetry.isSingleVersion('1.2.3-alpha.1')).toBeTruthy();
  });
  it('returns true if equals', () => {
    expect(poetry.isSingleVersion('=1.2.3')).toBeTruthy();
    expect(poetry.isSingleVersion('= 1.2.3')).toBeTruthy();
  });
  it('returns false when not version', () => {
    expect(poetry.isSingleVersion('1.*')).toBeFalsy();
  });
});
describe('semver.matches()', () => {
  it('handles comma', () => {
    expect(poetry.matches('4.2.0', '4.2, >= 3.0, < 5.0.0')).toBe(true);
    expect(poetry.matches('4.2.0', '2.0, >= 3.0, < 5.0.0')).toBe(false);
    expect(poetry.matches('4.2.2', '4.2.0, < 4.2.4')).toBe(false);
    expect(poetry.matches('4.2.2', '^4.2.0, < 4.2.4')).toBe(true);
    expect(poetry.matches('4.2.0', '4.3.0, 3.0.0')).toBe(false);
    expect(poetry.matches('4.2.0', '> 5.0.0, <= 6.0.0')).toBe(false);
  });
});
describe('semver.isLessThanRange()', () => {
  it('handles comma', () => {
    expect(poetry.isLessThanRange('0.9.0', '>= 1.0.0 <= 2.0.0')).toBe(true);
    expect(poetry.isLessThanRange('1.9.0', '>= 1.0.0 <= 2.0.0')).toBe(false);
  });
});
describe('semver.minSatisfyingVersion()', () => {
  it('handles comma', () => {
    expect(
      poetry.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '4.3.0', '5.0.0'],
        '4.*, > 4.2'
      )
    ).toBe('4.3.0');
    expect(
      poetry.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '^4.0.0'
      )
    ).toBe('4.2.0');
    expect(
      poetry.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '^4.0.0, = 0.5.0'
      )
    ).toBeNull();
    expect(
      poetry.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '^4.0.0, > 4.1.0, <= 4.3.5'
      )
    ).toBe('4.2.0');
    expect(
      poetry.minSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.2.0', '5.0.0'],
        '^6.2.0, 3.*'
      )
    ).toBeNull();
  });
});
describe('semver.maxSatisfyingVersion()', () => {
  it('handles comma', () => {
    expect(
      poetry.maxSatisfyingVersion(
        ['4.2.1', '0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0'],
        '4.*.0, < 4.2.5'
      )
    ).toBe('4.2.1');
    expect(
      poetry.maxSatisfyingVersion(
        ['0.4.0', '0.5.0', '4.0.0', '4.2.0', '5.0.0', '5.0.3'],
        '5.0, > 5.0.0'
      )
    ).toBe('5.0.3');
  });
});

const getNewValueTestCases: NewValueTestConfig[] = [
  {
    title: 'bumps exact',
    currentValue: '1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '1.1.0',
  },
  {
    title: 'bumps exact',
    currentValue: '   1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '1.1.0',
  },
  {
    title: 'bumps exact',
    currentValue: '1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '1.1.0',
  },
  {
    title: 'bumps equals',
    currentValue: '=1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '=1.1.0',
  },
  {
    title: 'bumps equals',
    currentValue: '=  1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '=1.1.0',
  },
  {
    title: 'bumps equals space',
    currentValue: '= 1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '=1.1.0',
  },
  {
    title: 'bumps equals space',
    currentValue: '  = 1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '=1.1.0',
  },
  {
    title: 'bumps equals space',
    currentValue: '  =   1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '=1.1.0',
  },
  {
    title: 'bumps equals space',
    currentValue: '=    1.0.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '=1.1.0',
  },
  {
    title: 'bumps short caret to same',
    currentValue: '^1.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.0.7',
    expectedValue: '^1.0',
  },
  {
    title: 'replaces caret with newer',
    currentValue: '^1.0.0',
    rangeStrategy: 'replace',
    fromVersion: '1.0.0',
    toVersion: '2.0.7',
    expectedValue: '^2.0.0',
  },
  {
    title: 'replaces naked version',
    currentValue: '1.0.0',
    rangeStrategy: 'replace',
    fromVersion: '1.0.0',
    toVersion: '2.0.7',
    expectedValue: '2.0.7',
  },
  {
    title: 'replaces with version range',
    currentValue: '1.0.0',
    rangeStrategy: 'replace',
    fromVersion: '1.0.0',
    toVersion: '^2.0.7',
    expectedValue: '^2.0.7',
  },
  {
    title: 'bumps naked caret',
    currentValue: '^1',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '2.1.7',
    expectedValue: '^2',
  },
  {
    title: 'bumps naked tilde',
    currentValue: '~1',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.7',
    expectedValue: '~1',
  },
  {
    title: 'bumps naked major',
    currentValue: '5',
    rangeStrategy: 'bump',
    fromVersion: '5.0.0',
    toVersion: '5.1.7',
    expectedValue: '5',
  },
  {
    title: 'bumps naked major',
    currentValue: '5',
    rangeStrategy: 'bump',
    fromVersion: '5.0.0',
    toVersion: '6.1.7',
    expectedValue: '6',
  },
  {
    title: 'bumps naked minor',
    currentValue: '5.0',
    rangeStrategy: 'bump',
    fromVersion: '5.0.0',
    toVersion: '5.0.7',
    expectedValue: '5.0',
  },
  {
    title: 'bumps naked minor',
    currentValue: '5.0',
    rangeStrategy: 'bump',
    fromVersion: '5.0.0',
    toVersion: '5.1.7',
    expectedValue: '5.1',
  },
  {
    title: 'bumps naked minor',
    currentValue: '5.0',
    rangeStrategy: 'bump',
    fromVersion: '5.0.0',
    toVersion: '6.1.7',
    expectedValue: '6.1',
  },
  {
    title: 'replaces minor',
    currentValue: '5.0',
    rangeStrategy: 'replace',
    fromVersion: '5.0.0',
    toVersion: '6.1.7',
    expectedValue: '6.1',
  },
  {
    title: 'replaces equals',
    currentValue: '=1.0.0',
    rangeStrategy: 'replace',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '=1.1.0',
  },
  {
    title: 'bumps caret to prerelease',
    currentValue: '^1',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.0.7-prerelease.1',
    expectedValue: '^1.0.7-prerelease.1',
  },
  {
    title: 'replaces with newer',
    currentValue: '^1.0.0',
    rangeStrategy: 'replace',
    fromVersion: '1.0.0',
    toVersion: '1.0.7',
    expectedValue: '^1.0.7',
  },
  {
    title: 'bumps short tilde',
    currentValue: '~1.0',
    rangeStrategy: 'bump',
    fromVersion: '1.0.0',
    toVersion: '1.1.7',
    expectedValue: '~1.1',
  },
  {
    title: 'handles long asterisk',
    currentValue: '1.0.*',
    rangeStrategy: 'replace',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    expectedValue: '1.1.*',
  },
  {
    title: 'handles short asterisk',
    currentValue: '1.*',
    rangeStrategy: 'replace',
    fromVersion: '1.0.0',
    toVersion: '2.1.0',
    expectedValue: '2.*',
  },
  {
    title: 'handles updating from stable to unstable',
    currentValue: '~0.6.1',
    rangeStrategy: 'replace',
    fromVersion: '0.6.8',
    toVersion: '0.7.0-rc.2',
    expectedValue: '~0.7.0-rc',
  },
  {
    title: 'handles less than version requirements',
    currentValue: '<1.3.4',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '1.5.0',
    expectedValue: '<1.5.1',
  },
  {
    title: 'handles less than version requirements',
    currentValue: '< 1.3.4',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '1.5.0',
    expectedValue: '< 1.5.1',
  },
  {
    title: 'handles less than version requirements',
    currentValue: '<   1.3.4',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '1.5.0',
    expectedValue: '< 1.5.1',
  },
  {
    title: 'handles less than equals version requirements',
    currentValue: '<=1.3.4',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '1.5.0',
    expectedValue: '<=1.5.0',
  },
  {
    title: 'handles less than equals version requirements',
    currentValue: '<= 1.3.4',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '1.5.0',
    expectedValue: '<= 1.5.0',
  },
  {
    title: 'handles less than equals version requirements',
    currentValue: '<=   1.3.4',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '1.5.0',
    expectedValue: '<= 1.5.0',
  },
  {
    title: 'handles replacing short caret versions',
    currentValue: '^1.2',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '2.0.0',
    expectedValue: '^2.0',
  },
  {
    title: 'handles replacing short caret versions',
    currentValue: '^1',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '2.0.0',
    expectedValue: '^2',
  },
  {
    title: 'handles replacing short tilde versions',
    currentValue: '~1.2',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '2.0.0',
    expectedValue: '~2.0',
  },
  {
    title: 'handles replacing short tilde versions',
    currentValue: '~1',
    rangeStrategy: 'replace',
    fromVersion: '1.2.3',
    toVersion: '2.0.0',
    expectedValue: '~2',
  },
];

describe.each([
  ...getNewValueTestCases,
  ...npmSpec.getNewValueTestCases,
  // ...pep440Spec.getNewValueTestCases,
])('poetry.getNewValue()', getNewValueTestSuite(poetry.getNewValue));
