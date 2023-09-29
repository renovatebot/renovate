import {
  filterGlobOrRegexArray,
  matchGlobOrRegex,
  matchGlobOrRegexArray,
} from './pattern-match';

describe('util/pattern-match', () => {
  describe('filterGlobOrRegexArray', () => {
    it('returns empty array if no matches', () => {
      expect(filterGlobOrRegexArray(['abc'], [])).toEqual([]);
    });

    it('returns empty array if negative match', () => {
      expect(filterGlobOrRegexArray(['abc'], ['!abc'])).toEqual([]);
    });

    it('returns empty array if no positive match', () => {
      expect(filterGlobOrRegexArray(['abc'], ['def'])).toEqual([]);
    });

    it('returns empty array if some negative matches fail', () => {
      expect(filterGlobOrRegexArray(['def'], ['!abc', '!def'])).toEqual([]);
    });

    it('returns input if positive match', () => {
      expect(filterGlobOrRegexArray(['abc'], ['/^abc/'])).toEqual(['abc']);
    });
  });

  describe('matchGlobOrRegex', () => {
    it('throws if given invalid regex', () => {
      expect(() => matchGlobOrRegex('abc', '/project/re**./')).toThrow();
    });
  });

  describe('matchGlobOrRegexArray', () => {
    it('returns false if no matches', () => {
      expect(matchGlobOrRegexArray('abc', [])).toBe(false);
    });
  });
});
