import { Fixtures } from '../../../test/fixtures';
import { readOnlyIssueBody } from './read-only-issue-body';

const issueBody = Fixtures.get('issue-body.txt');

describe('platform/utils/read-only-issue-body', () => {
  describe('.readOnlyIssueBody', () => {
    it('removes all checkbox formatting', () => {
      expect(readOnlyIssueBody(issueBody)).toEqual(
        expect.not.stringContaining('[ ] <!--')
      );
    });

    it('removes all checkbox-related instructions', () => {
      expect(readOnlyIssueBody(issueBody)).toEqual(
        expect.not.stringMatching(
          /click (?:(?:on |)a|their) checkbox|check the box below/gi
        )
      );
    });
  });
});
