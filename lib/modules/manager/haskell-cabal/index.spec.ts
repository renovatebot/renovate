import { codeBlock } from 'common-tags';
import { extractPackageFile, getRangeStrategy } from '.';

const minimalCabalFile = codeBlock`
cabal-version: 3.4
name: minimal
version: 0.1.0.0

executable my-cli-entry-point
  main-is: Main.hs
  build-depends: base>=4.20`;

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
