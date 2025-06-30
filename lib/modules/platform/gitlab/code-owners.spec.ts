import { extractRulesFromCodeOwnersLines } from './code-owners';

describe('modules/platform/gitlab/code-owners', () => {
  describe('CodeOwnersParser', () => {
    it('should extract an owner rule from a line', () => {
      const rules = extractRulesFromCodeOwnersLines([
        'pattern username1 username2',
      ]);

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
      const rules = extractRulesFromCodeOwnersLines(['pattern']);

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
      const lines = ['[team] username1 username2', 'filename'];
      const rules = extractRulesFromCodeOwnersLines(lines);

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
      const lines = ['[team]', 'filename'];
      const rules = extractRulesFromCodeOwnersLines(lines);

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
