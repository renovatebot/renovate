import { ConfigFileAuthenticationDetailsProvider } from 'oci-common';
import { GlobalConfig } from '../../../config/global.ts';
import {
  REPOSITORY_ACCESS_FORBIDDEN,
  REPOSITORY_EMPTY,
  REPOSITORY_MIRRORED,
  REPOSITORY_NOT_FOUND,
} from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import type { BranchStatus, HostRule } from '../../../types/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { parseJson } from '../../../util/common.ts';
import { getEnv } from '../../../util/env.ts';
import * as git from '../../../util/git/index.ts';
import { getRemoteUrlWithToken } from '../../../util/git/url.ts';
import { toSha256 } from '../../../util/hash.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { regEx } from '../../../util/regex.ts';
import { sanitize } from '../../../util/sanitize.ts';
import { ensureTrailingSlash, parseUrl } from '../../../util/url.ts';
import { getPrBodyStruct } from '../pr-body.ts';
import type {
  AutodiscoverConfig,
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
  RepoParams,
  RepoResult,
  UpdatePrConfig,
} from '../types.ts';
import { repoFingerprint } from '../util.ts';
import { smartTruncate } from '../utils/pr-body.ts';
import { OciClient } from './client.ts';
import type {
  OciComment,
  OciPr,
  OciPullRequest,
  OciRepository,
} from './types.ts';

export const id = 'oci';
export const experimental = true;

let client: OciClient;
let userId: string;
let gitCredentials: Pick<HostRule, 'username' | 'password'>;
let repositoryId: string;
let prList: OciPr[] | undefined;
let prIds = new Map<number, string>();

export function initPlatform({
  endpoint,
  username,
  password,
}: PlatformParams): Promise<PlatformResult> {
  const env = getEnv();
  const provider = new ConfigFileAuthenticationDetailsProvider(
    env.OCI_CONFIG_FILE,
    env.OCI_CONFIG_PROFILE,
  );
  const region = provider.getRegion();
  const apiEndpoint = parseUrl(
    endpoint ??
      `https://devops.${region.regionId}.oci.${region.realm.secondLevelDomain}/`,
  );
  if (
    apiEndpoint?.protocol !== 'https:' ||
    apiEndpoint.username ||
    apiEndpoint.password ||
    apiEndpoint.search ||
    apiEndpoint.hash
  ) {
    throw new Error('Init: OCI endpoint must be an HTTPS API URL');
  }
  const baseUrl = ensureTrailingSlash(apiEndpoint.href);
  const apiUrl = baseUrl.endsWith('/20210630/')
    ? baseUrl
    : `${baseUrl}20210630/`;
  client = new OciClient(apiUrl, provider);
  userId = provider.getUser();
  gitCredentials = { username, password };
  prList = undefined;
  prIds = new Map();
  return Promise.resolve({ endpoint: apiUrl });
}

