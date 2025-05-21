import { logger } from '../../../logger';
import type { BranchStatus } from '../../../types';
import { parseJson } from '../../../util/common';
import * as git from '../../../util/git';
import { setBaseUrl } from '../../../util/http/gerrit';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash } from '../../../util/url';
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
import { repoFingerprint } from '../util';

import { smartTruncate } from '../utils/pr-body';
import { readOnlyIssueBody } from '../utils/read-only-issue-body';
import { client } from './client';
import { configureScm } from './scm';
import type { GerritLabelTypeInfo, GerritProjectInfo } from './types';
import {
  TAG_PULL_REQUEST_BODY,
  getGerritRepoUrl,
  mapBranchStatusToLabel,
  mapGerritChangeToPr,
} from './utils';

export const id = 'gerrit';

const defaults: {
  endpoint?: string;
} = {};

let config: {
  repository?: string;
  head?: string;
  config?: GerritProjectInfo;
  labels: Record<string, GerritLabelTypeInfo>;
  gerritUsername?: string;
} = {
  labels: {},
};

export function writeToConfig(newConfig: typeof config): void {
  config = { ...config, ...newConfig };
}

export function initPlatform({
  endpoint,
  username,
  password,
}: PlatformParams): Promise<PlatformResult> {
  logger.debug(`initPlatform(${endpoint!}, ${username!})`);
  if (!endpoint) {
    throw new Error('Init: You must configure a Gerrit Server endpoint');
  }
  if (!(username && password)) {
    throw new Error(
      'Init: You must configure a Gerrit Server username/password',
    );
  }
  config.gerritUsername = username;
  defaults.endpoint = ensureTrailingSlash(endpoint);
  setBaseUrl(defaults.endpoint);
  const platformConfig: PlatformResult = {
    endpoint: defaults.endpoint,
  };
  return Promise.resolve(platformConfig);
}

/**
 * Get all state="ACTIVE" and type="CODE" repositories from gerrit
 */
export async function getRepos(): Promise<string[]> {
  logger.debug(`getRepos()`);
  return await client.getRepos();
}

/**
 * Clone repository to local directory
 * @param config
 */
export async function initRepo({
  repository,
  gitUrl,
}: RepoParams): Promise<RepoResult> {
  logger.debug(`initRepo(${repository}, ${gitUrl})`);
  const projectInfo = await client.getProjectInfo(repository);
  const branchInfo = await client.getBranchInfo(repository);

  config = {
    ...config,
    repository,
    head: branchInfo.revision,
    config: projectInfo,
    labels: projectInfo.labels ?? {},
  };
  const baseUrl = defaults.endpoint!;
  const url = getGerritRepoUrl(repository, baseUrl);
  configureScm(repository, config.gerritUsername!);
  await git.initRepo({ url });

  //abandon "open" and "rejected" changes at startup
  const rejectedChanges = await client.findChanges(config.repository!, {
    branchName: '',
    state: 'open',
    label: '-2',
  });
  for (const change of rejectedChanges) {
    await client.abandonChange(change._number);
  }
  const repoConfig: RepoResult = {
    defaultBranch: config.head!,
    isFork: false,
    repoFingerprint: repoFingerprint(repository, baseUrl),
  };
  return repoConfig;
}

export async function findPr(
  findPRConfig: FindPRConfig,
  refreshCache?: boolean,
): Promise<Pr | null> {
  const change = (
    await client.findChanges(config.repository!, findPRConfig, refreshCache)
  ).pop();
  return change ? mapGerritChangeToPr(change) : null;
}

export async function getPr(number: number): Promise<Pr | null> {
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
  logger.debug(`updatePr(${prConfig.number}, ${prConfig.prTitle})`);
  if (prConfig.prBody) {
    await client.addMessageIfNotAlreadyExists(
      prConfig.number,
      prConfig.prBody,
      TAG_PULL_REQUEST_BODY,
    );
  }
  if (prConfig.state && prConfig.state === 'closed') {
    await client.abandonChange(prConfig.number);
  }
}

export async function createPr(prConfig: CreatePRConfig): Promise<Pr | null> {
  logger.debug(
    `createPr(${prConfig.sourceBranch}, ${prConfig.prTitle}, ${
      prConfig.labels?.toString() ?? ''
    })`,
  );
  const pr = (
    await client.findChanges(
      config.repository!,
      {
        branchName: prConfig.sourceBranch,
        targetBranch: prConfig.targetBranch,
        state: 'open',
      },
      true,
    )
  ).pop();
  if (pr === undefined) {
    throw new Error(
      `the change should be created automatically from previous push to refs/for/${prConfig.sourceBranch}`,
    );
  }
  await client.addMessageIfNotAlreadyExists(
    pr._number,
    prConfig.prBody,
    TAG_PULL_REQUEST_BODY,
  );
  return getPr(pr._number);
}

