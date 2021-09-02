import { parseGitAuthor } from './author';

describe('util/git/author', () => {
  describe('parseGitAuthor', () => {
    it('returns null if empty email given', () => {
      expect(parseGitAuthor(undefined)).toBeNull();
    });
    it('parses bot email', () => {
      // FIXME: explicit assert condition
      expect(
        parseGitAuthor('some[bot]@users.noreply.github.com')
      ).toMatchSnapshot();
    });
    it('parses bot name and email', () => {
      // FIXME: explicit assert condition
      expect(
        parseGitAuthor('"some[bot]" <some[bot]@users.noreply.github.com>')
      ).toMatchSnapshot();
    });
    it('escapes names', () => {
      // FIXME: explicit assert condition
      expect(
        parseGitAuthor('name [what] <name@what.com>').name
      ).toMatchSnapshot();
    });
    it('gives up', () => {
      expect(parseGitAuthor('a.b.c')).toBeNull();
    });
  });
});