function normalizeBranch(branch: string): string {
  return branch.replace(regEx(/^refs\/heads\//), '');
}

export async function initRepo({
  repository,
  gitUrl,
  cloneSubmodules,
  cloneSubmodulesFilter,
  forkToken,
  forkOrg,
}: RepoParams): Promise<RepoResult> {
  // Reset repository-specific state before making any requests.
  repositoryId = repository;
  prList = undefined;
  prIds = new Map();
  if (forkToken || forkOrg) {
    throw new Error('OCI fork creation is not supported');
  }
  const response = await client.get<OciRepository>(
    `repositories/${encodeURIComponent(repository)}`,
    { throwHttpErrors: false },
  );
  if (response.statusCode === 404) {
    throw new Error(REPOSITORY_NOT_FOUND);
  }
  if (response.statusCode === 403) {
    throw new Error(REPOSITORY_ACCESS_FORBIDDEN);
  }
  if (response.statusCode !== 200) {
    throw new Error(`OCI repository lookup failed (${response.statusCode})`);
  }
  const repo = response.body;
  if (!repo.defaultBranch) {
    throw new Error(REPOSITORY_EMPTY);
  }
  if (repo.repositoryType === 'MIRRORED') {
    throw new Error(REPOSITORY_MIRRORED);
  }
  const cloneUrl = gitUrl === 'ssh' ? repo.sshUrl : repo.httpUrl;
  if (!cloneUrl) {
    throw new Error('OCI repository clone URL is unavailable');
  }
  if (gitUrl !== 'ssh' && gitCredentials.username && gitCredentials.password) {
    hostRules.add({
      hostType: id,
      matchHost: parseUrl(cloneUrl)!.host,
      ...gitCredentials,
    });
  }
  const url = gitUrl === 'ssh' ? cloneUrl : getRemoteUrlWithToken(cloneUrl, id);
  const defaultBranch = normalizeBranch(repo.defaultBranch);
  await git.initRepo({
    url,
    defaultBranch,
    cloneSubmodules,
    cloneSubmodulesFilter,
  });
  // OCI repository statistics can lag behind Git pushes.
  if (!git.getBranchCommit(defaultBranch)) {
    throw new Error(REPOSITORY_EMPTY);
  }
  return {
    defaultBranch,
    isFork: repo.repositoryType === 'FORKED',
    repoFingerprint: repoFingerprint(repo.id, client.endpoint),
  };
}

export async function getRepos({ projects }: AutodiscoverConfig = {}): Promise<
  string[]
> {
  const compartmentId = getEnv().OCI_COMPARTMENT_ID;
  const queries: Record<string, string>[] = projects?.length
    ? projects.map((projectId) => ({ projectId }))
    : [];
  if (!projects?.length && !compartmentId) {
    throw new Error(
      'OCI autodiscovery requires autodiscoverProjects (project OCIDs) or OCI_COMPARTMENT_ID',
    );
  }
  if (!queries.length) {
    queries.push({ compartmentId: compartmentId! });
  }
  const repos: string[] = [];
  for (const query of queries) {
    const items = await client.list<OciRepository>('repositories', {
      ...query,
      lifecycleState: 'ACTIVE',
    });
    repos.push(
      ...items
        .filter((repo) => repo.repositoryType !== 'MIRRORED')
        .map((repo) => repo.id),
    );
  }
  return [...new Set(repos)];
}

function toPr(pr: OciPullRequest): OciPr {
  // OCI exposes only OCIDs. Use a stable 52-bit identifier for Renovate's numeric API.
  const number = Number.parseInt(toSha256(pr.id).slice(0, 13), 16);
  const existing = prIds.get(number);
  if (existing && existing !== pr.id) {
    throw new Error('OCI pull request identifier collision');
  }
  prIds.set(number, pr.id);
  let state = 'open';
  if (pr.lifecycleDetails === 'MERGED') {
    state = 'merged';
  } else if (pr.lifecycleDetails === 'CLOSED') {
    state = 'closed';
  }
  return {
    id: pr.id,
    authorId: pr.createdBy.principalId,
    number,
    title: pr.displayName,
    body: pr.description ?? '',
    bodyStruct: getPrBodyStruct(pr.description),
    sourceBranch: normalizeBranch(pr.sourceBranch),
    targetBranch: normalizeBranch(pr.destinationBranch),
    sourceRepo: pr.sourceRepositoryId ?? repositoryId,
    state,
    createdAt: pr.timeCreated,
    isDraft: false,
    reviewers: pr.reviewers?.map((reviewer) => reviewer.principalId),
    cannotMergeReason:
      pr.lifecycleDetails === 'CONFLICT' ? 'Merge conflicts' : undefined,
  };
}

function isSameRepositoryPr(pr: OciPullRequest): boolean {
  return (pr.sourceRepositoryId ?? repositoryId) === repositoryId;
}

export async function getPrList(): Promise<OciPr[]> {
  if (!prList) {
    const query: Record<string, string> = { repositoryId };
    if (!GlobalConfig.get('ignorePrAuthor')) {
      query.createdBy = userId;
    }
    const items = await client.list<OciPullRequest>('pullRequests', query);
    const prs = new Map<number, OciPr>();
    for (const item of items.filter(isSameRepositoryPr)) {
      const pr = toPr(item);
      prs.set(pr.number, pr);
    }
    prList = [...prs.values()];
  }
  return prList;
}

async function getPrId(number: number): Promise<string | null> {
  if (!prIds.has(number)) {
    await getPrList();
  }
  return prIds.get(number) ?? null;
}

async function prPath(number: number): Promise<string> {
  const prId = await getPrId(number);
  if (!prId) {
    throw new Error(`OCI pull request not found: ${number}`);
  }
  return `pullRequests/${encodeURIComponent(prId)}`;
}

export async function getPr(number: number): Promise<OciPr | null> {
  const prId = await getPrId(number);
  if (!prId) {
    return null;
  }
  const response = await client.get<OciPullRequest>(
    `pullRequests/${encodeURIComponent(prId)}`,
    { throwHttpErrors: false },
  );
  if (response.statusCode === 404) {
    prList = (await getPrList()).filter((item) => item.number !== number);
    prIds.delete(number);
    return null;
  }
  if (response.statusCode !== 200) {
    throw new Error(`OCI pull request lookup failed (${response.statusCode})`);
  }
  const pr = toPr(response.body);
  prList = (await getPrList()).map((item) =>
    item.number === number ? pr : item,
  );
  return pr;
}

export async function findPr({
  branchName,
  prTitle,
  state = 'all',
  targetBranch,
  refreshCache,
  includeOtherAuthors,
}: FindPRConfig): Promise<OciPr | null> {
  if (refreshCache) {
    prList = undefined;
  }
  let prs: OciPr[];
  if (includeOtherAuthors) {
    prs = (await client.list<OciPullRequest>('pullRequests', { repositoryId }))
      .filter(isSameRepositoryPr)
      .map(toPr);
  } else {
    prs = await getPrList();
  }
  return (
    prs.find((pr) => {
      const titleMatches = !prTitle || pr.title === prTitle;
      const targetBranchMatches =
        !targetBranch || pr.targetBranch === targetBranch;
      const stateMatches =
        state === 'all' ||
        (state === '!open' ? pr.state !== 'open' : pr.state === state);
      return (
        pr.sourceBranch === branchName &&
        titleMatches &&
        targetBranchMatches &&
        stateMatches
      );
    }) ?? null
  );
}

export async function getBranchPr(branchName: string): Promise<OciPr | null> {
  const pr = await findPr({ branchName, state: 'open' });
  return pr ? getPr(pr.number) : null;
}

function prepareBody(body: string): string {
  const sanitized = sanitize(body);
  const truncated =
    sanitized.length > maxBodyLength()
      ? smartTruncate(sanitized, maxBodyLength())
      : sanitized;
  // Truncation can insert a closing details tag.
  return truncated
    .replace(regEx(/<\/?summary>/g), '**')
    .replace(regEx(/<\/?details>/g), '');
}

export async function createPr({
  sourceBranch,
  targetBranch,
  prTitle,
  prBody,
  draftPR,
  labels,
}: CreatePRConfig): Promise<OciPr> {
  if (draftPR) {
    throw new Error('OCI does not support draft pull requests');
  }
  warnLabels(labels);
  const response = await client.post<OciPullRequest>('pullRequests', {
    repositoryId,
    displayName: prTitle,
    description: prepareBody(prBody),
    sourceBranch,
    destinationBranch: targetBranch,
  });
  const pr = toPr(response.body);
  // Invalidate instead of keeping a partial list when the cache was not loaded.
  prList = undefined;
  return pr;
}

export async function updatePr({
  number,
  prTitle,
  prBody,
  targetBranch,
  state,
  labels,
  addLabels,
  removeLabels,
}: UpdatePrConfig): Promise<void> {
  const path = await prPath(number);
  const pr = await getPr(number);
  if (!pr) {
    return;
  }
  if (pr.state === 'merged') {
    throw new Error('Cannot update a merged OCI pull request');
  }
  if (pr.state === 'closed' && state === 'closed') {
    return;
  }
  if (pr.state === 'closed' && state !== 'open') {
    throw new Error('Reopen the OCI pull request before updating its metadata');
  }
  warnLabels(labels, addLabels, removeLabels);
  try {
    // OCI rejects metadata updates on closed PRs. Reopen before editing them.
    if (pr.state === 'closed') {
      await client.post(`${path}/actions/reopen`);
    }
    await client.put(path, {
      displayName: prTitle,
      description: prBody === undefined ? undefined : prepareBody(prBody),
      destinationBranch: targetBranch,
    });
    if (state === 'closed') {
      await client.post(`${path}/actions/decline`);
    }
  } finally {
    // A previous step can succeed even when a subsequent request fails.
    prList = undefined;
  }
}

function warnLabels(...labels: (string[] | null | undefined)[]): void {
  if (labels.some((items) => items?.length)) {
    logger.once.warn(
      'OCI pull request labels are not supported; configured labels are ignored',
    );
  }
}

export async function addReviewers(
  number: number,
  reviewers: string[],
): Promise<void> {
  if (!reviewers.length) {
    return;
  }
  if (reviewers.some((reviewer) => !reviewer.startsWith('ocid1.user.'))) {
    throw new Error(
      'OCI reviewers must be user OCIDs, not usernames or group names',
    );
  }
  const pr = await getPr(number);
  if (!pr) {
    throw new Error(`OCI pull request not found: ${number}`);
  }
  if (reviewers.includes(pr.authorId)) {
    logger.once.warn(
      'OCI does not allow the pull request author to be a reviewer; skipping the author',
    );
  }
  const newReviewers = reviewers.filter(
    (reviewer) => reviewer !== pr.authorId && !pr.reviewers?.includes(reviewer),
  );
  if (!newReviewers.length) {
    return;
  }
  const principalIds = [
    ...new Set([...coerceArray(pr.reviewers), ...newReviewers]),
  ];
  await client.put(await prPath(number), {
    reviewers: principalIds.map((principalId) => ({ principalId })),
  });
  prList = undefined;
}

export async function getRawFile(
  fileName: string,
  repoName = repositoryId,
  branchOrTag?: string,
): Promise<string | null> {
  const params = new URLSearchParams({
    filePath: fileName,
  });
  if (branchOrTag) {
    params.set('refName', branchOrTag);
  }
  const path = `repositories/${encodeURIComponent(repoName)}`;
  const response = await client.get<{
    sha: string;
    type: string;
    code?: string;
    message?: string;
  }>(`${path}/object?${params}`, {
    throwHttpErrors: false,
    responseBecomesConfig: true,
  });
  const isInvalidFilePath =
    response.statusCode === 400 &&
    response.body.code === 'InvalidParameter' &&
    response.body.message === `Invalid filePath:${fileName}`;
  if (response.statusCode === 404 || isInvalidFilePath) {
    return null;
  }
  if (response.statusCode !== 200) {
    throw new Error(`OCI file lookup failed (${response.statusCode})`);
  }
  if (response.body.type !== 'BLOB') {
    return null;
  }
  const query = new URLSearchParams({ filePath: fileName });
  return client.getText(
    `${path}/objects/${encodeURIComponent(response.body.sha)}/content?${query}`,
    { responseBecomesConfig: true },
  );
}

export async function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<unknown> {
  return parseJson(await getRawFile(fileName, repoName, branchOrTag), fileName);
}

export async function ensureComment({
  number,
  topic,
  content,
}: EnsureCommentConfig): Promise<boolean> {
  const path = `${await prPath(number)}/comments`;
  const header = topic ? `### ${topic}\n\n` : '';
  const data = sanitize(`${header}${content}`);
  const comments = await client.list<OciComment>(path, {});
  const existing = comments.find(
    (comment) =>
      isOwnComment(comment) &&
      (topic
        ? comment.data.startsWith(sanitize(header))
        : comment.data === data),
  );
  if (!existing) {
    await client.post(path, { data });
  } else if (existing.data !== data) {
    await client.put(`${path}/${encodeURIComponent(existing.id)}`, { data });
  }
  return true;
}

export async function ensureCommentRemoval(
  config: EnsureCommentRemovalConfig,
): Promise<void> {
  const path = `${await prPath(config.number)}/comments`;
  const comments = await client.list<OciComment>(path, {});
  for (const comment of comments) {
    if (
      isOwnComment(comment) &&
      (config.type === 'by-topic'
        ? comment.data.startsWith(sanitize(`### ${config.topic}\n\n`))
        : comment.data === sanitize(config.content))
    ) {
      await client.delete(`${path}/${encodeURIComponent(comment.id)}`);
    }
  }
}

function isOwnComment(comment: OciComment): boolean {
  return (
    comment.createdBy.principalId === userId &&
    !comment.filePath &&
    !comment.parentId
  );
}

export function massageMarkdown(body: string): string {
  return prepareBody(body);
}

export function maxBodyLength(): number {
  return 4000;
}

// Unsupported features deliberately fail closed, particularly CI and automerge.
export function mergePr(_config: MergePRConfig): Promise<boolean> {
  logger.once.warn(
    'OCI automerge is not supported; merge pull requests manually',
  );
  return Promise.resolve(false);
}

export function getBranchStatus(
  _branchName: string,
  _internalChecksAsSuccess: boolean,
): Promise<BranchStatus> {
  return Promise.resolve('yellow');
}

export function getBranchStatusCheck(
  _branchName: string,
  _context: string,
): Promise<BranchStatus | null> {
  return Promise.resolve(null);
}

export function setBranchStatus(_config: BranchStatusConfig): Promise<void> {
  logger.debug('OCI commit statuses are not supported');
  return Promise.resolve();
}

export function addAssignees(
  _number: number,
  _assignees: string[],
): Promise<void> {
  logger.once.warn(
    'OCI pull request assignees are not supported; use reviewers with user OCIDs instead',
  );
  return Promise.resolve();
}

export function deleteLabel(_number: number, _label: string): Promise<void> {
  logger.once.warn('OCI pull request labels are not supported');
  return Promise.resolve();
}

export function getIssueList(): Promise<Issue[]> {
  return Promise.resolve([]);
}

export function findIssue(_title: string): Promise<Issue | null> {
  return Promise.resolve(null);
}

export function ensureIssue(
  _config: EnsureIssueConfig,
): Promise<EnsureIssueResult | null> {
  logger.once.warn(
    'OCI issues and the Dependency Dashboard are not supported; set dependencyDashboard=false',
  );
  return Promise.resolve(null);
}

export function ensureIssueClosing(_title: string): Promise<void> {
  // OCI DevOps does not have issues or a Dependency Dashboard.
  return Promise.resolve();
}
