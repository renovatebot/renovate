import URL from 'url';
import is from '@sindresorhus/is';
import JSON5 from 'json5';
import { PlatformId } from '../../../constants';
import { REPOSITORY_NOT_FOUND } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { BranchStatus, PrState, VulnerabilityAlert } from '../../../types';
import * as git from '../../../util/git';
import * as hostRules from '../../../util/host-rules';
import { BitbucketHttp, setBaseUrl } from '../../../util/http/bitbucket';
import type { HttpOptions } from '../../../util/http/types';
import { regEx } from '../../../util/regex';
import { sanitize } from '../../../util/sanitize';
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
import { readOnlyIssueBody } from '../utils/read-only-issue-body';
import * as comments from './comments';
import * as utils from './utils';
import {
  Account,
  PrResponse,
  RepoInfoBody,
  mergeBodyTransformer,
} from './utils';

const bitbucketHttp = new BitbucketHttp();

const BITBUCKET_PROD_ENDPOINT = 'https://api.bitbucket.org/';

let config: utils.Config = {} as any;

const defaults = { endpoint: BITBUCKET_PROD_ENDPOINT };

const pathSeparator = '/';

let renovateUserUuid: string | null = null;

export async function initPlatform({
  endpoint,
  username,
  password,
  token,
}: PlatformParams): Promise<PlatformResult> {
  if (!(username && password) && !token) {
    throw new Error(
      'Init: You must configure either a Bitbucket token or username and password'
    );
  }
  if (endpoint && endpoint !== BITBUCKET_PROD_ENDPOINT) {
    logger.warn(
      `Init: Bitbucket Cloud endpoint should generally be ${BITBUCKET_PROD_ENDPOINT} but is being configured to a different value. Did you mean to use Bitbucket Server?`
    );
    defaults.endpoint = endpoint;
  }
  setBaseUrl(defaults.endpoint);
  renovateUserUuid = null;
  const options: HttpOptions = {
    useCache: false,
  };
  if (token) {
    options.token = token;
  } else {
    options.username = username;
    options.password = password;
  }
  try {
    const { uuid } = (
      await bitbucketHttp.getJson<Account>('/2.0/user', options)
    ).body;
    renovateUserUuid = uuid;
  } catch (err) {
    if (
      err.statusCode === 403 &&
      err.body?.error?.detail?.required?.includes('account')
    ) {
      logger.warn(`Bitbucket: missing 'account' scope for password`);
    } else {
      logger.debug({ err }, 'Unknown error fetching Bitbucket user identity');
    }
  }
  // TODO: Add a connection check that endpoint/username/password combination are valid (#9594)
  const platformConfig: PlatformResult = {
    endpoint: endpoint ?? BITBUCKET_PROD_ENDPOINT,
  };
  return Promise.resolve(platformConfig);
}

