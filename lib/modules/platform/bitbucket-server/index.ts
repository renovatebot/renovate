import is from '@sindresorhus/is';
import delay from 'delay';
import JSON5 from 'json5';
import type { PartialDeep } from 'type-fest';
import { PlatformId } from '../../../constants';
import {
  REPOSITORY_CHANGED,
  REPOSITORY_EMPTY,
  REPOSITORY_NOT_FOUND,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { BranchStatus, PrState, VulnerabilityAlert } from '../../../types';
import type { FileData } from '../../../types/platform/bitbucket-server';
import * as git from '../../../util/git';
import { deleteBranch } from '../../../util/git';
import * as hostRules from '../../../util/host-rules';
import {
  BitbucketServerHttp,
  setBaseUrl,
} from '../../../util/http/bitbucket-server';
import type { HttpResponse } from '../../../util/http/types';
import { newlineRegex, regEx } from '../../../util/regex';
import { sanitize } from '../../../util/sanitize';
import { ensureTrailingSlash, getQueryString } from '../../../util/url';
import type {
  BranchStatusConfig,
  CreatePRConfig,
  EnsureCommentConfig,
  EnsureCommentRemovalConfig,
  EnsureIssueConfig,
  EnsureIssueResult,
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
import type {
  BbsConfig,
  BbsPr,
  BbsRestBranch,
  BbsRestPr,
  BbsRestRepo,
  BbsRestUserRef,
} from './types';
import * as utils from './utils';

/*
 * Version: 5.3 (EOL Date: 15 Aug 2019)
 * See following docs for api information:
 * https://docs.atlassian.com/bitbucket-server/rest/5.3.0/bitbucket-rest.html
 * https://docs.atlassian.com/bitbucket-server/rest/5.3.0/bitbucket-build-rest.html
 *
 * See following page for uptodate supported versions
 * https://confluence.atlassian.com/support/atlassian-support-end-of-life-policy-201851003.html#AtlassianSupportEndofLifePolicy-BitbucketServer
 */

let config: BbsConfig = {} as any;

const bitbucketServerHttp = new BitbucketServerHttp();

const defaults: {
  endpoint?: string;
  hostType: string;
} = {
  hostType: PlatformId.BitbucketServer,
};

/* istanbul ignore next */
function updatePrVersion(pr: number, version: number): number {
  const res = Math.max(config.prVersions.get(pr) ?? 0, version);
  config.prVersions.set(pr, res);
  return res;
}

export function initPlatform({
  endpoint,
  username,
  password,
}: PlatformParams): Promise<PlatformResult> {
  if (!endpoint) {
    throw new Error('Init: You must configure a Bitbucket Server endpoint');
  }
  if (!(username && password)) {
    throw new Error(
      'Init: You must configure a Bitbucket Server username/password'
    );
  }
  // TODO: Add a connection check that endpoint/username/password combination are valid (#9595)
  defaults.endpoint = ensureTrailingSlash(endpoint);
  setBaseUrl(defaults.endpoint);
  const platformConfig: PlatformResult = {
    endpoint: defaults.endpoint,
  };
  return Promise.resolve(platformConfig);
}

// Get all repositories that the user has access to
export async function getRepos(): Promise<string[]> {
  logger.debug('Autodiscovering Bitbucket Server repositories');
  try {
    const repos = await utils.accumulateValues(
      `./rest/api/1.0/repos?permission=REPO_WRITE&state=AVAILABLE`
    );
    const result = repos.map(
      (r: { project: { key: string }; slug: string }) =>
        `${r.project.key.toLowerCase()}/${r.slug}`
    );
    logger.debug({ result }, 'result of getRepos()');
    return result;
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, `bitbucket getRepos error`);
    throw err;
  }
}

export async function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string
): Promise<string | null> {
  const repo = repoName ?? config.repository;
  const [project, slug] = repo.split('/');
  const fileUrl =
    `./rest/api/1.0/projects/${project}/repos/${slug}/browse/${fileName}?limit=20000` +
    (branchOrTag ? '&at=' + branchOrTag : '');
  const res = await bitbucketServerHttp.getJson<FileData>(fileUrl);
  const { isLastPage, lines, size } = res.body;
  if (isLastPage) {
    return lines.map(({ text }) => text).join('');
  }
  const msg = `The file is too big (${size}B)`;
  logger.warn({ size }, msg);
  throw new Error(msg);
}

