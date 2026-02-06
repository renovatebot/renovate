import { DateTime } from 'luxon';
import semver from 'semver';
import { logger } from '../../../logger/index.ts';
import type { BranchStatus } from '../../../types/index.ts';
import { clone } from '../../../util/clone.ts';
import { parseJson } from '../../../util/common.ts';
import { getEnv } from '../../../util/env.ts';
import * as git from '../../../util/git/index.ts';
import type { VirtualBranch } from '../../../util/git/types.ts';
import { setBaseUrl } from '../../../util/http/gerrit.ts';
import { regEx } from '../../../util/regex.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import { hashBody } from '../pr-body.ts';
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
} from '../types.ts';
import { repoFingerprint } from '../util.ts';

import { smartTruncate } from '../utils/pr-body.ts';
import { readOnlyIssueBody } from '../utils/read-only-issue-body.ts';
import { client } from './client.ts';
import { GerritPrCache } from './pr-cache.ts';
import { configureScm } from './scm.ts';
import type {
  GerritChange,
  GerritLabelTypeInfo,
  GerritProjectInfo,
} from './types.ts';
import {
  MAX_GERRIT_COMMENT_SIZE,
  REQUEST_DETAILS_FOR_PRS,
  TAG_PULL_REQUEST_BODY,
  extractSourceBranch,
  getGerritRepoUrl,
  mapBranchStatusToLabel,
  mapGerritChangeToPr,
} from './utils.ts';

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

