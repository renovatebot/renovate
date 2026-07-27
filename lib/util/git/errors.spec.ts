import { codeBlock } from 'common-tags';
import { CONFIG_VALIDATION } from '../../constants/error-messages.ts';
import { bulkChangesDisallowed, handleCommitError } from './error.ts';
import type { FileChange } from './types.ts';

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

// Real-world GH013 error from a GitHub Push Protection ruleset that
// restricts writes to files under .github/workflows/. Captured from a
// self-hosted Renovate run.
const gh013PushProtectionErr = codeBlock`
  To https://github.com/the-org/example.git
  ! refs/renovate/branches/renovate/go-1.x:refs/renovate/branches/renovate/go-1.x [remote rejected] (push declined due to repository rule violations)
  Done
  Pushing to https://github.com/the-org/example.git
  POST git-receive-pack (734 bytes)
  remote: error: GH013: Repository rule violations found for refs/renovate/branches/renovate/go-1.x.
  remote: Review all repository rules at https://github.com/the-org/example/rules?ref=refs%2Frenovate%2Fbranches%2Frenovate%2Fgo-1.x
  remote:
  remote: - GITHUB PUSH PROTECTION
  remote:   ---------------------------------------
  remote:     Resolve the following violations before pushing again
  remote:
  remote:     - File path is restricted
  remote:       Found 2 violations:
  remote:
  remote:       .github/workflows/build.yaml
  remote:       .github/workflows/deploy.yaml
  remote:
  error: failed to push some refs to 'https://github.com/the-org/example.git'
`;

const workflowFile: FileChange = {
  type: 'addition',
  path: '.github/workflows/build.yaml',
  contents: '',
};

describe('util/git/errors', () => {
  describe('bulkChangesDisallowed', () => {
    it('should match the expected error', () => {
      const err = new Error(errorMsg);
      expect(bulkChangesDisallowed(err)).toBe(true);
    });
  });

  describe('handleCommitError', () => {
    it('throws a CONFIG_VALIDATION error when GitHub returns GH013', () => {
      const err = new Error(gh013PushProtectionErr);
      // Even when every changed file is under .github/workflows/, which
      // previously triggered a silent info-level abort, GH013 must be
      // surfaced so the repository is flagged as failing.
      let thrown: any;
      try {
        handleCommitError(err, 'renovate/go-1.x', [workflowFile]);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown.message).toBe(CONFIG_VALIDATION);
      expect(thrown.validationSource).toBe('renovate/go-1.x');
      expect(thrown.validationError).toBe(
        'GitHub repository ruleset violation',
      );
      expect(thrown.validationMessage).toContain('GH013');
      expect(thrown.validationMessage).toContain('renovate/go-1.x');
    });

    it('still silently aborts on generic workflow-file push rejection', () => {
      // Sanity check: non-GH013 workflow rejection should still be
      // swallowed so we do not regress the existing behaviour where
      // App tokens without the `workflows` scope abort quietly.
      const err = new Error(codeBlock`
        remote rejected refs/renovate/branches/foo
        error: failed to push some refs to 'https://github.com/the-org/example.git'
      `);
      const result = handleCommitError(err, 'renovate/foo', [workflowFile]);
      expect(result).toBeNull();
    });
  });
});
