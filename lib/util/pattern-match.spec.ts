import {
  filterBlobOrRegexArray,
  matchBlobOrRegex,
  matchBlobOrRegexArray,
} from './pattern-match';

describe('util/pattern-match', () => {
  describe('filterBlobOrRegexArray', () => {
    it('returns empty array if no matches', () => {
      expect(filterBlobOrRegexArray(['abc'], [])).toEqual([]);
    });

    it('returns empty array if negative match', () => {
      expect(filterBlobOrRegexArray(['abc'], ['!abc'])).toEqual([]);
    });

    it('returns empty array if no positive match', () => {
      expect(filterBlobOrRegexArray(['abc'], ['def'])).toEqual([]);
    });

    it('returns empty array if some negative matches fail', () => {
      expect(filterBlobOrRegexArray(['def'], ['!abc', '!def'])).toEqual([]);
    });

    it('returns input if positive match', () => {
      expect(filterBlobOrRegexArray(['abc'], ['/^abc/'])).toEqual(['abc']);
    });
  });

  describe('matchBlobOrRegex', () => {
    it('throws if given invalid regex', () => {
      expect(() => matchBlobOrRegex('abc', '/project/re**./')).toThrow();
    });
  });

  describe('matchBlobOrRegexArray', () => {
    it('returns false if no matches', () => {
      expect(matchBlobOrRegexArray('abc', [])).toBe(false);
    });
  });
});