export async function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string
): Promise<any | null> {
  // TODO #7154
  const raw = (await getRawFile(fileName, repoName, branchOrTag)) as string;
  return JSON5.parse(raw);
}

// Initialize BitBucket Server by getting base branch
export async function initRepo({
  repository,
  cloneSubmodules,
  ignorePrAuthor,
  gitUrl,
}: RepoParams): Promise<RepoResult> {
  logger.debug(`initRepo("${JSON.stringify({ repository }, null, 2)}")`);
  const opts = hostRules.find({
    hostType: defaults.hostType,
    url: defaults.endpoint,
  });

  const [projectKey, repositorySlug] = repository.split('/');

  config = {
    projectKey,
    repositorySlug,
    repository,
    prVersions: new Map<number, number>(),
    username: opts.username,
    ignorePrAuthor,
  } as any;

  try {
    const info = (
      await bitbucketServerHttp.getJson<BbsRestRepo>(
        `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}`
      )
    ).body;
    config.owner = info.project.key;
    logger.debug(`${repository} owner = ${config.owner}`);
    const branchRes = await bitbucketServerHttp.getJson<BbsRestBranch>(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/branches/default`
    );

    // 204 means empty, 404 means repo not found or missing default branch. repo must exist here.
    if ([204, 404].includes(branchRes.statusCode)) {
      throw new Error(REPOSITORY_EMPTY);
    }

    const url = utils.getRepoGitUrl(
      config.repositorySlug,
      // TODO #7154
      defaults.endpoint!,
      gitUrl,
      info,
      opts
    );

    await git.initRepo({
      ...config,
      url,
      cloneSubmodules,
      fullClone: true,
    });

    config.mergeMethod = 'merge';
    const repoConfig: RepoResult = {
      defaultBranch: branchRes.body.displayId,
      isFork: !!info.origin,
      repoFingerprint: repoFingerprint(info.id, defaults.endpoint),
    };

    return repoConfig;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      throw new Error(REPOSITORY_NOT_FOUND);
    }
    if (err.message === REPOSITORY_EMPTY) {
      throw err;
    }

    logger.debug({ err }, 'Unknown Bitbucket initRepo error');
    throw err;
  }
}

export async function getRepoForceRebase(): Promise<boolean> {
  logger.debug(`getRepoForceRebase()`);

  // https://docs.atlassian.com/bitbucket-server/rest/7.0.1/bitbucket-rest.html#idp342
  const res = await bitbucketServerHttp.getJson<{
    mergeConfig: { defaultStrategy: { id: string } };
  }>(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/settings/pull-requests`
  );

  // If the default merge strategy contains `ff-only` the PR can only be merged
  // if it is up to date with the base branch.
  // The current options for id are:
  // no-ff, ff, ff-only, rebase-no-ff, rebase-ff-only, squash, squash-ff-only
  return Boolean(
    res.body?.mergeConfig?.defaultStrategy?.id.includes('ff-only')
  );
}
// Gets details for a PR
export async function getPr(
  prNo: number,
  refreshCache?: boolean
): Promise<BbsPr | null> {
  logger.debug(`getPr(${prNo})`);
  if (!prNo) {
    return null;
  }

  const res = await bitbucketServerHttp.getJson<BbsRestPr>(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}`,
    { useCache: !refreshCache }
  );

  const pr: BbsPr = {
    displayNumber: `Pull Request #${res.body.id}`,
    ...utils.prInfo(res.body),
    reviewers: res.body.reviewers.map((r) => r.user.name),
  };
  pr.hasReviewers = is.nonEmptyArray(pr.reviewers);
  // TODO #7154
  pr.version = updatePrVersion(pr.number, pr.version!);

  return pr;
}

