import { isSemVerXRange, normalizeLegacyXRanges } from './common.ts';

describe('modules/versioning/semver/common', () => {
  it.each`
    range      | expected
    ${'*'}     | ${true}
    ${'x'}     | ${true}
    ${'X'}     | ${true}
    ${''}      | ${true}
    ${'1'}     | ${false}
    ${'1.2'}   | ${false}
    ${'1.2.3'} | ${false}
  `('isSemVerXRange("range") === $expected', ({ range, expected }) => {
    expect(isSemVerXRange(range)).toBe(expected);
  });

  it.each`
    input                      | expected
    ${'1.x.5'}                 | ${'1.x'}
    ${'1.*.5'}                 | ${'1.*'}
    ${'1.X.5'}                 | ${'1.X'}
    ${'1.x.5-alpha'}           | ${'1.x'}
    ${'1.x.5+build'}           | ${'1.x'}
    ${'1.x.5-alpha+build'}     | ${'1.x'}
    ${'1.x.5+bad+bad'}         | ${'1.x'}
    ${'1.x.5-alpha+bad+bad'}   | ${'1.x'}
    ${'1.x.5-alpha.1+build.5'} | ${'1.x'}
    ${'1.x.5 || 2.*.5'}        | ${'1.x || 2.*'}
    ${'< 1.x.5'}               | ${'< 1.x'}
    ${'>=x.1'}                 | ${'>=x'}
    ${'x.1'}                   | ${'x'}
    ${'x.1.2'}                 | ${'x'}
    ${'x.x.1'}                 | ${'x'}
    ${'1.2.*'}                 | ${'1.2.*'}
    ${'1.2.x'}                 | ${'1.2.x'}
    ${'1.2.3'}                 | ${'1.2.3'}
    ${'1.x.05'}                | ${'1.x.05'}
    ${'1.*.05'}                | ${'1.*.05'}
    ${'x.01'}                  | ${'x.01'}
    ${'*.01'}                  | ${'*.01'}
    ${'01.x.5'}                | ${'01.x.5'}
    ${'1.x.5-alpha.'}          | ${'1.x.5-alpha.'}
    ${'1.x.5-01'}              | ${'1.x.5-01'}
    ${'1.x.5+build.'}          | ${'1.x.5+build.'}
    ${'1.x.5+bad+'}            | ${'1.x.5+bad+'}
    ${'1.x.5++bad'}            | ${'1.x.5++bad'}
    ${'1.x.5.6'}               | ${'1.x.5.6'}
    ${'1.*.x.2'}               | ${'1.*.x.2'}
    ${'x.0.0.0'}               | ${'x.0.0.0'}
    ${'renovatebot/x'}         | ${'renovatebot/x'}
  `(
    'normalizeLegacyXRanges("$input") === "$expected"',
    ({ input, expected }) => {
      expect(normalizeLegacyXRanges(input)).toBe(expected);
    },
  );
});