export async function getBranchPr(branchName: string): Promise<Pr | null> {
  const change = (
    await client.findChanges(config.repository!, { branchName, state: 'open' })
  ).pop();
  return change ? mapGerritChangeToPr(change) : null;
}

export function getPrList(): Promise<Pr[]> {
  return client
    .findChanges(config.repository!, { branchName: '' })
    .then((res) => res.map((change) => mapGerritChangeToPr(change)));
}

export async function mergePr(config: MergePRConfig): Promise<boolean> {
  logger.debug(
    `mergePr(${config.id}, ${config.branchName!}, ${config.strategy!})`,
  );
  try {
    const change = await client.submitChange(config.id);
    return change.status === 'MERGED';
  } catch (err) {
    if (err.statusCode === 409) {
      logger.warn(
        { err },
        "Can't submit the change, because the submit rule doesn't allow it.",
      );
      return false;
    }
    throw err;
  }
}

/**
 * BranchStatus for Gerrit assumes that the branchName refers to a change.
 * @param branchName
 */
export async function getBranchStatus(
  branchName: string,
): Promise<BranchStatus> {
  logger.debug(`getBranchStatus(${branchName})`);
  const changes = await client.findChanges(
    config.repository!,
    { state: 'open', branchName },
    true,
  );
  if (changes.length > 0) {
    const allSubmittable =
      changes.filter((change) => change.submittable === true).length ===
      changes.length;
    if (allSubmittable) {
      return 'green';
    }
    const hasProblems =
      changes.filter((change) => change.problems.length > 0).length > 0;
    if (hasProblems) {
      return 'red';
    }
    const hasBlockingLabels =
      changes.filter((change) =>
        Object.values(change.labels ?? {}).some((label) => label.blocking),
      ).length > 0;
    if (hasBlockingLabels) {
      return 'red';
    }
  }
  return 'yellow';
}

/**
 * check the gerrit-change for the presence of the corresponding "$context" Gerrit label if configured,
 *  return 'yellow' if not configured or not set
 * @param branchName
 * @param context renovate/stability-days || ...
 */
export async function getBranchStatusCheck(
  branchName: string,
  context: string,
): Promise<BranchStatus | null> {
  const label = config.labels[context];
  if (label) {
    const change = (
      await client.findChanges(
        config.repository!,
        { branchName, state: 'open' },
        true,
      )
    ).pop();
    if (change) {
      const labelRes = change.labels?.[context];
      if (labelRes) {
        // Check for rejected first, as a label could have both rejected and approved
        if (labelRes.rejected) {
          return 'red';
        }
        if (labelRes.approved) {
          return 'green';
        }
      }
    }
  }
  return 'yellow';
}

/**
 * Apply the branch state $context to the corresponding gerrit label (if available)
 * context === "renovate/stability-days" / "renovate/merge-confidence" and state === "green"/...
 * @param branchStatusConfig
 */
export async function setBranchStatus(
  branchStatusConfig: BranchStatusConfig,
): Promise<void> {
  const label = config.labels[branchStatusConfig.context];
  const labelValue =
    label && mapBranchStatusToLabel(branchStatusConfig.state, label);
  if (branchStatusConfig.context && labelValue) {
    const pr = await getBranchPr(branchStatusConfig.branchName);
    if (pr === null) {
      return;
    }
    await client.setLabel(pr.number, branchStatusConfig.context, labelValue);
  }
}

export function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<string | null> {
  const repo = repoName ?? config.repository ?? 'All-Projects';
  const branch =
    branchOrTag ?? (repo === config.repository ? config.head! : 'HEAD');
  return client.getFile(repo, branch, fileName);
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
  await client.addReviewers(number, reviewers);
}

/**
 * add "CC" (only one possible)
 */
export async function addAssignees(
  number: number,
  assignees: string[],
): Promise<void> {
  if (assignees.length) {
    if (assignees.length > 1) {
      logger.debug(
        `addAssignees(${number}, ${assignees.toString()}) called with more then one assignee! Gerrit only supports one assignee! Using the first from list.`,
      );
    }
    await client.addAssignee(number, assignees[0]);
  }
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
  return smartTruncate(readOnlyIssueBody(prBody), maxBodyLength())
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

export function maxBodyLength(): number {
  return 16384; //TODO: check the real gerrit limit (max. chars)
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
