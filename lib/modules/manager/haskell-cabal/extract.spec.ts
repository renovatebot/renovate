import {
  countPackageNameLength,
  countPrecedingIndentation,
  extractNamesAndRanges,
  findDepends,
  findExtents,
  splitSingleDependency,
} from './extract';

const commentCabalFile = `build-depends:
  -- leading
 base,
-- middle
 other,
 -- trailing
 other2`;

describe('modules/manager/haskell-cabal/extract', () => {
  describe('countPackageNameLength', () => {
    it.each`
      input       | expected
      ${'-'}      | ${null}
      ${'-j'}     | ${null}
      ${'-H'}     | ${null}
      ${'j-'}     | ${null}
      ${'3-'}     | ${null}
      ${'-3'}     | ${null}
      ${'3'}      | ${null}
      ${'æ'}      | ${null}
      ${'æe'}     | ${null}
      ${'j'}      | ${1}
      ${'H'}      | ${1}
      ${'0ad'}    | ${3}
      ${'3d'}     | ${2}
      ${'aeson'}  | ${5}
      ${'lens'}   | ${4}
      ${'parsec'} | ${6}
    `('matches $input', ({ input, expected }) => {
      const maybeIndex = countPackageNameLength(input);
      expect(maybeIndex).toStrictEqual(expected);
    });
  });

  describe('countPrecedingIndentation()', () => {
    it.each`
      content                                       | index | expected
      ${'\tbuild-depends: base\n\tother-field: hi'} | ${1}  | ${1}
      ${' build-depends: base'}                     | ${1}  | ${1}
      ${'a\tb'}                                     | ${0}  | ${0}
      ${'a\tb'}                                     | ${2}  | ${1}
      ${'a b'}                                      | ${2}  | ${1}
      ${'  b'}                                      | ${2}  | ${2}
    `(
      'countPrecedingIndentation($content, $index)',
      ({ content, index, expected }) => {
        expect(countPrecedingIndentation(content, index)).toBe(expected);
      },
    );
  });

  describe('findExtents()', () => {
    it.each`
      content                | indent | expected
      ${'a: b\n\tc: d'}      | ${1}   | ${10}
      ${'a: b'}              | ${2}   | ${4}
      ${'a: b\n\tc: d'}      | ${2}   | ${4}
      ${'a: b\n '}           | ${2}   | ${6}
      ${'a: b\n c: d\ne: f'} | ${1}   | ${10}
    `('findExtents($indent, $content)', ({ indent, content, expected }) => {
      expect(findExtents(indent, content)).toBe(expected);
    });
  });

  describe('splitSingleDependency()', () => {
    it.each`
      depLine              | expectedName | expectedRange
      ${'base >=2 && <3'}  | ${'base'}    | ${'>=2 && <3'}
      ${'base >=2 && <3 '} | ${'base'}    | ${'>=2 && <3'}
      ${'base>=2&&<3'}     | ${'base'}    | ${'>=2&&<3'}
      ${'base'}            | ${'base'}    | ${''}
    `(
      'splitSingleDependency($depLine)',
      ({ depLine, expectedName, expectedRange }) => {
        const res = splitSingleDependency(depLine);
        expect(res?.name).toEqual(expectedName);
        expect(res?.range).toEqual(expectedRange);
      },
    );

    // The first hyphen makes the package name invalid
    expect(splitSingleDependency('-invalid-package-name')).toBeNull();
  });

  describe('extractNamesAndRanges()', () => {
    it('trims replaceString', () => {
      const res = extractNamesAndRanges(' a , b ');
      expect(res).toEqual([
        { currentValue: '', packageName: 'a', replaceString: 'a' },
        { currentValue: '', packageName: 'b', replaceString: 'b' },
      ]);
    });
  });

  describe('findDepends()', () => {
    it('strips comments', () => {
      const res = findDepends(commentCabalFile + '\na: b');
      expect(res).toEqual({
        buildDependsContent: '\n base,\n other,\n other2',
        lengthProcessed: commentCabalFile.length,
      });
    });
  });
});
