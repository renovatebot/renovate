const fs = require('fs');
const {
  readOnlyIssueBody,
} = require('../../../lib/platform/utils/read-only-issue-body');

const issueBody = fs.readFileSync(
  'test/platform/utils/_fixtures/issue-body.txt',
  'utf8'
);

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
