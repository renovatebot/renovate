import {
  parseBracketRange,
  parseExactRange,
  parseFloatingRange,
  parseRange,
  parseVersion,
} from './parser';
import { getFloatingRangeLowerBound, rangeToString } from './range';
import { versionToString } from './version';

describe('modules/versioning/nuget/parser', () => {
  describe('parseVersion', () => {
    it('returns null for invalid input', () => {
      expect(parseVersion('!@#')).toBeNull();
      expect(parseVersion('abc')).toBeNull();
    });

    it('parses version', () => {
      expect(parseVersion('1.2.3.4-foo+bar')).toEqual({
        type: 'nuget-version',
        major: 1,
        minor: 2,
        patch: 3,
        revision: 4,
        prerelease: 'foo',
        metadata: 'bar',
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
      input             | major   | minor        | patch        | revision     | floating      | prerelease
      ${'*-*'}          | ${0}    | ${undefined} | ${undefined} | ${undefined} | ${'major'}    | ${'*'}
      ${'*-foo*'}       | ${0}    | ${undefined} | ${undefined} | ${undefined} | ${'major'}    | ${'foo*'}
      ${'*-foo.bar*'}   | ${0}    | ${undefined} | ${undefined} | ${undefined} | ${'major'}    | ${'foo.bar*'}
      ${'*'}            | ${0}    | ${undefined} | ${undefined} | ${undefined} | ${'major'}    | ${undefined}
      ${'1.*'}          | ${1}    | ${0}         | ${undefined} | ${undefined} | ${'minor'}    | ${undefined}
      ${'1.*-*'}        | ${1}    | ${0}         | ${undefined} | ${undefined} | ${'minor'}    | ${'*'}
      ${'1.*-foo*'}     | ${1}    | ${0}         | ${undefined} | ${undefined} | ${'minor'}    | ${'foo*'}
      ${'1.2.*'}        | ${1}    | ${2}         | ${0}         | ${undefined} | ${'patch'}    | ${undefined}
      ${'1.2.*-*'}      | ${1}    | ${2}         | ${0}         | ${undefined} | ${'patch'}    | ${'*'}
      ${'1.2.*-foo*'}   | ${1}    | ${2}         | ${0}         | ${undefined} | ${'patch'}    | ${'foo*'}
      ${'1.2.3.*'}      | ${1}    | ${2}         | ${3}         | ${0}         | ${'revision'} | ${undefined}
      ${'1.2.3.*-*'}    | ${1}    | ${2}         | ${3}         | ${0}         | ${'revision'} | ${'*'}
      ${'1.2.3.*-foo*'} | ${1}    | ${2}         | ${3}         | ${0}         | ${'revision'} | ${'foo*'}
      ${'1.2.3.4-*'}    | ${1}    | ${2}         | ${3}         | ${4}         | ${undefined}  | ${'*'}
      ${'1.2.3.4-foo*'} | ${1}    | ${2}         | ${3}         | ${4}         | ${undefined}  | ${'foo*'}
      ${'123*'}         | ${1230} | ${undefined} | ${undefined} | ${undefined} | ${'major'}    | ${undefined}
      ${'1-*'}          | ${1}    | ${undefined} | ${undefined} | ${undefined} | ${undefined}  | ${'*'}
      ${'1.2-*'}        | ${1}    | ${2}         | ${undefined} | ${undefined} | ${undefined}  | ${'*'}
      ${'1.2.3-*'}      | ${1}    | ${2}         | ${3}         | ${undefined} | ${undefined}  | ${'*'}
      ${'1.2.3.4-*'}    | ${1}    | ${2}         | ${3}         | ${4}         | ${undefined}  | ${'*'}
    `(
      '$input',
      ({ input, major, minor, patch, revision, floating, prerelease }) => {
        expect(parseFloatingRange(input)).toEqual({
          type: 'nuget-floating-range',
          major,
          minor,
          patch,
          revision,
          floating,
          prerelease,
        });
      },
    );
  });

  describe('getFloatingRangeLowerBound', () => {
    test.each`
      input             | major    | minor   | patch  | revision | prerelease
      ${'*-*'}          | ${0}     | ${0}    | ${0}   | ${0}     | ${'0'}
      ${'*-foo*'}       | ${0}     | ${0}    | ${0}   | ${0}     | ${'foo'}
      ${'*-foo.bar*'}   | ${0}     | ${0}    | ${0}   | ${0}     | ${'foo.bar'}
      ${'*'}            | ${0}     | ${0}    | ${0}   | ${0}     | ${undefined}
      ${'1.*'}          | ${1}     | ${0}    | ${0}   | ${0}     | ${undefined}
      ${'1.*-*'}        | ${1}     | ${0}    | ${0}   | ${0}     | ${'0'}
      ${'1.*-foo*'}     | ${1}     | ${0}    | ${0}   | ${0}     | ${'foo'}
      ${'1.2.*'}        | ${1}     | ${2}    | ${0}   | ${0}     | ${undefined}
      ${'1.2.*-*'}      | ${1}     | ${2}    | ${0}   | ${0}     | ${'0'}
      ${'1.2.*-foo*'}   | ${1}     | ${2}    | ${0}   | ${0}     | ${'foo'}
      ${'1.2.3.*'}      | ${1}     | ${2}    | ${3}   | ${0}     | ${undefined}
      ${'1.2.3.*-*'}    | ${1}     | ${2}    | ${3}   | ${0}     | ${'0'}
      ${'1.2.3.*-foo*'} | ${1}     | ${2}    | ${3}   | ${0}     | ${'foo'}
      ${'1.2.3.4-*'}    | ${1}     | ${2}    | ${3}   | ${4}     | ${'0'}
      ${'1.2.3.4-foo*'} | ${1}     | ${2}    | ${3}   | ${4}     | ${'foo'}
      ${'1234*'}        | ${12340} | ${0}    | ${0}   | ${0}     | ${undefined}
      ${'1.234*'}       | ${1}     | ${2340} | ${0}   | ${0}     | ${undefined}
      ${'1.2.34*'}      | ${1}     | ${2}    | ${340} | ${0}     | ${undefined}
      ${'1.2.3.4*'}     | ${1}     | ${2}    | ${3}   | ${40}    | ${undefined}
      ${'1.2.3-4.5.*'}  | ${1}     | ${2}    | ${3}   | ${0}     | ${'4.5.0'}
    `('$input', ({ input, major, minor, patch, revision, prerelease }) => {
      const range = parseFloatingRange(input)!;
      expect(range).not.toBeNull();
      expect(getFloatingRangeLowerBound(range)).toEqual({
        type: 'nuget-version',
        major,
        minor,
        patch,
        revision,
        prerelease,
      });
    });
  });

  describe('parseExactRange', () => {
    it('rejects invalid input', () => {
      expect(parseExactRange('!@#')).toBeNull();
      expect(parseExactRange('abc')).toBeNull();
      expect(parseExactRange('1.2.*')).toBeNull();
      expect(parseExactRange('[1.2.*]')).toBeNull();
      expect(parseExactRange('[foobar]')).toBeNull();
    });

    it('parses exact range', () => {
      expect(parseExactRange('[1.2.3]')).toEqual({
        type: 'nuget-exact-range',
        version: {
          type: 'nuget-version',
          major: 1,
          minor: 2,
          patch: 3,
        },
      });
    });
  });

  describe('parseBracketRange', () => {
    it('rejects invalid input', () => {
      expect(parseBracketRange('!@#')).toBeNull();
      expect(parseBracketRange('abc')).toBeNull();
      expect(parseBracketRange('[1.2.*')).toBeNull();
      expect(parseBracketRange('[foo,)')).toBeNull();
      expect(parseBracketRange('[,bar]')).toBeNull();
      expect(parseBracketRange('[foo,bar]')).toBeNull();
      expect(parseBracketRange('[1.2.3,bar]')).toBeNull();
    });

    it('parses range without lower bound', () => {
      expect(parseBracketRange('(,1.2.3]')).toEqual({
        type: 'nuget-bracket-range',
        min: undefined,
        max: { type: 'nuget-version', major: 1, minor: 2, patch: 3 },
        minInclusive: false,
        maxInclusive: true,
      });
    });

    it('parses range without upper bound', () => {
      expect(parseBracketRange('[1.2.3,)')).toEqual({
        type: 'nuget-bracket-range',
        min: { type: 'nuget-version', major: 1, minor: 2, patch: 3 },
        max: undefined,
        minInclusive: true,
        maxInclusive: false,
      });
    });

    describe('bounds inclusivity', () => {
      test.each`
        input      | minInclusive | maxInclusive
        ${'(1,2)'} | ${false}     | ${false}
        ${'[1,2)'} | ${true}      | ${false}
        ${'(1,2]'} | ${false}     | ${true}
        ${'[1,2]'} | ${true}      | ${true}
      `('$input', ({ input, minInclusive, maxInclusive }) => {
        expect(parseBracketRange(input)).toEqual({
          type: 'nuget-bracket-range',
          min: { type: 'nuget-version', major: 1 },
          max: { type: 'nuget-version', major: 2 },
          minInclusive,
          maxInclusive,
        });
      });
    });

    it('handles whitespaces', () => {
      expect(parseBracketRange(' [ 1 , 2 ] ')).toEqual({
        type: 'nuget-bracket-range',
        min: { type: 'nuget-version', major: 1 },
        max: { type: 'nuget-version', major: 2 },
        minInclusive: true,
        maxInclusive: true,
      });
    });

    it('handles floating ranges as lower bounds', () => {
      expect(parseBracketRange('[1.*,2]')).toEqual({
        type: 'nuget-bracket-range',
        min: {
          type: 'nuget-floating-range',
          major: 1,
          minor: 0,
          floating: 'minor',
        },
        max: { type: 'nuget-version', major: 2 },
        minInclusive: true,
        maxInclusive: true,
      });

      expect(parseBracketRange('[1.*,)')).toEqual({
        type: 'nuget-bracket-range',
        min: {
          type: 'nuget-floating-range',
          major: 1,
          minor: 0,
          floating: 'minor',
        },
        minInclusive: true,
        maxInclusive: false,
      });
    });
  });

  describe('versionToString', () => {
    test.each`
      version
      ${'1'}
      ${'1.2'}
      ${'1.2.3'}
      ${'1.2.3.4'}
      ${'1-beta'}
      ${'1.2-beta'}
      ${'1.2.3-beta'}
      ${'1.2.3.4-beta'}
      ${'1.2.3.4-beta+ABC'}
    `('$version', ({ version }) => {
      const v = versionToString(parseVersion(version)!);
      expect(v).toEqual(version);
    });
  });

  describe('rangeToString', () => {
    test.each`
      version
      ${'[1]'}
      ${'[1.2]'}
      ${'[1.2.3]'}
      ${'[1.2.3.4]'}
      ${'[1-foo]'}
      ${'[1.2-bar]'}
      ${'[1.2.3-baz]'}
      ${'[1.2.3.4-qux]'}
      ${'*'}
      ${'1.*'}
      ${'1.2.*'}
      ${'1.2.3.*'}
      ${'1.2.3.4-*'}
      ${'1.2.3.*-*'}
      ${'1.2.*-*'}
      ${'1.*-*'}
      ${'*-*'}
      ${'1234*'}
      ${'1.234*'}
      ${'1.2.34*'}
      ${'1.2.3.4*'}
      ${'(1,2)'}
      ${'[1,2)'}
      ${'(1,2]'}
      ${'[1,2]'}
      ${'(*,2)'}
      ${'[*,2)'}
      ${'(*,2]'}
      ${'[*,2]'}
      ${'(1,)'}
      ${'(1,]'}
      ${'[1,]'}
      ${'[1,)'}
      ${'(*,)'}
      ${'(*,]'}
      ${'[*,]'}
      ${'[*,)'}
      ${'(,1)'}
      ${'(,1]'}
      ${'[,1]'}
      ${'[,1)'}
    `('$version', ({ version }) => {
      const r = parseRange(version)!;
      expect(rangeToString(r)).toEqual(version);
    });
  });
});
