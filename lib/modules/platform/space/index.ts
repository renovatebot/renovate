import {logger} from '../../../logger';
import type {BranchStatus} from '../../../types';
import {parseJson} from '../../../util/common';
import * as git from '../../../util/git';
import {regEx} from '../../../util/regex';
import {trimTrailingSlash} from "../../../util/url";
import type {
  BranchStatusConfig,
  CreatePRConfig,
  EnsureCommentConfig,
  EnsureCommentRemovalConfigByContent,
  EnsureCommentRemovalConfigByTopic,
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
import {repoFingerprint} from '../util';

import {smartTruncate} from '../utils/pr-body';
import {readOnlyIssueBody} from '../utils/read-only-issue-body';
import {SpaceClient} from "./client";
import {SpaceDao} from "./dao";
import {getSpaceRepoUrl, mapGerritChangeToPr,} from './utils';

export const id = 'space';

const globalConfig: {
  endpoint?: string;
} = {};

// TODO: make const?
let repoConfig: {
  projectKey?: string;
  repository?: string;
  head?: string;
} = {};

export function writeToConfig(newConfig: typeof repoConfig): void {
  repoConfig = {...repoConfig, ...newConfig};
}

let client: SpaceClient
let dao: SpaceDao

export function initPlatform({endpoint, token}: PlatformParams): Promise<PlatformResult> {
  logger.debug(`SPACE initPlatform(${endpoint!})`);

  if (!endpoint) {
    throw new Error('Init: You must configure your JetBrains Space endpoint');
  }

  if (!token) {
    throw new Error('Init: You must configure a JetBrains Space token');
  }

  globalConfig.endpoint = trimTrailingSlash(endpoint);
  client = new SpaceClient(`https://${globalConfig.endpoint}`)
  dao = new SpaceDao(client)

  return Promise.resolve({
    endpoint: globalConfig.endpoint,
  });
}

export async function getRepos(): Promise<string[]> {
  logger.debug(`SPACE getRepos()`);
  return await dao.findRepositories();
}

export async function initRepo({repository}: RepoParams): Promise<RepoResult> {
  logger.debug(`SPACE initRepo(${repository})`);

  const repoParts = repository.split('/')
  const projectKey = repoParts[0];
  const shortRepository = repoParts[1];

  repoConfig = {
    ...repoConfig,
    projectKey,
    repository: shortRepository,
  };

  const baseUrl = globalConfig.endpoint!;
  const url = getSpaceRepoUrl(repository, baseUrl);
  await git.initRepo({url});

  return {
    defaultBranch: await dao.findDefaultBranch(projectKey, shortRepository),
    isFork: false,
    repoFingerprint: repoFingerprint(repository, baseUrl),
  };
}

export async function findPr(
  findPRConfig: FindPRConfig,
  refreshCache?: boolean,
): Promise<Pr | null> {
  logger.debug(`SPACE findPr(${JSON.stringify(findPRConfig)}, ${refreshCache})`);
  // TODO: add support for refreshCache
  return await dao.findMergeRequest(repoConfig.projectKey!, repoConfig.repository!, findPRConfig)
}

export async function getPr(number: number): Promise<Pr | null> {
  logger.debug(`SPACE getPr(${number})`);
  try {
    const change = await client.getChange(number);
    return mapGerritChangeToPr(change);
  } catch (err) {
    if (err.statusCode === 404) {
      return null;
    }
    throw err;
  }
}

export async function updatePr(prConfig: UpdatePrConfig): Promise<void> {
  logger.debug(`SPACE updatePr(${prConfig.number}, ${prConfig.prTitle})`);
  await dao.updateMergeRequest(repoConfig.projectKey!, prConfig)
}

export async function createPr(prConfig: CreatePRConfig): Promise<Pr> {
  logger.debug(`SPACE createPr(${prConfig.sourceBranch}, ${prConfig.prTitle}`);
  return await dao.createMergeRequest(repoConfig.projectKey!, repoConfig.repository!, prConfig)
}

export async function getBranchPr(branchName: string): Promise<Pr | null> {
  logger.debug(`SPACE getBranchPr(${branchName})`);
  return await dao.findMergeRequest(repoConfig.projectKey!, repoConfig.repository!, {branchName, state: 'open'})
}

export async function getPrList(): Promise<Pr[]> {
  logger.debug(`SPACE getPrList()`);
  return await dao.findAllMergeRequests(repoConfig.projectKey!, repoConfig.repository!)
}

export async function mergePr(config: MergePRConfig): Promise<boolean> {
  logger.debug(`SPACE mergePr(${config.id}, ${config.branchName!}, ${config.strategy!})`);

  // TODO: add deleteSourceBranch parameter to global config
  // TODO: add support for changing target branch? (config.branch)

  await dao.mergeMergeRequest(repoConfig.projectKey!, config.id, config.strategy ?? 'auto', true)
  return true
}

/**
 * BranchStatus for Gerrit assumes that the branchName refers to a change.
 * @param branchName
 */
export async function getBranchStatus(
  branchName: string,
): Promise<BranchStatus> {
  logger.debug(`SPACE getBranchStatus(${branchName})`);
  return await dao.findBranchStatus(repoConfig.projectKey!, repoConfig.repository!, branchName)
}

export function getBranchStatusCheck(
  branchName: string,
  context: string,
): Promise<BranchStatus | null> {
  // TODO: space doesn't seem to support custom "checks"
  return Promise.resolve('yellow');
}

export async function setBranchStatus(
  branchStatusConfig: BranchStatusConfig,
): Promise<void> {
  // TODO: space doesn't seem to support custom "checks"
}

export function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<string | null> {
  const repo = repoName ?? repoConfig.repository!;
  const branch = branchOrTag ?? (repo === repoConfig.repository ? repoConfig.head! : 'HEAD');
  return dao.getFileTextContent(repo, branch, fileName);
}

export async function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<any> {
  const raw = await getRawFile(fileName, repoName, branchOrTag);
  return parseJson(raw, fileName);
}

export async function addReviewers(
  number: number,
  reviewers: string[],
): Promise<void> {
  await dao.addReviewers(repoConfig.projectKey!, number, reviewers)
}

export async function addAssignees(
  number: number,
  assignees: string[],
): Promise<void> {
  await dao.addAuthors(repoConfig.projectKey!, number, assignees)
}

export async function ensureComment(
  ensureComment: EnsureCommentConfig,
): Promise<boolean> {
  logger.debug(
    `ensureComment(${ensureComment.number}, ${ensureComment.topic!}, ${
      ensureComment.content
    })`,
  );
  await client.addMessageIfNotAlreadyExists(
    ensureComment.number,
    ensureComment.content,
    ensureComment.topic ?? undefined,
  );
  return true;
}

export function massageMarkdown(prBody: string): string {
  //TODO: do more Gerrit specific replacements?
  return smartTruncate(readOnlyIssueBody(prBody), 16384) //TODO: check the real gerrit limit (max. chars)
    .replace(regEx(/Pull Request(s)?/g), 'Change-Request$1')
    .replace(regEx(/\bPR(s)?\b/g), 'Change-Request$1')
    .replace(regEx(/<\/?summary>/g), '**')
    .replace(regEx(/<\/?details>/g), '')
    .replace(regEx(/&#8203;/g), '') //remove zero-width-space not supported in gerrit-markdown
    .replace(
      'close this Change-Request unmerged.',
      'abandon or down vote this Change-Request with -2.',
    )
    .replace('Branch creation', 'Change creation')
    .replace(
      'Close this Change-Request',
      'Down-vote this Change-Request with -2',
    )
    .replace(
      'you tick the rebase/retry checkbox',
      'add "rebase!" at the beginning of the commit message.',
    )
    .replace(regEx(`\n---\n\n.*?<!-- rebase-check -->.*?\n`), '')
    .replace(regEx(/<!--renovate-(?:debug|config-hash):.*?-->/g), '');
}

export function deleteLabel(number: number, label: string): Promise<void> {
  return Promise.resolve();
}

export function ensureCommentRemoval(
  ensureCommentRemoval:
    | EnsureCommentRemovalConfigByTopic
    | EnsureCommentRemovalConfigByContent,
): Promise<void> {
  return Promise.resolve();
}

export function ensureIssueClosing(title: string): Promise<void> {
  return Promise.resolve();
}

export function ensureIssue(
  issueConfig: EnsureIssueConfig,
): Promise<EnsureIssueResult | null> {
  return Promise.resolve(null);
}

export function findIssue(title: string): Promise<Issue | null> {
  return Promise.resolve(null);
}

export function getIssueList(): Promise<Issue[]> {
  return Promise.resolve([]);
}
