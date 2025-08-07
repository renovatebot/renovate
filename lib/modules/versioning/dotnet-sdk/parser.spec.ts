import { parseFloatingRange, parseRange, parseVersion } from './parser';
import { getFloatingRangeLowerBound, rangeToString } from './range';
import { versionToString } from './version';

describe('modules/versioning/dotnet-sdk/parser', () => {
  describe('parseVersion', () => {
    it('returns null for invalid input', () => {
      expect(parseVersion('!@#')).toBeNull();
      expect(parseVersion('abc')).toBeNull();
    });

    it('parses version', () => {
      expect(parseVersion('1.2.3-preview.4')).toEqual({
        type: 'dotnet-sdk-version',
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'preview.4',
      });
    });
  });

  describe('parseFloatingRange', () => {
    it('rejects invalid input', () => {
      expect(parseFloatingRange('!@#')).toBeNull();
      expect(parseFloatingRange('abc')).toBeNull();
      expect(parseFloatingRange('1.2.*-foo')).toBeNull();
      expect(parseFloatingRange('1.2.3')).toBeNull();
    });

    test.each`
      input         | major | minor        | patch        | floating   | prerelease
      ${'8'}        | ${8}  | ${undefined} | ${undefined} | ${'major'} | ${undefined}
      ${'8.x'}      | ${8}  | ${'x'}       | ${undefined} | ${'major'} | ${undefined}
      ${'8.0'}      | ${8}  | ${0}         | ${undefined} | ${'minor'} | ${undefined}
      ${'8.0.x'}    | ${8}  | ${0}         | ${'x'}       | ${'minor'} | ${undefined}
      ${'8.0.1xx'}  | ${8}  | ${0}         | ${100}       | ${'patch'} | ${undefined}
      ${'8.0.3xx'}  | ${8}  | ${0}         | ${300}       | ${'patch'} | ${undefined}
      ${'10'}       | ${10} | ${undefined} | ${undefined} | ${'major'} | ${undefined}
      ${'10.x'}     | ${10} | ${'x'}       | ${undefined} | ${'major'} | ${undefined}
      ${'10.0'}     | ${10} | ${0}         | ${undefined} | ${'minor'} | ${undefined}
      ${'10.0.x'}   | ${10} | ${0}         | ${'x'}       | ${'minor'} | ${undefined}
      ${'10.0.1xx'} | ${10} | ${0}         | ${100}       | ${'patch'} | ${undefined}
      ${'10.0.3xx'} | ${10} | ${0}         | ${300}       | ${'patch'} | ${undefined}
    `('$input', ({ input, major, minor, patch, floating, prerelease }) => {
      expect(parseFloatingRange(input)).toEqual({
        type: 'dotnet-sdk-floating-range',
        major,
        minor,
        patch,
        floating,
        prerelease,
      });
    });
  });

  describe('getFloatingRangeLowerBound', () => {
    test.each`
      input        | major | minor | patch  | prerelease
      ${'8.x'}     | ${8}  | ${0}  | ${100} | ${undefined}
      ${'8.0.x'}   | ${8}  | ${0}  | ${100} | ${undefined}
      ${'8.0.1xx'} | ${8}  | ${0}  | ${100} | ${undefined}
      ${'8.0.3xx'} | ${8}  | ${0}  | ${300} | ${undefined}
    `('$input', ({ input, major, minor, patch, prerelease }) => {
      const range = parseFloatingRange(input)!;
      expect(range).not.toBeNull();
      expect(getFloatingRangeLowerBound(range)).toEqual({
        type: 'dotnet-sdk-version',
        major,
        minor,
        patch,
        prerelease,
      });
    });
  });

  describe('versionToString', () => {
    test.each`
      input                  | version
      ${'8'}                 | ${'8.0.100'}
      ${'8.0'}               | ${'8.0.100'}
      ${'8.0.100'}           | ${'8.0.100'}
      ${'8.0.321'}           | ${'8.0.321'}
      ${'8.0.100-preview.6'} | ${'8.0.100-preview.6'}
    `('$input', ({ input, version }) => {
      const v = versionToString(parseVersion(input)!);
      expect(v).toEqual(version);
    });
  });

  describe('rangeToString', () => {
    test.each`
      version
      ${'8'}
      ${'8.x'}
      ${'8.0'}
      ${'8.0.x'}
      ${'8.0.1xx'}
      ${'8.0.3xx'}
    `('$version', ({ version }) => {
      const r = parseRange(version)!;
      expect(rangeToString(r)).toEqual(version);
    });
  });
});