// Get all repositories that the user has access to
export async function getRepos(): Promise<string[]> {
  logger.debug('Autodiscovering Bitbucket Cloud repositories');
  try {
    const repos = await utils.accumulateValues<{ full_name: string }>(
      `/2.0/repositories/?role=contributor`
    );
    return repos.map((repo) => repo.full_name);
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
  // See: https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Bworkspace%7D/%7Brepo_slug%7D/src/%7Bcommit%7D/%7Bpath%7D
  const repo = repoName ?? config.repository;
  const path = fileName;

  let finalBranchOrTag = branchOrTag;
  if (branchOrTag?.includes(pathSeparator)) {
    // Branch name contans slash, so we have to replace branch name with SHA1 of the head commit; otherwise the API will not work.
    finalBranchOrTag = await getBranchCommit(branchOrTag);
  }

  const url =
    `/2.0/repositories/${repo}/src/` +
    (finalBranchOrTag ?? `HEAD`) +
    `/${path}`;
  const res = await bitbucketHttp.get(url);
  return res.body;
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

// Initialize bitbucket by getting base branch and SHA
export async function initRepo({
  repository,
  cloneSubmodules,
  ignorePrAuthor,
}: RepoParams): Promise<RepoResult> {
  logger.debug(`initRepo("${repository}")`);
  const opts = hostRules.find({
    hostType: PlatformId.Bitbucket,
    url: defaults.endpoint,
  });
  config = {
    repository,
    username: opts.username,
    ignorePrAuthor,
  } as utils.Config;
  let info: utils.RepoInfo;
  try {
    info = utils.repoInfoTransformer(
      (
        await bitbucketHttp.getJson<RepoInfoBody>(
          `/2.0/repositories/${repository}`
        )
      ).body
    );
    config.defaultBranch = info.mainbranch;

    config = {
      ...config,
      owner: info.owner,
      mergeMethod: info.mergeMethod,
      has_issues: info.has_issues,
    };

    logger.debug(`${repository} owner = ${config.owner}`);
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      throw new Error(REPOSITORY_NOT_FOUND);
    }
    logger.debug({ err }, 'Unknown Bitbucket initRepo error');
    throw err;
  }

  const { hostname } = URL.parse(defaults.endpoint);

  // Converts API hostnames to their respective HTTP git hosts:
  // `api.bitbucket.org`  to `bitbucket.org`
  // `api-staging.<host>` to `staging.<host>`
  // TODO #7154
  const hostnameWithoutApiPrefix = regEx(/api[.|-](.+)/).exec(hostname!)?.[1];

  const auth = opts.token
    ? `x-token-auth:${opts.token}`
    : `${opts.username!}:${opts.password!}`;
  const url = git.getUrl({
    protocol: 'https',
    auth,
    hostname: hostnameWithoutApiPrefix,
    repository,
  });

  await git.initRepo({
    ...config,
    url,
    cloneSubmodules,
  });
  const repoConfig: RepoResult = {
    defaultBranch: info.mainbranch,
    isFork: info.isFork,
    repoFingerprint: repoFingerprint(info.uuid, defaults.endpoint),
  };
  return repoConfig;
}

// Returns true if repository has rule enforcing PRs are up-to-date with base branch before merging
export function getRepoForceRebase(): Promise<boolean> {
  // BB doesn't have an option to flag staled branches
  return Promise.resolve(false);
}

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

export async function getPrList(): Promise<Pr[]> {
  logger.debug('getPrList()');
  if (!config.prList) {
    logger.debug('Retrieving PR list');
    let url = `/2.0/repositories/${config.repository}/pullrequests?`;
    url += utils.prStates.all.map((state) => 'state=' + state).join('&');
    if (renovateUserUuid && !config.ignorePrAuthor) {
      url += `&q=author.uuid="${renovateUserUuid}"`;
    }
    const prs = await utils.accumulateValues(url, undefined, undefined, 50);
    config.prList = prs.map(utils.prInfo);
    logger.debug({ length: config.prList.length }, 'Retrieved Pull Requests');
  }
  return config.prList;
}

export async function findPr({
  branchName,
  prTitle,
  state = PrState.All,
}: FindPRConfig): Promise<Pr | null> {
  // TODO: types (#7154)
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  logger.debug(`findPr(${branchName}, ${prTitle}, ${state})`);
  const prList = await getPrList();
  const pr = prList.find(
    (p) =>
      p.sourceBranch === branchName &&
      (!prTitle || p.title === prTitle) &&
      matchesState(p.state, state)
  );
  if (pr) {
    logger.debug(`Found PR #${pr.number}`);
  }
  return pr ?? null;
}

// Gets details for a PR
export async function getPr(prNo: number): Promise<Pr | null> {
  const pr = (
    await bitbucketHttp.getJson<PrResponse>(
      `/2.0/repositories/${config.repository}/pullrequests/${prNo}`
    )
  ).body;

  // istanbul ignore if
  if (!pr) {
    return null;
  }

  const res: any = {
    displayNumber: `Pull Request #${pr.id}`,
    ...utils.prInfo(pr),
  };

  res.hasReviewers = is.nonEmptyArray(pr.reviewers);

  return res;
}

const escapeHash = (input: string): string =>
  input ? input.replace(regEx(/#/g), '%23') : input;

interface BranchResponse {
  target: {
    hash: string;
  };
}

// Return the commit SHA for a branch
async function getBranchCommit(
  branchName: string
): Promise<string | undefined> {
  try {
    const branch = (
      await bitbucketHttp.getJson<BranchResponse>(
        `/2.0/repositories/${config.repository}/refs/branches/${escapeHash(
          branchName
        )}`
      )
    ).body;
    return branch.target.hash;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, `getBranchCommit('${branchName}') failed'`);
    return undefined;
  }
}

// Returns the Pull Request for a branch. Null if not exists.
export async function getBranchPr(branchName: string): Promise<Pr | null> {
  logger.debug(`getBranchPr(${branchName})`);
  const existingPr = await findPr({
    branchName,
    state: PrState.Open,
  });
  return existingPr ? getPr(existingPr.number) : null;
}

async function getStatus(
  branchName: string,
  useCache = true
): Promise<utils.BitbucketStatus[]> {
  const sha = await getBranchCommit(branchName);
  return utils.accumulateValues<utils.BitbucketStatus>(
    // TODO: types (#7154)
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `/2.0/repositories/${config.repository}/commit/${sha}/statuses`,
    'get',
    { useCache }
  );
}
// Returns the combined status for a branch.
export async function getBranchStatus(
  branchName: string
): Promise<BranchStatus> {
  logger.debug(`getBranchStatus(${branchName})`);
  const statuses = await getStatus(branchName);
  logger.debug({ branch: branchName, statuses }, 'branch status check result');
  if (!statuses.length) {
    logger.debug('empty branch status check result = returning "pending"');
    return BranchStatus.yellow;
  }
  const noOfFailures = statuses.filter(
    (status: { state: string }) =>
      status.state === 'FAILED' || status.state === 'STOPPED'
  ).length;
  if (noOfFailures) {
    return BranchStatus.red;
  }
  const noOfPending = statuses.filter(
    (status: { state: string }) => status.state === 'INPROGRESS'
  ).length;
  if (noOfPending) {
    return BranchStatus.yellow;
  }
  return BranchStatus.green;
}

const bbToRenovateStatusMapping: Record<string, BranchStatus> = {
  SUCCESSFUL: BranchStatus.green,
  INPROGRESS: BranchStatus.yellow,
  FAILED: BranchStatus.red,
};

export async function getBranchStatusCheck(
  branchName: string,
  context: string
): Promise<BranchStatus | null> {
  const statuses = await getStatus(branchName);
  const bbState = statuses.find((status) => status.key === context)?.state;
  // TODO #7154
  return bbToRenovateStatusMapping[bbState!] || null;
}

export async function setBranchStatus({
  branchName,
  context,
  description,
  state,
  url: targetUrl,
}: BranchStatusConfig): Promise<void> {
  const sha = await getBranchCommit(branchName);

  // TargetUrl can not be empty so default to bitbucket
  const url = targetUrl ?? /* istanbul ignore next */ 'https://bitbucket.org';

  const body = {
    name: context,
    state: utils.buildStates[state],
    key: context,
    description,
    url,
  };

  await bitbucketHttp.postJson(
    // TODO: types (#7154)
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `/2.0/repositories/${config.repository}/commit/${sha}/statuses/build`,
    { body }
  );
  // update status cache
  await getStatus(branchName, false);
}

type BbIssue = { id: number; title: string; content?: { raw: string } };

async function findOpenIssues(title: string): Promise<BbIssue[]> {
  try {
    const filter = encodeURIComponent(
      [
        `title=${JSON.stringify(title)}`,
        '(state = "new" OR state = "open")',
        `reporter.username="${config.username}"`,
      ].join(' AND ')
    );
    return (
      (
        await bitbucketHttp.getJson<{ values: BbIssue[] }>(
          `/2.0/repositories/${config.repository}/issues?q=${filter}`
        )
      ).body.values || /* istanbul ignore next */ []
    );
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error finding issues');
    return [];
  }
}

export async function findIssue(title: string): Promise<Issue | null> {
  logger.debug(`findIssue(${title})`);

  /* istanbul ignore if */
  if (!config.has_issues) {
    logger.debug('Issues are disabled - cannot findIssue');
    return null;
  }
  const issues = await findOpenIssues(title);
  if (!issues.length) {
    return null;
  }
  const [issue] = issues;
  return {
    number: issue.id,
    body: issue.content?.raw,
  };
}

async function closeIssue(issueNumber: number): Promise<void> {
  await bitbucketHttp.putJson(
    `/2.0/repositories/${config.repository}/issues/${issueNumber}`,
    {
      body: { state: 'closed' },
    }
  );
}

export function massageMarkdown(input: string): string {
  // Remove any HTML we use
  return smartTruncate(input, 50000)
    .replace(
      'you tick the rebase/retry checkbox',
      'rename PR to start with "rebase!"'
    )
    .replace(regEx(/<\/?summary>/g), '**')
    .replace(regEx(/<\/?details>/g), '')
    .replace(regEx(`\n---\n\n.*?<!-- rebase-check -->.*?\n`), '')
    .replace(regEx(/\]\(\.\.\/pull\//g), '](../../pull-requests/')
    .replace(regEx(/<!--renovate-debug:.*?-->/), '');
}

export async function ensureIssue({
  title,
  reuseTitle,
  body,
}: EnsureIssueConfig): Promise<EnsureIssueResult | null> {
  logger.debug(`ensureIssue()`);
  const description = massageMarkdown(sanitize(body));

  /* istanbul ignore if */
  if (!config.has_issues) {
    logger.warn('Issues are disabled - cannot ensureIssue');
    logger.debug({ title }, 'Failed to ensure Issue');
    return null;
  }
  try {
    let issues = await findOpenIssues(title);
    if (!issues.length && reuseTitle) {
      issues = await findOpenIssues(reuseTitle);
    }
    if (issues.length) {
      // Close any duplicates
      for (const issue of issues.slice(1)) {
        await closeIssue(issue.id);
      }
      const [issue] = issues;
      if (
        issue.title !== title ||
        String(issue.content?.raw).trim() !== description.trim()
      ) {
        logger.debug('Issue updated');
        await bitbucketHttp.putJson(
          `/2.0/repositories/${config.repository}/issues/${issue.id}`,
          {
            body: {
              content: {
                raw: readOnlyIssueBody(description),
                markup: 'markdown',
              },
            },
          }
        );
        return 'updated';
      }
    } else {
      logger.info('Issue created');
      await bitbucketHttp.postJson(
        `/2.0/repositories/${config.repository}/issues`,
        {
          body: {
            title,
            content: {
              raw: readOnlyIssueBody(description),
              markup: 'markdown',
            },
          },
        }
      );
      return 'created';
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.message.startsWith('Repository has no issue tracker.')) {
      logger.debug(`Issues are disabled, so could not create issue: ${title}`);
    } else {
      logger.warn({ err }, 'Could not ensure issue');
    }
  }
  return null;
}

/* istanbul ignore next */
export async function getIssueList(): Promise<Issue[]> {
  logger.debug(`getIssueList()`);

  if (!config.has_issues) {
    logger.debug('Issues are disabled - cannot getIssueList');
    return [];
  }
  try {
    const filter = encodeURIComponent(
      [
        '(state = "new" OR state = "open")',
        `reporter.username="${config.username}"`,
      ].join(' AND ')
    );
    return (
      (
        await bitbucketHttp.getJson<{ values: Issue[] }>(
          `/2.0/repositories/${config.repository}/issues?q=${filter}`
        )
      ).body.values || []
    );
  } catch (err) {
    logger.warn({ err }, 'Error finding issues');
    return [];
  }
}

export async function ensureIssueClosing(title: string): Promise<void> {
  /* istanbul ignore if */
  if (!config.has_issues) {
    logger.debug('Issues are disabled - cannot ensureIssueClosing');
    return;
  }
  const issues = await findOpenIssues(title);
  for (const issue of issues) {
    await closeIssue(issue.id);
  }
}

export function addAssignees(
  _prNr: number,
  _assignees: string[]
): Promise<void> {
  // Bitbucket supports "participants" and "reviewers" so does not seem to have the concept of "assignee"
  logger.warn('Cannot add assignees');
  return Promise.resolve();
}

export async function addReviewers(
  prId: number,
  reviewers: string[]
): Promise<void> {
  logger.debug(`Adding reviewers '${reviewers.join(', ')}' to #${prId}`);

  // TODO #7154
  const { title } = (await getPr(prId))!;

  const body = {
    title,
    reviewers: reviewers.map((username: string) => ({ username })),
  };

  await bitbucketHttp.putJson(
    `/2.0/repositories/${config.repository}/pullrequests/${prId}`,
    {
      body,
    }
  );
}

/* istanbul ignore next */
export function deleteLabel(): never {
  throw new Error('deleteLabel not implemented');
}

export function ensureComment({
  number,
  topic,
  content,
}: EnsureCommentConfig): Promise<boolean> {
  // https://developer.atlassian.com/bitbucket/api/2/reference/search?q=pullrequest+comment
  return comments.ensureComment({
    config,
    number,
    topic,
    content: sanitize(content),
  });
}

export function ensureCommentRemoval(
  deleteConfig: EnsureCommentRemovalConfig
): Promise<void> {
  return comments.ensureCommentRemoval(config, deleteConfig);
}

async function sanitizeReviewers(
  reviewers: Account[],
  err: any
): Promise<Account[] | undefined> {
  if (err.statusCode === 400 && err.body?.error?.fields?.reviewers) {
    const sanitizedReviewers: Account[] = [];

    for (const msg of err.body.error.fields.reviewers) {
      // Bitbucket returns a 400 if any of the PR reviewer accounts are now inactive (ie: disabled/suspended)
      if (msg === 'Malformed reviewers list') {
        logger.debug(
          { err },
          'PR contains inactive reviewer accounts. Will try setting only active reviewers'
        );

        // Validate that each previous PR reviewer account is still active
        for (const reviewer of reviewers) {
          const reviewerUser = (
            await bitbucketHttp.getJson<Account>(`/2.0/users/${reviewer.uuid}`)
          ).body;

          if (reviewerUser.account_status === 'active') {
            sanitizedReviewers.push(reviewer);
          }
        }

        // Bitbucket returns a 400 if any of the PR reviewer accounts are no longer members of this workspace
      } else if (
        msg.endsWith(
          'is not a member of this workspace and cannot be added to this pull request'
        )
      ) {
        logger.debug(
          { err },
          'PR contains reviewer accounts which are no longer member of this workspace. Will try setting only member reviewers'
        );

        const workspace = config.repository.split('/')[0];

        // Validate that each previous PR reviewer account is still a member of this workspace
        for (const reviewer of reviewers) {
          try {
            await bitbucketHttp.get(
              `/2.0/workspaces/${workspace}/members/${reviewer.uuid}`
            );

            sanitizedReviewers.push(reviewer);
          } catch (err) {
            // HTTP 404: User cannot be found, or the user is not a member of this workspace.
            if (err.response?.statusCode !== 404) {
              throw err;
            }
          }
        }
      } else {
        return undefined;
      }
    }

    return sanitizedReviewers;
  }

  return undefined;
}

// Creates PR and returns PR number
export async function createPr({
  sourceBranch,
  targetBranch,
  prTitle: title,
  prBody: description,
  platformOptions,
}: CreatePRConfig): Promise<Pr> {
  // labels is not supported in Bitbucket: https://bitbucket.org/site/master/issues/11976/ability-to-add-labels-to-pull-requests-bb

  const base = targetBranch;

  logger.debug({ repository: config.repository, title, base }, 'Creating PR');

  let reviewers: Account[] = [];

  if (platformOptions?.bbUseDefaultReviewers) {
    const reviewersResponse = (
      await bitbucketHttp.getJson<utils.PagedResult<Account>>(
        `/2.0/repositories/${config.repository}/default-reviewers`
      )
    ).body;
    reviewers = reviewersResponse.values.map((reviewer: Account) => ({
      uuid: reviewer.uuid,
    }));
  }

  const body = {
    title,
    description: sanitize(description),
    source: {
      branch: {
        name: sourceBranch,
      },
    },
    destination: {
      branch: {
        name: base,
      },
    },
    close_source_branch: true,
    reviewers,
  };

  try {
    const prRes = (
      await bitbucketHttp.postJson<PrResponse>(
        `/2.0/repositories/${config.repository}/pullrequests`,
        {
          body,
        }
      )
    ).body;
    const pr = utils.prInfo(prRes);
    // istanbul ignore if
    if (config.prList) {
      config.prList.push(pr);
    }
    return pr;
  } catch (err) /* istanbul ignore next */ {
    // Try sanitizing reviewers
    const sanitizedReviewers = await sanitizeReviewers(reviewers, err);

    if (sanitizedReviewers === undefined) {
      logger.warn({ err }, 'Error creating pull request');
      throw err;
    } else {
      const prRes = (
        await bitbucketHttp.postJson<PrResponse>(
          `/2.0/repositories/${config.repository}/pullrequests`,
          {
            body: {
              ...body,
              reviewers: sanitizedReviewers,
            },
          }
        )
      ).body;
      const pr = utils.prInfo(prRes);
      // istanbul ignore if
      if (config.prList) {
        config.prList.push(pr);
      }
      return pr;
    }
  }
}

export async function updatePr({
  number: prNo,
  prTitle: title,
  prBody: description,
  state,
}: UpdatePrConfig): Promise<void> {
  logger.debug(`updatePr(${prNo}, ${title}, body)`);
  // Updating a PR in Bitbucket will clear the reviewers if reviewers is not present
  const pr = (
    await bitbucketHttp.getJson<PrResponse>(
      `/2.0/repositories/${config.repository}/pullrequests/${prNo}`
    )
  ).body;

  try {
    await bitbucketHttp.putJson(
      `/2.0/repositories/${config.repository}/pullrequests/${prNo}`,
      {
        body: {
          title,
          description: sanitize(description),
          reviewers: pr.reviewers,
        },
      }
    );
  } catch (err) {
    // Try sanitizing reviewers
    const sanitizedReviewers = await sanitizeReviewers(pr.reviewers, err);

    if (sanitizedReviewers === undefined) {
      throw err;
    } else {
      await bitbucketHttp.putJson(
        `/2.0/repositories/${config.repository}/pullrequests/${prNo}`,
        {
          body: {
            title,
            description: sanitize(description),
            reviewers: sanitizedReviewers,
          },
        }
      );
    }
  }

  if (state === PrState.Closed && pr) {
    await bitbucketHttp.postJson(
      `/2.0/repositories/${config.repository}/pullrequests/${prNo}/decline`
    );
  }
}

export async function mergePr({
  branchName,
  id: prNo,
  strategy: mergeStrategy,
}: MergePRConfig): Promise<boolean> {
  // TODO: types (#7154)
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  logger.debug(`mergePr(${prNo}, ${branchName}, ${mergeStrategy})`);

  // Bitbucket Cloud does not support a rebase-alike; https://jira.atlassian.com/browse/BCLOUD-16610
  if (mergeStrategy === 'rebase') {
    logger.warn('Bitbucket Cloud does not support a "rebase" strategy.');
    return false;
  }

  try {
    await bitbucketHttp.postJson(
      `/2.0/repositories/${config.repository}/pullrequests/${prNo}/merge`,
      {
        body: mergeBodyTransformer(mergeStrategy),
      }
    );
    logger.debug('Automerging succeeded');
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, `PR merge error`);
    logger.info({ pr: prNo }, 'PR automerge failed');
    return false;
  }
  return true;
}

export function getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]> {
  return Promise.resolve([]);
}
