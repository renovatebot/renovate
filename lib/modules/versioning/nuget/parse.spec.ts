import { parseRange, parseVersion } from './parse';

describe('modules/versioning/nuget/parse', () => {
  describe('invalid inputs', () => {
    test.each`
      input
      ${'!@#'}
      ${'abc'}
    `('parse("$input")', ({ input }) => {
      expect(parseVersion(input)).toBeNull();
      expect(parseRange(input)).toBeNull();
    });
  });

  describe('versions', () => {
    describe('omit zeros', () => {
      test.each`
        input
        ${'2'}
        ${'2.0'}
        ${'2.0.0'}
        ${'2.0.0.0'}
      `('parse("$input")', ({ input }) => {
        const res = parseVersion(input);
        expect(res).toEqual({
          type: 'version',
          major: 2,
          minor: 0,
          patch: 0,
          revision: 0,
          prerelease: undefined,
          metadata: undefined,
        });
      });
    });

    describe('prerelease and metadata parsing', () => {
      test.each`
        input                          | prerelease          | metadata
        ${'1.0.0-Beta'}                | ${'Beta'}           | ${undefined}
        ${'1.0.0-Beta+Meta'}           | ${'Beta'}           | ${'Meta'}
        ${'1.0.0-RC.X+Meta'}           | ${'RC.X'}           | ${'Meta'}
        ${'1.0.0-RC.X.35.A.3455+Meta'} | ${'RC.X.35.A.3455'} | ${'Meta'}
      `(
        '"$input" has prerelease: "$prerelease"',
        ({ input, prerelease, metadata }) => {
          const res = parseVersion(input);
          expect(res).toEqual({
            type: 'version',
            major: 1,
            minor: 0,
            patch: 0,
            revision: 0,
            prerelease,
            metadata,
          });
        },
      );
    });
  });

  describe('ranges', () => {
    it('parses exact ranges', () => {
      const res = parseRange('[1.0.0-beta+meta]');
      expect(res).toEqual({
        type: 'range-exact',
        version: {
          type: 'version',
          major: 1,
          minor: 0,
          patch: 0,
          revision: 0,
          prerelease: 'beta',
          metadata: 'meta',
        },
      });
    });

    it('parses min ranges', () => {
      expect(parseRange('(1.2.3,)')).toEqual({
        type: 'range-min',
        min: {
          type: 'version',
          major: 1,
          minor: 2,
          patch: 3,
          revision: 0,
          prerelease: undefined,
          metadata: undefined,
        },
        minInclusive: false,
      });

      expect(parseRange('[1.2.3,)')).toEqual({
        type: 'range-min',
        min: {
          type: 'version',
          major: 1,
          minor: 2,
          patch: 3,
          revision: 0,
          prerelease: undefined,
          metadata: undefined,
        },
        minInclusive: true,
      });
    });

    it('parses max ranges', () => {
      expect(parseRange('(,1.2.3]')).toEqual({
        type: 'range-max',
        max: {
          type: 'version',
          major: 1,
          minor: 2,
          patch: 3,
          revision: 0,
          prerelease: undefined,
          metadata: undefined,
        },
        maxInclusive: true,
      });

      expect(parseRange('(,1.2.3)')).toEqual({
        type: 'range-max',
        max: {
          type: 'version',
          major: 1,
          minor: 2,
          patch: 3,
          revision: 0,
          prerelease: undefined,
          metadata: undefined,
        },
        maxInclusive: false,
      });
    });

    describe('mixed ranges', () => {
      test.each`
        input              | minInclusive | maxInclusive
        ${'(1.2.3,2.3.4)'} | ${false}     | ${false}
        ${'[1.2.3,2.3.4)'} | ${true}      | ${false}
        ${'(1.2.3,2.3.4]'} | ${false}     | ${true}
        ${'[1.2.3,2.3.4]'} | ${true}      | ${true}
      `('parse("$input")', ({ input, minInclusive, maxInclusive }) => {
        expect(parseRange(input)).toEqual({
          type: 'range-mixed',
          min: {
            type: 'version',
            major: 1,
            minor: 2,
            patch: 3,
            revision: 0,
            prerelease: undefined,
            metadata: undefined,
          },
          minInclusive,
          max: {
            type: 'version',
            major: 2,
            minor: 3,
            patch: 4,
            revision: 0,
            prerelease: undefined,
            metadata: undefined,
          },
          maxInclusive,
        });
      });
    });

    describe('floating ranges', () => {
      test.each`
        input          | type                   | major        | minor        | patch        | unstable
        ${'*'}         | ${'floating-major'}    | ${undefined} | ${undefined} | ${undefined} | ${false}
        ${'*-*'}       | ${'floating-major'}    | ${undefined} | ${undefined} | ${undefined} | ${true}
        ${'1.*'}       | ${'floating-minor'}    | ${1}         | ${undefined} | ${undefined} | ${false}
        ${'1.*-*'}     | ${'floating-minor'}    | ${1}         | ${undefined} | ${undefined} | ${true}
        ${'1.2.*'}     | ${'floating-patch'}    | ${1}         | ${2}         | ${undefined} | ${false}
        ${'1.2.*-*'}   | ${'floating-patch'}    | ${1}         | ${2}         | ${undefined} | ${true}
        ${'1.2.3.*'}   | ${'floating-revision'} | ${1}         | ${2}         | ${3}         | ${false}
        ${'1.2.3.*-*'} | ${'floating-revision'} | ${1}         | ${2}         | ${3}         | ${true}
      `('$input', ({ input, type, major, minor, patch, unstable }) => {
        expect(parseRange(input)).toEqual({
          type,
          major,
          minor,
          patch,
          unstable,
        });
      });
    });
  });
});
