import { logger } from '../../../logger';
import type { BranchStatus } from '../../../types';
import * as git from '../../../util/git';
import * as hostRules from '../../../util/host-rules';
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
import ScmClient from './scm-client';
import { getRepoUrl, mapPrState, matchPrState, smartLinks } from './utils';

interface SCMMRepoConfig {
  repository: string;
  prList: Pr[] | null;
  defaultBranch: string;
}

export const id = 'scmm';

let config: SCMMRepoConfig = {} as any;
let scmmClient: ScmClient;

export async function initPlatform({
  endpoint,
  token,
}: PlatformParams): Promise<PlatformResult> {
  if (!endpoint) {
    throw new Error('SCM-Manager endpoint not configured');
  }

  if (!token) {
    throw new Error('SCM-Manager api token not configured');
  }

  scmmClient = new ScmClient(endpoint, token);

  const me = await scmmClient.getCurrentUser();
  const gitAuthor = `${me.displayName} <${me.mail}>`;
  const result = { endpoint, gitAuthor };

  logger.info(`Plattform initialized ${JSON.stringify(result)}`);

  return result;
}

export async function initRepo({
  repository,
  gitUrl,
}: RepoParams): Promise<RepoResult> {
  const repo = await scmmClient.getRepo(repository);
  const defaultBranch = await scmmClient.getDefaultBranch(repo);
  const url = getRepoUrl(
    repo,
    gitUrl,
    /* istanbul ignore next */
    hostRules.find({ hostType: id, url: scmmClient.getEndpoint() }).username ??
      '',
    process.env.RENOVATE_TOKEN ?? '',
  );

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
      scmmClient.getEndpoint(),
    ),
  };

  logger.info(`Repo initialized: ${JSON.stringify(result)}`);

  return result;
}

export async function getRepos(): Promise<string[]> {
  const repos = (await scmmClient.getAllRepos()).filter(
    (repo) => repo.type === 'git',
  );
  const result = repos.map((repo) => `${repo.namespace}/${repo.name}`);
  logger.info(`Discovered ${repos.length} repos`);

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
    logger.info(`Returning from cached PRs, ${JSON.stringify(cachedPr)}`);
    return cachedPr;
  }

  try {
    const result = await scmmClient.getRepoPr(config.repository, number);
    logger.info(`Returning PR from API, ${JSON.stringify(result)}`);
    return mapPrFromScmToRenovate(result);
  } catch (error) {
    logger.info(`Not found PR with id ${number}`);
    return null;
  }
}

export async function getPrList(): Promise<Pr[]> {
  if (config.prList === null) {
    try {
      config.prList = (await scmmClient.getAllRepoPrs(config.repository)).map(
        (pr) => mapPrFromScmToRenovate(pr),
      );
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
  const createdPr = await scmmClient.createPr(config.repository, {
    source: sourceBranch,
    target: targetBranch,
    title: prTitle,
    description: sanitize(prBody),
    status: draftPR ? 'DRAFT' : 'OPEN',
  });

  logger.info(
    `Pr Created with title '${createdPr.title}' from source '${createdPr.source}' to target '${createdPr.target}'`,
  );
  logger.debug(`Pr Created ${JSON.stringify(createdPr)}`);

  return mapPrFromScmToRenovate(createdPr);
}

export async function updatePr({
  number,
  prTitle,
  prBody,
  state,
  targetBranch,
}: UpdatePrConfig): Promise<void> {
  await scmmClient.updatePr(config.repository, number, {
    title: prTitle,
    description: sanitize(prBody) ?? undefined,
    target: targetBranch,
    status: mapPrState(state),
  });

  logger.info(`Updated Pr #${number} with title ${prTitle}`);
}

/* istanbul ignore next */
export function mergePr(config: MergePRConfig): Promise<boolean> {
  logger.debug('NO-OP mergePr');
  return Promise.resolve(false);
}

/* istanbul ignore next */
export function getBranchStatus(
  branchName: string,
  internalChecksAsSuccess: boolean,
): Promise<BranchStatus> {
  logger.debug('NO-OP getBranchStatus');
  return Promise.resolve('red');
}

/* istanbul ignore next */
export function setBranchStatus(
  branchStatusConfig: BranchStatusConfig,
): Promise<void> {
  logger.debug('NO-OP setBranchStatus');
  return Promise.resolve();
}

/* istanbul ignore next */
export function getBranchStatusCheck(
  branchName: string,
  context: string | null | undefined,
): Promise<BranchStatus | null> {
  logger.debug('NO-OP setBranchStatus');
  return Promise.resolve(null);
}

/* istanbul ignore next */
export function addReviewers(
  number: number,
  reviewers: string[],
): Promise<void> {
  logger.debug('NO-OP addReviewers');
  return Promise.resolve();
}

/* istanbul ignore next */
export function addAssignees(
  number: number,
  assignees: string[],
): Promise<void> {
  logger.debug('NO-OP addAssignees');
  return Promise.resolve();
}

/* istanbul ignore next */
export function deleteLabel(number: number, label: string): Promise<void> {
  logger.debug('NO-OP deleteLabel');
  return Promise.resolve();
}

/* istanbul ignore next */
export function getIssueList(): Promise<Issue[]> {
  logger.debug('NO-OP getIssueList');
  return Promise.resolve([]);
}

/* istanbul ignore next */
export function findIssue(title: string): Promise<Issue | null> {
  logger.debug('NO-OP findIssue');
  return Promise.resolve(null);
}

/* istanbul ignore next */
export function ensureIssue(
  config: EnsureIssueConfig,
): Promise<'updated' | 'created' | null> {
  logger.debug('NO-OP ensureIssue');
  return Promise.resolve(null);
}

/* istanbul ignore next */
export function ensureIssueClosing(title: string): Promise<void> {
  logger.debug('NO-OP ensureIssueClosing');
  return Promise.resolve();
}

/* istanbul ignore next */
export function ensureComment(config: EnsureCommentConfig): Promise<boolean> {
  logger.debug('NO-OP ensureComment');
  return Promise.resolve(false);
}

/* istanbul ignore next */
export function ensureCommentRemoval(
  ensureCommentRemoval:
    | EnsureCommentRemovalConfigByTopic
    | EnsureCommentRemovalConfigByContent,
): Promise<void> {
  logger.debug('NO-OP ensureCommentRemoval');
  return Promise.resolve();
}

/* istanbul ignore next */
export function massageMarkdown(prBody: string): string {
  return smartTruncate(smartLinks(prBody), 10000);
}

/* istanbul ignore next */
export function getRepoForceRebase(): Promise<boolean> {
  return Promise.resolve(false);
}

/* istanbul ignore next */
export function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<string | null> {
  logger.debug('NO-OP getRawFile');
  return Promise.resolve(null);
}

/* istanbul ignore next */
export function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<any> {
  logger.debug('NO-OP getJsonFile');
  return Promise.resolve(undefined);
}

/* istanbul ignore next */
export function invalidatePrCache(): void {
  config.prList = null;
}
