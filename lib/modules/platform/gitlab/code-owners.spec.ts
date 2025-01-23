import { CodeOwnersParser } from './code-owners';

describe('modules/platform/gitlab/code-owners', () => {
  describe('CodeOwnersParser', () => {
    it('should extract an owner rule from a line', () => {
      const parser = new CodeOwnersParser();

      const rules = parser.parseLine('pattern username1 username2').rules;

      expect(rules).toEqual([
        {
          pattern: 'pattern',
          usernames: ['username1', 'username2'],
          score: 7,
          match: expect.any(Function),
        },
      ]);
    });

    it('should extract an owner rule from a line with no usernames', () => {
      const parser = new CodeOwnersParser();

      const rules = parser.parseLine('pattern').rules;

      expect(rules).toEqual([
        {
          pattern: 'pattern',
          usernames: [],
          score: 7,
          match: expect.any(Function),
        },
      ]);
    });

    it('should extract an owner rule from a line after a section header', () => {
      const parser = new CodeOwnersParser();
      const lines = ['[team] username1 username2', 'filename'];

      lines.forEach((line) => parser.parseLine(line));
      const rules = parser.rules;

      expect(rules).toEqual([
        {
          pattern: 'filename',
          usernames: ['username1', 'username2'],
          score: 8,
          match: expect.any(Function),
        },
      ]);
    });

    it('should extract an owner rule from a line after a section header with no usernames', () => {
      const parser = new CodeOwnersParser();
      const lines = ['[team]', 'filename'];

      lines.forEach((line) => parser.parseLine(line));
      const rules = parser.rules;

      expect(rules).toEqual([
        {
          pattern: 'filename',
          usernames: [],
          score: 8,
          match: expect.any(Function),
        },
      ]);
    });
  });
});
