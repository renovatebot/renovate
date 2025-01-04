import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile, getRangeStrategy } from '.';

describe('modules/manager/haskell-cabal/index', () => {
  describe('extractPackageFile()', () => {
    it.each`
      content                                 | expected
      ${'build-depends: base,'}               | ${['base']}
      ${'build-depends:,other,other2'}        | ${['other', 'other2']}
      ${'build-depends : base'}               | ${['base']}
      ${'Build-Depends: base'}                | ${['base']}
      ${'build-depends: a\nbuild-depends: b'} | ${['a', 'b']}
      ${'dependencies: base'}                 | ${[]}
    `(
      'extractPackageFile($content).deps.map(x => x.packageName)',
      ({ content, expected }) => {
        expect(
          extractPackageFile(content).deps.map((x) => x.packageName),
        ).toStrictEqual(expected);
      },
    );

    const minimalCabalFile = Fixtures.get('minimal.cabal');
    expect(extractPackageFile(minimalCabalFile).deps).toStrictEqual([
      {
        autoReplaceStringTemplate: '{{{depName}}} {{{newValue}}}',
        currentValue: '>=4.20',
        datasource: 'hackage',
        depName: 'base',
        packageName: 'base',
        replaceString: 'base>=4.20',
        versioning: 'pvp',
      },
    ]);
  });

  describe('getRangeStrategy()', () => {
    it.each`
      input        | expected
      ${'auto'}    | ${'widen'}
      ${'widen'}   | ${'widen'}
      ${'replace'} | ${'replace'}
    `('getRangeStrategy({ rangeStrategy: $input })', ({ input, expected }) => {
      expect(getRangeStrategy({ rangeStrategy: input })).toBe(expected);
    });
  });
});