// TODO: coverage (#9624)
// istanbul ignore next
function matchesState(state: string, desiredState: string): boolean {
  if (desiredState === PrState.All) {
    return true;
  }
  if (desiredState.startsWith('!')) {
    return state !== desiredState.substring(1);
  }
  return state === desiredState;
}

// TODO: coverage (#9624)
// istanbul ignore next
const isRelevantPr =
  (branchName: string, prTitle: string | null | undefined, state: string) =>
  (p: Pr): boolean =>
    p.sourceBranch === branchName &&
    (!prTitle || p.title === prTitle) &&
    matchesState(p.state, state);

// TODO: coverage (#9624)
export async function getPrList(refreshCache?: boolean): Promise<Pr[]> {
  logger.debug(`getPrList()`);
  // istanbul ignore next
  if (!config.prList || refreshCache) {
    const searchParams: Record<string, string> = {
      state: 'ALL',
    };
    if (!config.ignorePrAuthor) {
      searchParams['role.1'] = 'AUTHOR';
      searchParams['username.1'] = config.username;
    }
    const query = getQueryString(searchParams);
    const values = await utils.accumulateValues(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests?${query}`
    );

    config.prList = values.map(utils.prInfo);
    logger.debug({ length: config.prList.length }, 'Retrieved Pull Requests');
  } else {
    logger.debug('returning cached PR list');
  }
  return config.prList;
}

// TODO: coverage (#9624)
// istanbul ignore next
export async function findPr({
  branchName,
  prTitle,
  state = PrState.All,
  refreshCache,
}: FindPRConfig): Promise<Pr | null> {
  logger.debug(`findPr(${branchName}, "${prTitle!}", "${state}")`);
  const prList = await getPrList(refreshCache);
  const pr = prList.find(isRelevantPr(branchName, prTitle, state));
  if (pr) {
    logger.debug(`Found PR #${pr.number}`);
  } else {
    logger.debug(`Renovate did not find a PR for branch #${branchName}`);
  }
  return pr ?? null;
}

// Returns the Pull Request for a branch. Null if not exists.
export async function getBranchPr(branchName: string): Promise<BbsPr | null> {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr({
    branchName,
    state: PrState.Open,
  });
  return existingPr ? getPr(existingPr.number) : null;
}

// istanbul ignore next
export async function refreshPr(number: number): Promise<void> {
  // wait for pr change propagation
  await delay(1000);
  // refresh cache
  await getPr(number, true);
}

async function getStatus(
  branchName: string,
  useCache = true
): Promise<utils.BitbucketCommitStatus> {
  const branchCommit = git.getBranchCommit(branchName);

  return (
    await bitbucketServerHttp.getJson<utils.BitbucketCommitStatus>(
      // TODO: types (#7154)
      `./rest/build-status/1.0/commits/stats/${branchCommit!}`,
      {
        useCache,
      }
    )
  ).body;
}

// Returns the combined status for a branch.
// umbrella for status checks
// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-build-rest.html#idp2
export async function getBranchStatus(
  branchName: string
): Promise<BranchStatus> {
  logger.debug(`getBranchStatus(${branchName})`);

  if (!git.branchExists(branchName)) {
    logger.debug('Branch does not exist - cannot fetch status');
    throw new Error(REPOSITORY_CHANGED);
  }

  try {
    const commitStatus = await getStatus(branchName);

    logger.debug({ commitStatus }, 'branch status check result');

    if (commitStatus.failed > 0) {
      return BranchStatus.red;
    }
    if (commitStatus.inProgress > 0) {
      return BranchStatus.yellow;
    }
    return commitStatus.successful > 0
      ? BranchStatus.green
      : BranchStatus.yellow;
  } catch (err) {
    logger.warn({ err }, `Failed to get branch status`);
    return BranchStatus.red;
  }
}

function getStatusCheck(
  branchName: string,
  useCache = true
): Promise<utils.BitbucketStatus[]> {
  const branchCommit = git.getBranchCommit(branchName);

  return utils.accumulateValues(
    // TODO: types (#7154)
    `./rest/build-status/1.0/commits/${branchCommit!}`,
    'get',
    { useCache }
  );
}

// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-build-rest.html#idp2
export async function getBranchStatusCheck(
  branchName: string,
  context: string
): Promise<BranchStatus | null> {
  logger.debug(`getBranchStatusCheck(${branchName}, context=${context})`);

  try {
    const states = await getStatusCheck(branchName);

    for (const state of states) {
      if (state.key === context) {
        switch (state.state) {
          case 'SUCCESSFUL':
            return BranchStatus.green;
          case 'INPROGRESS':
            return BranchStatus.yellow;
          case 'FAILED':
          default:
            return BranchStatus.red;
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, `Failed to check branch status`);
  }
  return null;
}

export async function setBranchStatus({
  branchName,
  context,
  description,
  state,
  url: targetUrl,
}: BranchStatusConfig): Promise<void> {
  logger.debug(`setBranchStatus(${branchName})`);

  const existingStatus = await getBranchStatusCheck(branchName, context);
  if (existingStatus === state) {
    return;
  }
  logger.debug({ branch: branchName, context, state }, 'Setting branch status');

  const branchCommit = git.getBranchCommit(branchName);

  try {
    const body: any = {
      key: context,
      description,
      url: targetUrl ?? 'https://renovatebot.com',
    };

    switch (state) {
      case BranchStatus.green:
        body.state = 'SUCCESSFUL';
        break;
      case BranchStatus.yellow:
        body.state = 'INPROGRESS';
        break;
      case BranchStatus.red:
      default:
        body.state = 'FAILED';
        break;
    }

    await bitbucketServerHttp.postJson(
      // TODO: types (#7154)
      `./rest/build-status/1.0/commits/${branchCommit!}`,
      { body }
    );

    // update status cache
    await getStatus(branchName, false);
    await getStatusCheck(branchName, false);
  } catch (err) {
    logger.warn({ err }, `Failed to set branch status`);
  }
}

// Issue

/* istanbul ignore next */
export function findIssue(title: string): Promise<Issue | null> {
  logger.debug(`findIssue(${title})`);
  // This is used by Renovate when creating its own issues,
  // e.g. for deprecated package warnings,
  // config error notifications, or "dependencyDashboard"
  //
  // Bitbucket Server does not have issues
  return Promise.resolve(null);
}

/* istanbul ignore next */
export function ensureIssue({
  title,
}: EnsureIssueConfig): Promise<EnsureIssueResult | null> {
  logger.warn({ title }, 'Cannot ensure issue');
  // This is used by Renovate when creating its own issues,
  // e.g. for deprecated package warnings,
  // config error notifications, or "dependencyDashboard"
  //
  // Bitbucket Server does not have issues
  return Promise.resolve(null);
}

/* istanbul ignore next */
export function getIssueList(): Promise<Issue[]> {
  logger.debug(`getIssueList()`);
  // This is used by Renovate when creating its own issues,
  // e.g. for deprecated package warnings,
  // config error notifications, or "dependencyDashboard"
  //
  // Bitbucket Server does not have issues
  return Promise.resolve([]);
}

/* istanbul ignore next */
export function ensureIssueClosing(title: string): Promise<void> {
  logger.debug(`ensureIssueClosing(${title})`);
  // This is used by Renovate when creating its own issues,
  // e.g. for deprecated package warnings,
  // config error notifications, or "dependencyDashboard"
  //
  // Bitbucket Server does not have issues
  return Promise.resolve();
}

export function addAssignees(iid: number, assignees: string[]): Promise<void> {
  logger.debug(`addAssignees(${iid}, [${assignees.join(', ')}])`);
  // This is used by Renovate when creating its own issues,
  // e.g. for deprecated package warnings,
  // config error notifications, or "dependencyDashboard"
  //
  // Bitbucket Server does not have issues
  return Promise.resolve();
}

export async function addReviewers(
  prNo: number,
  reviewers: string[]
): Promise<void> {
  logger.debug(`Adding reviewers '${reviewers.join(', ')}' to #${prNo}`);

  try {
    const pr = await getPr(prNo);
    if (!pr) {
      throw new Error(REPOSITORY_NOT_FOUND);
    }

    // TODO: can `reviewers` be undefined? (#7154)
    const reviewersSet = new Set([...pr.reviewers!, ...reviewers]);

    await bitbucketServerHttp.putJson(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}`,
      {
        body: {
          title: pr.title,
          version: pr.version,
          reviewers: Array.from(reviewersSet).map((name) => ({
            user: { name },
          })),
        },
      }
    );
    await getPr(prNo, true);
  } catch (err) {
    logger.warn({ err, reviewers, prNo }, `Failed to add reviewers`);
    if (err.statusCode === 404) {
      throw new Error(REPOSITORY_NOT_FOUND);
    } else if (
      err.statusCode === 409 &&
      !utils.isInvalidReviewersResponse(err)
    ) {
      logger.debug(
        '409 response to adding reviewers - has repository changed?'
      );
      throw new Error(REPOSITORY_CHANGED);
    } else {
      throw err;
    }
  }
}

export function deleteLabel(issueNo: number, label: string): Promise<void> {
  logger.debug(`deleteLabel(${issueNo}, ${label})`);
  // Only used for the "request Renovate to rebase a PR using a label" feature
  //
  // Bitbucket Server does not have issues
  return Promise.resolve();
}

type Comment = { text: string; id: number };

async function getComments(prNo: number): Promise<Comment[]> {
  // GET /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/activities
  let comments = await utils.accumulateValues(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/activities`
  );

  comments = comments
    .filter(
      (a: { action: string; commentAction: string }) =>
        a.action === 'COMMENTED' && a.commentAction === 'ADDED'
    )
    .map((a: { comment: Comment }) => a.comment);

  logger.debug(`Found ${comments.length} comments`);

  return comments;
}

async function addComment(prNo: number, text: string): Promise<void> {
  // POST /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments
  await bitbucketServerHttp.postJson(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/comments`,
    {
      body: { text },
    }
  );
}

async function getCommentVersion(
  prNo: number,
  commentId: number
): Promise<number> {
  // GET /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments/{commentId}
  const { version } = (
    await bitbucketServerHttp.getJson<{ version: number }>(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/comments/${commentId}`
    )
  ).body;

  return version;
}

async function editComment(
  prNo: number,
  commentId: number,
  text: string
): Promise<void> {
  const version = await getCommentVersion(prNo, commentId);

  // PUT /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments/{commentId}
  await bitbucketServerHttp.putJson(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/comments/${commentId}`,
    {
      body: { text, version },
    }
  );
}

async function deleteComment(prNo: number, commentId: number): Promise<void> {
  const version = await getCommentVersion(prNo, commentId);

  // DELETE /rest/api/1.0/projects/{projectKey}/repos/{repositorySlug}/pull-requests/{pullRequestId}/comments/{commentId}
  await bitbucketServerHttp.deleteJson(
    `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}/comments/${commentId}?version=${version}`
  );
}

export async function ensureComment({
  number,
  topic,
  content,
}: EnsureCommentConfig): Promise<boolean> {
  const sanitizedContent = sanitize(content);
  try {
    const comments = await getComments(number);
    let body: string;
    let commentId: number | undefined;
    let commentNeedsUpdating: boolean | undefined;
    if (topic) {
      logger.debug(`Ensuring comment "${topic}" in #${number}`);
      body = `### ${topic}\n\n${sanitizedContent}`;
      comments.forEach((comment) => {
        if (comment.text.startsWith(`### ${topic}\n\n`)) {
          commentId = comment.id;
          commentNeedsUpdating = comment.text !== body;
        }
      });
    } else {
      logger.debug(`Ensuring content-only comment in #${number}`);
      body = `${sanitizedContent}`;
      comments.forEach((comment) => {
        if (comment.text === body) {
          commentId = comment.id;
          commentNeedsUpdating = false;
        }
      });
    }
    if (!commentId) {
      await addComment(number, body);
      logger.info(
        { repository: config.repository, prNo: number, topic },
        'Comment added'
      );
    } else if (commentNeedsUpdating) {
      await editComment(number, commentId, body);
      logger.debug(
        { repository: config.repository, prNo: number },
        'Comment updated'
      );
    } else {
      logger.debug('Comment is already update-to-date');
    }
    return true;
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error ensuring comment');
    return false;
  }
}

