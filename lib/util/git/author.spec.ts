import { parseGitAuthor } from './author';

describe('util/git/author', () => {
  describe('parseGitAuthor', () => {
    it('returns null if empty email given', () => {
      expect(parseGitAuthor(undefined as never)).toBeNull();
    });

    it('handles a normal address', () => {
      expect(parseGitAuthor('renovate@whitesourcesoftware.com')).not.toBeNull();
    });

    it('parses bot email', () => {
      expect(parseGitAuthor('renovate[bot]@users.noreply.github.com')).toEqual({
        address: 'renovate[bot]@users.noreply.github.com',
        name: 'renovate[bot]',
      });
    });

    it('parses bot name and email', () => {
      expect(
        parseGitAuthor(
          'renovate[bot] <renovate[bot]@users.noreply.github.com>',
        ),
      ).toEqual({
        address: 'renovate[bot]@users.noreply.github.com',
        name: 'renovate[bot]',
      });
    });

    it('escapes names', () => {
      expect(parseGitAuthor('name [what] <name@what.com>')?.name).toBe(
        `name [what]`,
      );
    });

    it('tries again and fails', () => {
      expect(parseGitAuthor('foo<foo>')).toBeNull();
    });

    it('gives up', () => {
      expect(parseGitAuthor('a.b.c')).toBeNull();
    });
  });
});
