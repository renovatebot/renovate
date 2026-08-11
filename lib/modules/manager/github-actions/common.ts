import { regEx } from '../../../util/regex.ts';
import type { OnboardedWorkflows } from './types.ts';

/**
 * `gh actions-lock` writes the locked graph of all onboarded workflows, including transitive dependencies of local composite actions, to a single lock file at a fixed location.
 *
 * It is therefore not necessarily a sibling of the package file(s) that are updated.
 */
export const actionsLockFile = '.github/workflows/actions.lock';

/** Matches GitHub workflow files, not Gitea/Forgejo workflows, `workflow-templates/` or composite action manifests. */
export const githubWorkflowFileRe = regEx(
  /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/,
);

/** Matches a composite action manifest, which GitHub requires to be named `action.yml` or `action.yaml`. */
const compositeActionFileRe = regEx(/(^|\/)action\.ya?ml$/);

/** Matches anything below a Gitea or Forgejo directory, which `gh actions-lock` never reads. */
const giteaOrForgejoFileRe = regEx(/(^|\/)\.(?:gitea|forgejo)\//);

/**
 * Whether `gh actions-lock` owns the digests in this file, given the workflows which the lock file has onboarded.
 *
 * A repository can deliberately keep a workflow out of the lock file, and those stay ours to pin.
 * A local composite action is never keyed by the lock file, but can be a transitive dependency of a workflow which is onboarded, so the tool rewrites it too.
 * Everything else this manager extracts - Gitea and Forgejo workflows and actions, `workflow-templates/` - is invisible to the tool, so stays ours as well.
 */
export function isLockfileManaged(
  packageFile: string,
  onboardedWorkflows: OnboardedWorkflows,
): boolean {
  if (githubWorkflowFileRe.test(packageFile)) {
    return packageFile in onboardedWorkflows;
  }

  return (
    compositeActionFileRe.test(packageFile) &&
    !giteaOrForgejoFileRe.test(packageFile)
  );
}
