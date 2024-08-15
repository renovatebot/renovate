import { logger } from '../../../logger';
import type { BranchStatus } from '../../../types';
import * as git from '../../../util/git';
import * as hostRules from '../../../util/host-rules';
import ScmManagerHttp from '../../../util/http/scm-manager';
import { sanitize } from '../../../util/sanitize';
import type {
  BranchStatusConfig,
  CreatePRConfig,
  EnsureCommentConfig,
  EnsureCommentRemovalConfigByContent,
  EnsureCommentRemovalConfigByTopic,
  EnsureIssueConfig,
  FindPRConfig,
  Issue,
  MergePRConfig,
  PlatformParams,
  PlatformResult,
  Pr,
  RepoParams,
  RepoResult,
  UpdatePrConfig,
} from '../types';
import { repoFingerprint } from '../util';
import { smartTruncate } from '../utils/pr-body';
import { mapPrFromScmToRenovate } from './mapper';
import { getRepoUrl, mapPrState, matchPrState, smartLinks } from './utils';

interface SCMMRepoConfig {
  repository: string;
  prList: Pr[] | null;
  defaultBranch: string;
}

export const id = 'scm-manager';

let config: SCMMRepoConfig = {} as any;
let scmManagerHttp: ScmManagerHttp;

export async function initPlatform({
  endpoint,
  token,
}: PlatformParams): Promise<PlatformResult> {
  if (!endpoint) {
    throw new Error('SCM-Manager endpoint not configured');
  }

  if (!token) {
    throw new Error('SCM-Manager API token not configured');
  }

  scmManagerHttp = new ScmManagerHttp(endpoint, token);

  try {
    const me = await scmManagerHttp.getCurrentUser();
    const gitAuthor = `${me.displayName} <${me.mail}>`;
    const result = { endpoint, gitAuthor };

    logger.info(`Plattform initialized ${JSON.stringify(result)}`);

    return result;
  } catch (err) {
    logger.debug(
      { err },
      'Error authenticating with SCM-Manager. Check your token',
    );
    throw new Error('Init: Authentication failure');
  }
}

export async function initRepo({
  repository,
  gitUrl,
}: RepoParams): Promise<RepoResult> {
  const hostOptions = hostRules.find({
    hostType: id,
    url: scmManagerHttp.getEndpoint(),
  });

  if (!hostOptions.username) {
    throw new Error('Username is not provided');
  }

  if (!hostOptions.token) {
    throw new Error('Token is not provided');
  }

  const repo = await scmManagerHttp.getRepo(repository);
  const defaultBranch = await scmManagerHttp.getDefaultBranch(repo);
  const url = getRepoUrl(repo, gitUrl, hostOptions.username, hostOptions.token);

  config = {} as any;
  config.repository = repository;
  config.defaultBranch = defaultBranch;

  await git.initRepo({
    ...config,
    url,
  });

  // Reset cached resources
  invalidatePrCache();

  const result = {
    defaultBranch: config.defaultBranch,
    isFork: false,
    repoFingerprint: repoFingerprint(
      config.repository,
      scmManagerHttp.getEndpoint(),
    ),
  };

  logger.info(`Repo initialized: ${JSON.stringify(result)}`);

  return result;
}

export async function getRepos(): Promise<string[]> {
  const repos = (await scmManagerHttp.getAllRepos()).filter(
    (repo) => repo.type === 'git',
  );
  const result = repos.map((repo) => `${repo.namespace}/${repo.name}`);
  logger.debug(`Discovered ${repos.length} repos`);

  return result;
}

export async function getBranchPr(branchName: string): Promise<Pr | null> {
  return await findPr({ branchName, state: 'open' });
}

export async function findPr({
  branchName,
  prTitle,
  state = 'all',
}: FindPRConfig): Promise<Pr | null> {
  const inProgressPrs = await getPrList();
  const result = inProgressPrs.find(
    (pr) =>
      branchName === pr.sourceBranch &&
      (!prTitle || prTitle === pr.title) &&
      matchPrState(pr, state),
  );

  if (result) {
    logger.info(`Found PR ${JSON.stringify(result)}`);
    return result;
  }

  logger.debug(
    `Could not find PR with source branch ${branchName} and title ${
      prTitle ?? ''
    } and state ${state}`,
  );

  return null;
}

export async function getPr(number: number): Promise<Pr | null> {
  const inProgressPrs = await getPrList();
  const cachedPr = inProgressPrs.find((pr) => pr.number === number);

  if (cachedPr) {
    logger.info('Returning from cached PRs');
    return cachedPr;
  }

  try {
    const result = await scmManagerHttp.getRepoPr(config.repository, number);
    logger.info('Returning PR from API');
    return mapPrFromScmToRenovate(result);
  } catch (error) {
    logger.error(`Can not find a PR with id ${number}`);
    return null;
  }
}