export async function initPlatform({
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

  let gerritVersion: string;
  try {
    const env = getEnv();
    /* v8 ignore if: experimental feature */
    if (env.RENOVATE_X_PLATFORM_VERSION) {
      gerritVersion = env.RENOVATE_X_PLATFORM_VERSION;
    } else {
      gerritVersion = await client.getGerritVersion({
        username,
        password,
      });
    }
  } catch (err) {
    logger.debug(
      { err },
      'Error authenticating with Gerrit. Check your credentials',
    );
    throw new Error('Init: Authentication failure');
  }

  logger.debug('Gerrit version is: ' + gerritVersion);
  // Example: 3.13.0-rc3-148-gb478dbbb57
  const parsed = semver.parse(gerritVersion);
  if (!parsed) {
    throw new Error(`Unable to parse Gerrit version: ${gerritVersion}`);
  }
  gerritVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  client.setGerritVersion(gerritVersion);

  const platformConfig: PlatformResult = {
    endpoint: defaults.endpoint,
  };
  return platformConfig;
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
  cloneSubmodules,
  cloneSubmodulesFilter,
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

  // Abandon all changes voted with Code-Review -2
  // The GerritPrCache cannot be used here otherwise initializeCaches(), which is not called yet, would erase it later
  const rejectedChanges = await client.findChanges(repository, {
    branchName: '',
    state: 'open',
    label: '-2',
  });
  for (const change of rejectedChanges) {
    await client.abandonChange(
      change._number,
      'This change has been abandoned as it was voted with Code-Review -2.',
    );
    logger.info(
      `Abandoned change ${change._number} with Code-Review -2 in repository ${repository}`,
    );
  }

  // Collect open Gerrit changes to initialize as virtual branches
  // This allows the DefaultGitScm to work with Gerrit changes as if they were regular Git branches.
  // The GerritPrCache cannot be used here otherwise initializeCaches(), which is not called yet, would erase it later
  const openChanges = await client.findChanges(repository, {
    branchName: '',
    state: 'open',
    requestDetails: ['CURRENT_REVISION', 'COMMIT_FOOTERS'],
  });
  const virtualBranches: VirtualBranch[] = [];
  for (const change of openChanges) {
    const branchName = extractSourceBranch(change);
    if (!branchName) {
      continue;
    }
    const sha = change.current_revision!;
    const ref = change.revisions![sha].ref;
    virtualBranches.push({
      name: branchName,
      ref,
      sha,
    });
  }

  if (virtualBranches.length > 0) {
    logger.debug(
      `Will fetch ${virtualBranches.length} Gerrit changes as virtual branches`,
    );
  }

  const baseUrl = defaults.endpoint!;
  const url = getGerritRepoUrl(repository, baseUrl);
  configureScm(repository);
  await git.initRepo({
    url,
    cloneSubmodules,
    cloneSubmodulesFilter,
    virtualBranches,
  });

  const repoConfig: RepoResult = {
    defaultBranch: config.head!,
    isFork: false,
    repoFingerprint: repoFingerprint(repository, baseUrl),
  };
  return repoConfig;
}

export async function findPr(findPRConfig: FindPRConfig): Promise<Pr | null> {
  if (!findPRConfig.refreshCache) {
    const prs = await GerritPrCache.getPrs(config.repository!);
    // Find matching PR from cache
    const cached = prs.find((pr) => {
      if (
        findPRConfig.branchName &&
        pr.sourceBranch !== findPRConfig.branchName
      ) {
        return false;
      }
      if (
        findPRConfig.targetBranch &&
        pr.targetBranch !== findPRConfig.targetBranch
      ) {
        return false;
      }
      if (findPRConfig.prTitle && pr.title !== findPRConfig.prTitle) {
        return false;
      }
      if (
        findPRConfig.state !== undefined &&
        findPRConfig.state !== 'all' &&
        pr.state !== findPRConfig.state &&
        !(findPRConfig.state === '!open' && pr.state !== 'open')
      ) {
        return false;
      }
      return true;
    });
    logger.trace(
      `findPr: using cached gerrit change ${cached?.number} for ${findPRConfig.branchName}`,
    );
    return cached ?? null;
  }

  const change = (
    await client.findChanges(config.repository!, {
      ...findPRConfig,
      singleChange: true,
      requestDetails: REQUEST_DETAILS_FOR_PRS,
    })
  ).pop();
  if (!change) {
    return null;
  }
  const pr = mapGerritChangeToPr(change, {
    sourceBranch: findPRConfig.branchName,
  })!;

  logger.debug(`findPr: saving gerrit change ${pr.number} to cache`);
  await GerritPrCache.setPr(config.repository!, pr);

  return pr;
}

export async function refreshPr(number: number): Promise<void> {
  // refresh cache
  await getPr(number, true);
}

export async function getPr(
  number: number,
  refreshCache?: boolean,
): Promise<Pr | null> {
  if (!refreshCache) {
    const prs = await GerritPrCache.getPrs(config.repository!);
    const cached = prs.find((pr) => pr.number === number) ?? null;
    logger.trace(
      `getPr: using cached gerrit change ${cached?.sourceBranch} for ${number}`,
    );
    return cached;
  }

  let change: GerritChange;
  try {
    change = await client.getChange(number, REQUEST_DETAILS_FOR_PRS);
  } catch (err) {
    if (err.statusCode === 404) {
      return null;
    }
    throw err;
  }
  const pr = mapGerritChangeToPr(change);
  if (!pr) {
    return null;
  }

  logger.debug(`getPr: saving gerrit change ${number} to cache`);
  await GerritPrCache.setPr(config.repository!, pr);

  return pr;
}

export async function updatePr(prConfig: UpdatePrConfig): Promise<void> {
  logger.debug(`updatePr(${prConfig.number}, ${prConfig.prTitle})`);
  const prs = await GerritPrCache.getPrs(config.repository!);
  const cached = prs.find((pr) => pr.number === prConfig.number);
  if (!cached) {
    logger.warn(`updatePr: PR ${prConfig.number} not found in cache`);
    return;
  }

  const pr = clone(cached);
  let updated = false;

  // prConfig.prBody will only be set if the body has changed
  if (prConfig.prBody) {
    await client.addMessage(
      prConfig.number,
      prConfig.prBody,
      TAG_PULL_REQUEST_BODY,
    );
    pr.bodyStruct = {
      hash: hashBody(prConfig.prBody),
    };
    pr.updatedAt = new Date().toISOString();
    updated = true;
  }
  if (prConfig.targetBranch) {
    await client.moveChange(prConfig.number, prConfig.targetBranch);
    pr.targetBranch = prConfig.targetBranch;
    updated = true;
  }
  if (prConfig.state && prConfig.state === 'closed') {
    const change = await client.abandonChange(prConfig.number);
    pr.state = 'closed';
    pr.updatedAt = change.updated.replace(' ', 'T');
    updated = true;
  }

  if (updated) {
    logger.debug(
      `updatePr: updating gerrit change ${prConfig.number} in cache`,
    );
    await GerritPrCache.setPr(config.repository!, pr);
  }
  // TODO: support restoring change if prConfig.state === 'open'
  // TODO: support moving change if prConfig.targetBranch is set
}

export async function createPr(prConfig: CreatePRConfig): Promise<Pr | null> {
  logger.debug(
    `createPr(${prConfig.sourceBranch}, ${prConfig.prTitle}, ${
      prConfig.labels?.toString() ?? ''
    })`,
  );
  const change = (
    await client.findChanges(config.repository!, {
      branchName: prConfig.sourceBranch,
      targetBranch: prConfig.targetBranch,
      state: 'open',
      singleChange: true,
      requestDetails: REQUEST_DETAILS_FOR_PRS,
    })
  ).pop();
  if (change === undefined) {
    throw new Error(
      `the change should be created automatically from previous push to refs/for/${prConfig.sourceBranch}`,
    );
  }
  const created = DateTime.fromISO(change.created.replace(' ', 'T'), {});
  const fiveMinutesAgo = DateTime.utc().minus({ minutes: 5 });
  if (created < fiveMinutesAgo) {
    throw new Error(
      `the change should have been created automatically from previous push to refs/for/${prConfig.sourceBranch}, but it was not created in the last 5 minutes (${change.created})`,
    );
  }
  await client.addMessage(
    change._number,
    prConfig.prBody,
    TAG_PULL_REQUEST_BODY,
  );
  const pr = mapGerritChangeToPr(change, {
    sourceBranch: prConfig.sourceBranch,
    prBody: prConfig.prBody,
  })!;

  logger.debug(`createPr: saving gerrit change ${pr.number} to cache`);
  await GerritPrCache.setPr(config.repository!, pr);

  return pr;
}

export async function getBranchPr(
  branchName: string,
  targetBranch?: string,
): Promise<Pr | null> {
  const prs = await GerritPrCache.getPrs(config.repository!);
  const cachedPrs = prs.filter((pr) => {
    if (pr.sourceBranch !== branchName) {
      return false;
    }
    if (pr.state !== 'open') {
      return false;
    }
    return true;
  });
  // TODO: review this (refs https://github.com/renovatebot/renovate/pull/39046)
  let result: Pr | undefined;
  if (targetBranch) {
    const found = cachedPrs.find((pr) => pr.targetBranch === targetBranch);
    if (found) {
      result = found;
    }
  }
  result ??= cachedPrs[0];
  logger.trace(
    `getBranchPr: using cached gerrit change ${result?.number} for ${branchName}`,
  );
  return result ?? null;
}

export async function getPrList(): Promise<Pr[]> {
  const cached = await GerritPrCache.getPrs(config.repository!);
  logger.debug(`getPrList: using ${cached.length} cached changes`);
  return cached;
}

export async function mergePr(mergeConfig: MergePRConfig): Promise<boolean> {
  logger.debug(
    `mergePr(${mergeConfig.id}, ${mergeConfig.branchName!}, ${mergeConfig.strategy!})`,
  );
  const prs = await GerritPrCache.getPrs(config.repository!);
  const cached = prs.find((pr) => pr.number === mergeConfig.id);
  if (!cached) {
    logger.warn(`mergePr: PR ${mergeConfig.id} not found in cache`);
    return false;
  }

  let change: GerritChange;
  try {
    change = await client.submitChange(mergeConfig.id);
    if (change.status !== 'MERGED') {
      return false;
    }
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

  const pr = clone(cached);
  pr.state = 'merged';
  pr.updatedAt = change.updated.replace(' ', 'T');
  logger.debug(`mergePr: updating gerrit change ${mergeConfig.id} in cache`);
  await GerritPrCache.setPr(config.repository!, pr);
  return true;
}

/**
 * BranchStatus for Gerrit assumes that the branchName refers to a change.
 * @param branchName
 */
export async function getBranchStatus(
  branchName: string,
): Promise<BranchStatus> {
  logger.debug(`getBranchStatus(${branchName})`);
  const change = (
    await client.findChanges(config.repository!, {
      state: 'open',
      branchName,
      singleChange: true,
      requestDetails: ['LABELS', 'SUBMITTABLE', 'CHECK'],
    })
  ).pop();
  if (change) {
    const hasProblems = change.problems && change.problems.length > 0;
    if (hasProblems) {
      return 'red';
    }
    const hasBlockingLabels = Object.values(change.labels ?? {}).some(
      (label) => label.blocking,
    );
    if (hasBlockingLabels) {
      return 'red';
    }
    if (change.submittable) {
      return 'green';
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
  const labelConfig = config.labels[context];
  if (labelConfig) {
    const change = (
      await client.findChanges(config.repository!, {
        branchName,
        state: 'open',
        singleChange: true,
        requestDetails: ['LABELS'],
      })
    ).pop();
    if (change) {
      const label = change.labels![context];
      if (label) {
        // Check for rejected or blocking first, as a label could have both rejected and approved
        if (label.rejected || label.blocking) {
          return 'red';
        }
        if (label.approved) {
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
    const change = (
      await client.findChanges(config.repository!, {
        branchName: branchStatusConfig.branchName,
        state: 'open',
        singleChange: true,
        requestDetails: ['LABELS'],
      })
    ).pop();

    const labelKey = branchStatusConfig.context;
    if (!change?.labels || !Object.hasOwn(change.labels, labelKey)) {
      return;
    }

    await client.setLabel(change._number, labelKey, labelValue);
  }
}

export async function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string,
): Promise<string | null> {
  const repo = repoName ?? config.repository;
  if (!repo) {
    logger.debug('No repo so cannot getRawFile');
    return null;
  }
  const branch =
    branchOrTag ??
    (repo === config.repository ? (config.head ?? 'HEAD') : 'HEAD');
  const result = await client.getFile(repo, branch, fileName);
  return result;
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

export function massageMarkdown(prBody: string, rebaseLabel: string): string {
  return (
    smartTruncate(readOnlyIssueBody(prBody), maxBodyLength())
      .replace('Branch creation', 'Change creation')
      .replace(
        'close this Pull Request unmerged',
        'abandon or vote this change with Code-Review -2',
      )
      .replace(
        'Close this PR',
        'Abandon or vote this change with Code-Review -2',
      )
      .replace(
        'you tick the rebase/retry checkbox',
        `you add the _${rebaseLabel}_ hashtag to this change`,
      )
      .replace(
        'checking the rebase/retry box above',
        `adding the _${rebaseLabel}_ hashtag to this change`,
      )
      .replace(regEx(/\b(?:Pull Request|PR)/g), 'change')
      // Remove HTML tags not supported in Gerrit markdown
      .replace(regEx(/<\/?summary>/g), '**')
      .replace(regEx(/<\/?(details|blockquote)>/g), '')
      .replace(regEx(`\n---\n\n.*?<!-- rebase-check -->.*?\n`), '')
      .replace(regEx(/<!--renovate-(?:debug|config-hash):.*?-->/g), '')
      // Remove zero-width-space not supported in Gerrit markdown
      .replace(regEx(/&#8203;/g), '')
  );
}

export function maxBodyLength(): number {
  return MAX_GERRIT_COMMENT_SIZE;
}

export async function deleteLabel(
  number: number,
  label: string,
): Promise<void> {
  await client.deleteHashtag(number, label);
}

export function ensureCommentRemoval(
  _ensureCommentRemoval:
    | EnsureCommentRemovalConfigByTopic
    | EnsureCommentRemovalConfigByContent,
): Promise<void> {
  return Promise.resolve();
}

export function ensureIssueClosing(_title: string): Promise<void> {
  return Promise.resolve();
}

export function ensureIssue(
  _issueConfig: EnsureIssueConfig,
): Promise<EnsureIssueResult | null> {
  return Promise.resolve(null);
}

export function findIssue(_title: string): Promise<Issue | null> {
  return Promise.resolve(null);
}

export function getIssueList(): Promise<Issue[]> {
  return Promise.resolve([]);
}
