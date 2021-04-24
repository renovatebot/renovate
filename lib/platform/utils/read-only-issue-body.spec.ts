import { getName, loadFixture } from '../../../test/util';
import { readOnlyIssueBody } from './read-only-issue-body';

const issueBody = loadFixture(__filename, 'issue-body.txt');

describe(getName(__filename), () => {
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
