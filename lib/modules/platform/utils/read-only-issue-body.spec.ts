import { Fixtures } from '../../../../test/fixtures';
import { readOnlyIssueBody } from './read-only-issue-body';

const issueBody = Fixtures.get('issue-body.txt');

describe('modules/platform/utils/read-only-issue-body', () => {
  describe('.readOnlyIssueBody', () => {
    it('removes all checkbox formatting', () => {
      expect(readOnlyIssueBody(issueBody)).toEqual(
        expect.not.stringContaining('[ ] <!--'),
      );
    });

    it('removes all checkbox-related instructions', () => {
      expect(readOnlyIssueBody(issueBody)).toEqual(
        expect.not.stringMatching(
          /click (?:(?:on |)a|their|this) checkbox|check the box below/gi,
        ),
      );
    });

    it('removes the create-all-rate-limited-prs', () => {
      const s = readOnlyIssueBody(issueBody);
      expect(s).toEqual(
        expect.not.stringMatching('Create all rate-limited PRs at once'),
      );
    });
  });
});