export async function ensureCommentRemoval(
  deleteConfig: EnsureCommentRemovalConfig
): Promise<void> {
  try {
    const { number: prNo } = deleteConfig;
    const key =
      deleteConfig.type === 'by-topic'
        ? deleteConfig.topic
        : deleteConfig.content;
    logger.debug(`Ensuring comment "${key}" in #${prNo} is removed`);
    const comments = await getComments(prNo);

    let commentId: number | null | undefined = null;
    if (deleteConfig.type === 'by-topic') {
      const byTopic = (comment: Comment): boolean =>
        comment.text.startsWith(`### ${deleteConfig.topic}\n\n`);
      commentId = comments.find(byTopic)?.id;
    } else if (deleteConfig.type === 'by-content') {
      const byContent = (comment: Comment): boolean =>
        comment.text.trim() === deleteConfig.content;
      commentId = comments.find(byContent)?.id;
    }

    if (commentId) {
      await deleteComment(prNo, commentId);
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error ensuring comment removal');
  }
}

// Pull Request

const escapeHash = (input: string): string =>
  input?.replace(regEx(/#/g), '%23');

export async function createPr({
  sourceBranch,
  targetBranch,
  prTitle: title,
  prBody: rawDescription,
  platformOptions,
}: CreatePRConfig): Promise<Pr> {
  const description = sanitize(rawDescription);
  logger.debug(`createPr(${sourceBranch}, title=${title})`);
  const base = targetBranch;
  let reviewers: BbsRestUserRef[] = [];

  /* istanbul ignore else */
  if (platformOptions?.bbUseDefaultReviewers) {
    logger.debug(`fetching default reviewers`);
    const { id } = (
      await bitbucketServerHttp.getJson<{ id: number }>(
        `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}`
      )
    ).body;

    const defReviewers = (
      await bitbucketServerHttp.getJson<{ name: string }[]>(
        `./rest/default-reviewers/1.0/projects/${config.projectKey}/repos/${
          config.repositorySlug
        }/reviewers?sourceRefId=refs/heads/${escapeHash(
          sourceBranch
        )}&targetRefId=refs/heads/${base}&sourceRepoId=${id}&targetRepoId=${id}`
      )
    ).body;

    reviewers = defReviewers.map((u) => ({
      user: { name: u.name },
    }));
  }

  const body: PartialDeep<BbsRestPr> = {
    title,
    description,
    fromRef: {
      id: `refs/heads/${sourceBranch}`,
    },
    toRef: {
      id: `refs/heads/${base}`,
    },
    reviewers,
  };
  let prInfoRes: HttpResponse<BbsRestPr>;
  try {
    prInfoRes = await bitbucketServerHttp.postJson<BbsRestPr>(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests`,
      { body }
    );
  } catch (err) /* istanbul ignore next */ {
    if (
      err.body?.errors?.[0]?.exceptionName ===
      'com.atlassian.bitbucket.pull.EmptyPullRequestException'
    ) {
      logger.debug(
        'Empty pull request - deleting branch so it can be recreated next run'
      );
      await deleteBranch(sourceBranch);
      throw new Error(REPOSITORY_CHANGED);
    }
    throw err;
  }

  const pr: BbsPr = {
    displayNumber: `Pull Request #${prInfoRes.body.id}`,
    ...utils.prInfo(prInfoRes.body),
  };

  // TODO #7154
  updatePrVersion(pr.number, pr.version!);

  // istanbul ignore if
  if (config.prList) {
    config.prList.push(pr);
  }

  return pr;
}

export async function updatePr({
  number: prNo,
  prTitle: title,
  prBody: rawDescription,
  state,
  bitbucketInvalidReviewers,
}: UpdatePrConfig & {
  bitbucketInvalidReviewers: string[] | undefined;
}): Promise<void> {
  const description = sanitize(rawDescription);
  logger.debug(`updatePr(${prNo}, title=${title})`);

  try {
    const pr = await getPr(prNo);
    if (!pr) {
      throw Object.assign(new Error(REPOSITORY_NOT_FOUND), { statusCode: 404 });
    }

    const { body: updatedPr } = await bitbucketServerHttp.putJson<{
      version: number;
      state: string;
    }>(
      `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${prNo}`,
      {
        body: {
          title,
          description,
          version: pr.version,
          reviewers: pr.reviewers
            ?.filter(
              (name: string) => !bitbucketInvalidReviewers?.includes(name)
            )
            .map((name: string) => ({ user: { name } })),
        },
      }
    );

    updatePrVersion(prNo, updatedPr.version);

    const currentState = updatedPr.state;
    // TODO #7154
    const newState = {
      [PrState.Open]: 'OPEN',
      [PrState.Closed]: 'DECLINED',
    }[state!];

    if (
      newState &&
      ['OPEN', 'DECLINED'].includes(currentState) &&
      currentState !== newState
    ) {
      const command = state === PrState.Open ? 'reopen' : 'decline';
      const { body: updatedStatePr } = await bitbucketServerHttp.postJson<{
        version: number;
      }>(
        `./rest/api/1.0/projects/${config.projectKey}/repos/${config.repositorySlug}/pull-requests/${pr.number}/${command}?version=${updatedPr.version}`
      );

      updatePrVersion(pr.number, updatedStatePr.version);
    }
  } catch (err) {
    logger.debug({ err, prNo }, `Failed to update PR`);
    if (err.statusCode === 404) {
      throw new Error(REPOSITORY_NOT_FOUND);
    } else if (err.statusCode === 409) {
      if (utils.isInvalidReviewersResponse(err) && !bitbucketInvalidReviewers) {
        // Retry again with invalid reviewers being removed
        const invalidReviewers = utils.getInvalidReviewers(err);
        await updatePr({
          number: prNo,
          prTitle: title,
          prBody: rawDescription,
          state,
          bitbucketInvalidReviewers: invalidReviewers,
        });
      } else {
        throw new Error(REPOSITORY_CHANGED);
      }
    } else {
      throw err;
    }
  }
}

// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-rest.html#idp261
export async function mergePr({
  branchName,
  id: prNo,
}: MergePRConfig): Promise<boolean> {
  logger.debug(`mergePr(${prNo}, ${branchName!})`);
  // Used for "automerge" feature
  try {
    const pr = await getPr(prNo);
    if (!pr) {
      throw Object.assign(new Error(REPOSITORY_NOT_FOUND), { statusCode: 404 });
    }
    const { body } = await bitbucketServerHttp.postJson<{ version: number }>(
      // TODO: types (#7154)
      `./rest/api/1.0/projects/${config.projectKey}/repos/${
        config.repositorySlug
      }/pull-requests/${prNo}/merge?version=${pr.version!}`
    );
    updatePrVersion(prNo, body.version);
  } catch (err) {
    if (err.statusCode === 404) {
      throw new Error(REPOSITORY_NOT_FOUND);
    } else if (err.statusCode === 409) {
      logger.warn({ err }, `Failed to merge PR`);
      return false;
    } else {
      logger.warn({ err }, `Failed to merge PR`);
      return false;
    }
  }

  logger.debug({ pr: prNo }, 'PR merged');
  return true;
}

export function massageMarkdown(input: string): string {
  logger.debug(`massageMarkdown(${input.split(newlineRegex)[0]})`);
  // Remove any HTML we use
  return smartTruncate(input, 30000)
    .replace(
      'you tick the rebase/retry checkbox',
      'rename PR to start with "rebase!"'
    )
    .replace(regEx(/<\/?summary>/g), '**')
    .replace(regEx(/<\/?details>/g), '')
    .replace(regEx(`\n---\n\n.*?<!-- rebase-check -->.*?(\n|$)`), '')
    .replace(regEx('<!--.*?-->', 'g'), '');
}

export function getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]> {
  logger.debug(`getVulnerabilityAlerts()`);
  return Promise.resolve([]);
}
