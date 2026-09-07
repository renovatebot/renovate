import semver from 'semver';
import { logger } from '../../../logger/index.ts';
import { setBaseUrl } from '../../../util/http/gitea.ts';
import { createPlatform } from '../gitea-common/index.ts';
import { giteaHttp } from './gitea-helper.ts';

export const id = 'gitea';

/**
 * Forgejo reports the Gitea version it is compatible with as part of its own
 * version, for example `11.0.1-99-c504062+gitea-1.22.0`.
 */
function isForgejo(version: string): boolean {
  return version.includes('gitea-');
}

function logDetectedVersion(version: string): void {
  if (isForgejo(version)) {
    logger.info(
      `Detected Forgejo instance, please use 'forgejo' platform instead`,
    );
  }
  logger.debug(
    `${isForgejo(version) ? 'Forgejo' : 'Gitea'} version: ${version}`,
  );
}

function checkNativeAutomerge(version: string): string | null {
  // Only Gitea v1.24.0+ and Forgejo v10.0.0+ support delete_branch_after_merge.
  const minVersion = isForgejo(version) ? '10.0.0' : '1.24.0';
  if (semver.gte(version, minVersion)) {
    return null;
  }
  return `Gitea-native automerge: not supported on this version of ${isForgejo(version) ? 'Forgejo' : 'Gitea'}. Use ${minVersion} or newer.`;
}

const { platform, resetPlatform } = createPlatform({
  id,
  defaultEndpoint: 'https://gitea.com/',
  http: giteaHttp,
  setBaseUrl,
  logDetectedVersion,
  checkNativeAutomerge,
  // Requesting reviewers is only supported since Gitea v1.14.0.
  minReviewerVersion: '1.14.0',
});

export { resetPlatform };

/* oxlint-disable typescript/unbound-method */
export const {
  addAssignees,
  addReviewers,
  createPr,
  deleteLabel,
  ensureComment,
  ensureCommentRemoval,
  ensureIssue,
  ensureIssueClosing,
  findIssue,
  findPr,
  getBranchPr,
  getBranchStatus,
  getBranchStatusCheck,
  getIssue,
  getRawFile,
  getJsonFile,
  getIssueList,
  getPr,
  massageMarkdown,
  maxBodyLength,
  getPrList,
  getRepos,
  initPlatform,
  initRepo,
  mergePr,
  setBranchStatus,
  updatePr,
} = platform;
