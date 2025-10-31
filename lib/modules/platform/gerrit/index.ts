import { DateTime } from 'luxon';
import { logger } from '../../../logger';
import type { BranchStatus } from '../../../types';
import { parseJson } from '../../../util/common';
import * as git from '../../../util/git';
import { setBaseUrl } from '../../../util/http/gerrit';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash } from '../../../util/url';
import { hashBody } from '../pr-body';
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
import { GerritPrCache } from './pr-cache';
import { configureScm } from './scm';
import type {
  GerritChange,
  GerritLabelTypeInfo,
  GerritProjectInfo,
} from './types';
import {
  REQUEST_DETAILS_FOR_PRS,
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
  configureScm(repository);
  await git.initRepo({ url });

  //abandon "open" and "rejected" changes at startup
  const rejectedChanges = await client.findChanges(config.repository!, {
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
  if (prConfig.prBody) {
    await client.addMessageIfNotAlreadyExists(
      prConfig.number,
      prConfig.prBody,
      TAG_PULL_REQUEST_BODY,
    );
    cached.bodyStruct = {
      hash: hashBody(prConfig.prBody),
    };
  }
  if (prConfig.state && prConfig.state === 'closed') {
    await client.abandonChange(prConfig.number);
    cached.state = 'closed';
  }
  logger.debug(`updatePr: updating gerrit change ${prConfig.number} in cache`);
  await GerritPrCache.setPr(config.repository!, cached);
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
  await client.addMessageIfNotAlreadyExists(
    change._number,
    prConfig.prBody,
    TAG_PULL_REQUEST_BODY,
    change.messages,
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
  const cached = prs.find((pr) => {
    if (pr.sourceBranch !== branchName) {
      return false;
    }
    if (pr.state !== 'open') {
      return false;
    }
    if (targetBranch && pr.targetBranch !== targetBranch) {
      return false;
    }
    return true;
  });
  logger.trace(
    `getBranchPr: using cached gerrit change ${cached?.number} for ${branchName}`,
  );
  return cached ?? null;
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
  try {
    const change = await client.submitChange(mergeConfig.id);
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
  cached.state = 'merged';
  logger.debug(`mergePr: updating gerrit change ${mergeConfig.id} in cache`);
  await GerritPrCache.setPr(config.repository!, cached);
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
  return 16384; //TODO: check the real gerrit limit (max. chars)
}

export async function deleteLabel(
  number: number,
  label: string,
): Promise<void> {
  await client.deleteHashtag(number, label);
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
