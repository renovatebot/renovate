import {
  countPrecedingIndentation,
  extractNamesAndRanges,
  findExtents,
  splitSingleDependency,
} from './extract';

describe('modules/manager/haskell-cabal/extract', () => {
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
        expect(res?.name).toBe(expectedName);
        expect(res?.range).toBe(expectedRange);
      },
    );
  });

  describe('extractNamesAndRanges()', () => {
    it('trims replaceString', () => {
      const res = extractNamesAndRanges(' a , b ');
      expect(res).toHaveLength(2);
      expect(res[0].replaceString).toBe('a');
    });
  });
});