export async function getPrList(): Promise<Pr[]> {
  if (config.prList === null) {
    try {
      config.prList = (
        await scmManagerHttp.getAllRepoPrs(config.repository)
      ).map((pr) => mapPrFromScmToRenovate(pr));
    } catch (error) {
      logger.error(error);
    }
  }

  return config.prList ?? [];
}

export async function createPr({
  sourceBranch,
  targetBranch,
  prTitle,
  prBody,
  draftPR,
}: CreatePRConfig): Promise<Pr> {
  const createdPr = await scmManagerHttp.createPr(config.repository, {
    source: sourceBranch,
    target: targetBranch,
    title: prTitle,
    description: sanitize(prBody),
    status: draftPR ? 'DRAFT' : 'OPEN',
  });

  logger.info(
    `PR created with title '${createdPr.title}' from source '${createdPr.source}' to target '${createdPr.target}'`,
  );

  return mapPrFromScmToRenovate(createdPr);
}

export async function updatePr({
  number,
  prTitle,
  prBody,
  state,
  targetBranch,
}: UpdatePrConfig): Promise<void> {
  await scmManagerHttp.updatePr(config.repository, number, {
    title: prTitle,
    description: sanitize(prBody) ?? undefined,
    target: targetBranch,
    status: mapPrState(state),
  });

  logger.info(`Updated PR #${number} with title ${prTitle}`);
}

export function mergePr(config: MergePRConfig): Promise<boolean> {
  logger.debug('Not implemented mergePr');
  return Promise.resolve(false);
}

export function getBranchStatus(
  branchName: string,
  internalChecksAsSuccess: boolean,
): Promise<BranchStatus> {
  logger.debug('Not implemented getBranchStatus');
  return Promise.resolve('red');
}

export function setBranchStatus(
  branchStatusConfig: BranchStatusConfig,
): Promise<void> {
  logger.debug('Not implemented setBranchStatus');
  return Promise.resolve();
}

export function getBranchStatusCheck(
  branchName: string,
  context: string | null | undefined,
): Promise<BranchStatus | null> {
  logger.debug('Not implemented setBranchStatus');
  return Promise.resolve(null);
}

export function addReviewers(
  number: number,
  reviewers: string[],
): Promise<void> {
  logger.debug('Not implemented addReviewers');
  return Promise.resolve();
}

export function addAssignees(
  number: number,
  assignees: string[],
): Promise<void> {
  logger.debug('Not implemented addAssignees');
  return Promise.resolve();
}

export function deleteLabel(number: number, label: string): Promise<void> {
  logger.debug('Not implemented deleteLabel');
  return Promise.resolve();
}

export function getIssueList(): Promise<Issue[]> {
  logger.debug('Not implemented getIssueList');
  return Promise.resolve([]);
}

export function findIssue(title: string): Promise<Issue | null> {
  logger.debug('Not implemented findIssue');
  return Promise.resolve(null);
}

export function ensureIssue(
  config: EnsureIssueConfig,
): Promise<'updated' | 'created' | null> {
  logger.debug('Not implemented ensureIssue');
  return Promise.resolve(null);
}

export function ensureIssueClosing(title: string): Promise<void> {
  logger.debug('Not implemented ensureIssueClosing');
  return Promise.resolve();
}

/* istanbul ignore next */
export function ensureComment(config: EnsureCommentConfig): Promise<boolean> {
  logger.debug('Not implemented ensureComment');
  return Promise.resolve(false);
}

export function ensureCommentRemoval(
  ensureCommentRemoval:
    | EnsureCommentRemovalConfigByTopic
    | EnsureCommentRemovalConfigByContent,
): Promise<void> {
  logger.debug('Not implemented ensureCommentRemoval');
  return Promise.resolve();
}

export function massageMarkdown(prBody: string): string {
  return smartTruncate(smartLinks(prBody), maxBodyLength());
}

export function getRepoForceRebase(): Promise<boolean> {
  return Promise.resolve(false);
}

export function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<string | null> {
  logger.debug('Not implemented getRawFile');
  return Promise.resolve(null);
}

export function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<any> {
  logger.debug('Not implemented getJsonFile');
  return Promise.resolve(undefined);
}

export function maxBodyLength(): number {
  return 200000;
}

/* istanbul ignore next */
export function invalidatePrCache(): void {
  config.prList = null;
}
