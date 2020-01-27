import { api as semver } from '../../lib/versioning/npm';
import { NewValueConfig } from '../../lib/versioning';

const stableSingle: string[] = ['1.2.3'];

const unstableSingle: string[] = ['1.2.3-foo', '1.2.3-alpha.1'];

const singleVersions: string[] = [...stableSingle, ...unstableSingle];

const stableExact: string[] = ['=1.2.3', '= 1.2.3'];

const unstableExact: string[] = ['=1.2.3-alpha.1', '= 1.2.3-alpha.1'];

const exactVersions: string[] = [...stableExact, ...unstableExact];

const invalidInputs: string[] = [
  '17.04.0',
  '1.2.3foo',
  'renovatebot/renovate',
  'renovatebot/renovate#master',
  'https://github.com/renovatebot/renovate.git',
];

const ranges: string[] = ['~1.2.3', '^1.2.3', '>1.2.3'];

export const sample = {
  singleVersions,
  exactVersions,
  invalidInputs,
  ranges,
};

test.each([
  ...sample.singleVersions,
  ...sample.exactVersions,
  ...sample.ranges,
])('isValid( "%s" ) == true', input => {
  expect(semver.isValid(input)).toBeTruthy();
});

test.each(sample.invalidInputs)('isValid( "%s" ) == false', input => {
  expect(semver.isValid(input)).toBeFalsy();
});

test.each([...sample.singleVersions, ...sample.exactVersions])(
  'isSingleVersion( "%s" ) == true',
  input => {
    expect(semver.isSingleVersion(input)).toBeTruthy();
  }
);

test.each([...sample.invalidInputs, ...sample.ranges])(
  'isSingleVersion( "%s" ) == false',
  input => {
    expect(semver.isSingleVersion(input)).toBeFalsy();
  }
);

const updateStrategies: [string, NewValueConfig, string][] = [
  [
    'bumps equals',
    {
      currentValue: '=1.0.0',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
    },
    '=1.1.0',
  ],
  [
    'bumps short caret to same',
    {
      currentValue: '^1.0',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.0.7',
    },
    '^1.0',
  ],
  [
    'bumps caret to prerelease',
    {
      currentValue: '^1',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.0.7-prerelease.1',
    },
    '^1.0.7-prerelease.1',
  ],
  [
    'replaces with newer',
    {
      currentValue: '^1.0.0',
      rangeStrategy: 'replace',
      fromVersion: '1.0.0',
      toVersion: '1.0.7',
    },
    '^1.0.7',
  ],
  [
    'supports tilde greater than',
    {
      currentValue: '~> 1.0.0',
      rangeStrategy: 'replace',
      fromVersion: '1.0.0',
      toVersion: '1.1.7',
    },
    '~> 1.1.0',
  ],
  [
    'bumps short caret to new',
    {
      currentValue: '^1.0',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.1.7',
    },
    '^1.1',
  ],
  [
    'bumps short tilde',
    {
      currentValue: '~1.0',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.1.7',
    },
    '~1.1',
  ],
  [
    'bumps tilde to prerelease',
    {
      currentValue: '~1.0',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.0.7-prerelease.1',
    },
    '~1.0.7-prerelease.1',
  ],
  [
    'updates naked caret',
    {
      currentValue: '^1',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '2.1.7',
    },
    '^2',
  ],
  [
    'bumps naked tilde',
    {
      currentValue: '~1',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.1.7',
    },
    '~1',
  ],
  [
    'bumps naked major',
    {
      currentValue: '5',
      rangeStrategy: 'bump',
      fromVersion: '5.0.0',
      toVersion: '5.1.7',
    },
    '5',
  ],
  [
    'bumps naked major',
    {
      currentValue: '5',
      rangeStrategy: 'bump',
      fromVersion: '5.0.0',
      toVersion: '6.1.7',
    },
    '6',
  ],
  [
    'bumps naked minor',
    {
      currentValue: '5.0',
      rangeStrategy: 'bump',
      fromVersion: '5.0.0',
      toVersion: '5.0.7',
    },
    '5.0',
  ],
  [
    'bumps naked minor',
    {
      currentValue: '5.0',
      rangeStrategy: 'bump',
      fromVersion: '5.0.0',
      toVersion: '5.1.7',
    },
    '5.1',
  ],
  [
    'bumps naked minor',
    {
      currentValue: '5.0',
      rangeStrategy: 'bump',
      fromVersion: '5.0.0',
      toVersion: '6.1.7',
    },
    '6.1',
  ],
  [
    'bumps greater or equals',
    {
      currentValue: '>=1.0.0',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
    },
    '>=1.1.0',
  ],
  [
    'bumps greater or equals',
    {
      currentValue: '>= 1.0.0',
      rangeStrategy: 'bump',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
    },
    '>= 1.1.0',
  ],
  [
    'replaces equals',
    {
      currentValue: '=1.0.0',
      rangeStrategy: 'replace',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
    },
    '=1.1.0',
  ],
  [
    'handles long asterisk',
    {
      currentValue: '1.0.*',
      rangeStrategy: 'replace',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
    },
    '1.1.*',
  ],
  [
    'handles short asterisk',
    {
      currentValue: '1.*',
      rangeStrategy: 'replace',
      fromVersion: '1.0.0',
      toVersion: '2.1.0',
    },
    '2.*',
  ],
  [
    'handles updating from stable to unstable',
    {
      currentValue: '~0.6.1',
      rangeStrategy: 'replace',
      fromVersion: '0.6.8',
      toVersion: '0.7.0-rc.2',
    },
    '~0.7.0-rc',
  ],
];

describe('semver.getNewValue()', () => {
  test.each(updateStrategies)('%s', (_, input, output) => {
    expect(semver.getNewValue(input)).toEqual(output);
  });
});
