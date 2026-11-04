import { GitLabProjectMembers } from './schema.ts';

describe('modules/platform/gitlab/schema', () => {
  describe('GitLabProjectMembers', () => {
    it('parses members with an access level', () => {
      expect(
        GitLabProjectMembers.parse([
          { username: 'dev', access_level: 30 },
          { username: 'maintainer', access_level: 40 },
        ]),
      ).toEqual([
        { username: 'dev', access_level: 30 },
        { username: 'maintainer', access_level: 40 },
      ]);
    });

    it('treats access_level as optional', () => {
      expect(GitLabProjectMembers.parse([{ username: 'dev' }])).toEqual([
        { username: 'dev' },
      ]);
    });

    it('ignores unspecified fields', () => {
      expect(
        GitLabProjectMembers.parse([
          { id: 1, username: 'dev', access_level: 30, extra: 'ignored' },
        ]),
      ).toEqual([{ username: 'dev', access_level: 30 }]);
    });

    it('filters out malformed entries', () => {
      expect(
        GitLabProjectMembers.parse([
          { username: 'dev', access_level: 30 },
          { access_level: 40 },
          { username: 42 },
          null,
        ]),
      ).toEqual([{ username: 'dev', access_level: 30 }]);
    });

    it('rejects a non-array input', () => {
      expect(GitLabProjectMembers.safeParse('not an array').success).toBe(
        false,
      );
    });
  });
});
