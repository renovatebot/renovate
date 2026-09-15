import semver from 'semver';
import { logger } from '../../../logger/index.ts';
import { ForgejoHttp, setBaseUrl } from '../../../util/http/forgejo.ts';
import { createPlatform } from '../gitea/index.ts';
import type { PlatformParams, PlatformResult } from '../types.ts';
import { getActionsIdToken } from './oidc.ts';

export const id = 'forgejo';

export const forgejoHttp = new ForgejoHttp();

function logDetectedVersion(version: string): void {
  logger.debug(`Forgejo version: ${version}`);
}

function checkNativeAutomerge(version: string): string | null {
  // Only Forgejo v10.0.0+ supports delete_branch_after_merge.
  // Codeberg uses git versioning like `11.0.1-99-c504062+gitea-1.22.0` so allow any version >= 10.0.0-0.
  if (semver.gte(version, '10.0.0-0')) {
    return null;
  }
  return `Forgejo-native automerge: not supported on this version of Forgejo. Use 10.0.0 or newer.`;
}

const { platform, resetPlatform } = createPlatform({
  id,
  defaultEndpoint: 'https://code.forgejo.org/',
  http: forgejoHttp,
  setBaseUrl,
  logDetectedVersion,
  checkNativeAutomerge,
});

export { resetPlatform };

export async function initPlatform(
  params: PlatformParams,
): Promise<PlatformResult> {
  if (params.token || !params.forgejoOidcAudience) {
    return platform.initPlatform(params);
  }

  logger.debug(
    'No token configured, using a Forgejo Actions OIDC ID token as platform token',
  );
  const token = await getActionsIdToken(params.forgejoOidcAudience);
  const result = await platform.initPlatform({ ...params, token });
  // Return the token so that it gets added to the platform host rule
  return { ...result, token };
}

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
  initRepo,
  mergePr,
  setBranchStatus,
  updatePr,
} = platform;
