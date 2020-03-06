import fs from 'fs-extra';
import { readOnlyIssueBody } from './read-only-issue-body';

describe('platform/utils/read-only-issue-body', () => {
  let issueBody: string;
  beforeAll(async () => {
    issueBody = await fs.readFile(
      'lib/platform/utils/__fixtures__/issue-body.txt',
      'utf8'
    );
  });
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
