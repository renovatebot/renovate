import { readOnlyIssueBody } from './read-only-issue-body';
import { Fixtures } from '~test/fixtures';

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
        expect.not.stringMatching(/click on a checkbox below/gi),
      );
    });

    it('removes all approval-all-pending-prs', () => {
      expect(readOnlyIssueBody(issueBody)).toEqual(
        expect.not.stringMatching('Create all pending approval PRs at once'),
      );
    });

    it('removes the create-all-rate-limited-prs', () => {
      const s = readOnlyIssueBody(issueBody);
      expect(s).toEqual(
        expect.not.stringMatching('Create all rate-limited PRs at once'),
      );
    });

    it('removes create-config-migration-pr', () => {
      const s = readOnlyIssueBody(issueBody);
      expect(s).toEqual(
        expect.not.stringMatching('create an automated Config Migration PR'),
      );
    });
  });
});
