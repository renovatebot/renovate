import { codeBlock } from 'common-tags';
import { bulkChangesDisallowed } from './error';

const errorMsg = codeBlock`
  To https://github.com/the-org/st-mono.git
  !\t:refs/renovate/branches/renovate/foo\t[remote failure] (remote failed to report status)
  !\t:refs/renovate/branches/renovate/bar\t[remote failure] (remote failed to report status)
  Done
  Pushing to https://github.com/foo/bar.git
  POST git-receive-pack (1234 bytes)
  remote: Repository policies do not allow pushes that update more than 2 branches or tags.
  error: failed to push some refs to 'https://github.com/foo/bar.git'
`;

describe('util/git/errors', () => {
  describe('bulkChangesDisallowed', () => {
    it('should match the expected error', () => {
      const err = new Error(errorMsg);
      expect(bulkChangesDisallowed(err)).toBe(true);
    });
  });
});
