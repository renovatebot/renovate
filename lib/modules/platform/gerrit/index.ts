import JSON5 from 'json5';
import type { RepoGlobalConfig } from '../../../config/types';
import { logger } from '../../../logger';
import type { BranchStatus, VulnerabilityAlert } from '../../../types';
import * as git from '../../../util/git';
import { setBaseUrl } from '../../../util/http/gerrit';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash } from '../../../util/url';
import { smartLinks } from '../gitea/utils';
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
import { client } from './client';
import { configureScm } from './scm';
import type {
  GerritChange,
  GerritFindPRConfig,
  GerritLabelTypeInfo,
  GerritProjectInfo,
} from './types';
import {
  TAG_PULL_REQUEST_BODY,
  getGerritRepoUrl,
  mapBranchStatusToLabel,
  mapGerritChangeToPr,
  mapPrStateToGerritFilter,
} from './utils';

const defaults: {
  endpoint?: string;
  hostType: string;
} = {
  hostType: 'gerrit',
};

let config: {
  repository?: string;
  head?: string;
  config?: GerritProjectInfo;
  labels: { [key: string]: GerritLabelTypeInfo };
  labelMappings?: {
    stabilityDaysLabel?: string;
    mergeConfidenceLabel?: string;
  };
  gerritUsername?: string;
} = {
  labels: {},
  labelMappings: {
    stabilityDaysLabel: 'Renovate-Stability',
  },
};

export function mergeToConfig(newConfig: typeof config): void {
  config = { ...config, ...newConfig };
}

export function initPlatform({
  endpoint,
  username,
  password,
  gerritLabelMapping,
}: PlatformParams & RepoGlobalConfig): Promise<PlatformResult> {
  logger.info(`initPlatform(${endpoint!}, ${username!})`);
  if (!endpoint) {
    throw new Error('Init: You must configure a Gerrit Server endpoint');
  }
  if (!(username && password)) {
    throw new Error(
      'Init: You must configure a Gerrit Server username/password'
    );
  }
  config.labelMappings = gerritLabelMapping;
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
  endpoint,
  gitUrl,
}: RepoParams): Promise<RepoResult> {
  logger.info(`initRepo(${repository}, ${endpoint!}, ${gitUrl!})`);
  const projectInfo = await client.getProjectInfo(repository);
  const branchInfo = await client.getBranchInfo(repository);

  config = {
    ...config,
    repository,
    head: branchInfo.revision,
    config: projectInfo,
    labels: projectInfo.labels ?? {},
  };
  const baseUrl = endpoint ?? defaults.endpoint!;
  const url = getGerritRepoUrl(repository, baseUrl);
  configureScm(repository, config.gerritUsername!);

  // Initialize Git storage
  await git.initRepo({ url });
  await git.syncGit(); //if not called the hook can be removed later...

  //abandon "open" and "rejected" changes at startup
  const rejectedChanges = await findOwnPr({
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
    repoFingerprint: repoFingerprint(repository, baseUrl), //TODO: understand the semantic? what cache could be stale/wrong?
  };
  return repoConfig;
}

async function findOwnPr(
  findPRConfig: GerritFindPRConfig,
  refreshCache?: boolean
): Promise<GerritChange[]> {
  const filterState = mapPrStateToGerritFilter(findPRConfig.state);
  const filter = ['owner:self', 'project:' + config.repository!, filterState];
  if (findPRConfig.branchName !== '') {
    filter.push(`hashtag:sourceBranch-${findPRConfig.branchName}`);
  }
  if (findPRConfig.targetBranch) {
    filter.push(`branch:${findPRConfig.targetBranch}`);
  }
  if (findPRConfig.label) {
    filter.push(`label:Code-Review=${findPRConfig.label}`);
  }
  const changes = await client.findChanges(filter, refreshCache);
  logger.debug(`findOwnPr(${filter.join(', ')}) => ${changes.length}`);
  return changes;
}

export async function findPr(
  findPRConfig: FindPRConfig,
  refreshCache?: boolean
): Promise<Pr | null> {
  const change = (await findOwnPr(findPRConfig, refreshCache)).pop();
  return change ? mapGerritChangeToPr(change) : null;
}

export async function getPr(number: number): Promise<Pr | null> {
  try {
    const change = await client.getChange(number);
    return Promise.resolve(mapGerritChangeToPr(change));
  } catch (err) {
    if (err.statusCode === 404) {
      return Promise.resolve(null);
    }
    throw err;
  }
}

export async function updatePr(prConfig: UpdatePrConfig): Promise<void> {
  logger.info(`updatePr(${prConfig.number}, ${prConfig.prTitle})`);
  const change = await client.getChange(prConfig.number);
  if (change.subject !== prConfig.prTitle) {
    await updatePullRequestTitle(
      prConfig.number,
      change.change_id,
      prConfig.prTitle
    );
  }
  if (prConfig.prBody) {
    await updatePullRequestBody(prConfig.number, prConfig.prBody);
  }
  if (prConfig.platformOptions?.gerritAutoApprove) {
    await client.approveChange(prConfig.number);
  }
  if (prConfig.state && prConfig.state === 'closed') {
    await client.abandonChange(prConfig.number);
  }
}

export async function createPr(prConfig: CreatePRConfig): Promise<Pr | null> {
  logger.info(
    `createPr(${prConfig.sourceBranch}, ${prConfig.prTitle}, ${
      prConfig.labels?.toString() ?? ''
    })`
  );
  const pr = (
    await findOwnPr(
      {
        branchName: prConfig.sourceBranch,
        targetBranch: prConfig.targetBranch,
        state: 'open',
      },
      true
    )
  ).pop();
  if (pr) {
    //Workaround for "Known Problems.1"
    if (pr.subject !== prConfig.prTitle) {
      await updatePullRequestTitle(pr._number, pr.change_id, prConfig.prTitle);
    }
    await updatePullRequestBody(pr._number, prConfig.prBody);
    if (prConfig.platformOptions?.gerritAutoApprove) {
      await client.approveChange(pr._number);
    }
    return getPr(pr._number);
  } else {
    throw new Error(
      `the change should be created automatically from previous push to refs/for/${prConfig.sourceBranch}`
    );
  }
}

async function updatePullRequestTitle(
  number: number,
  gerritChangeID: string,
  prTitle: string
): Promise<void> {
  try {
    await client.setCommitMessage(
      number,
      `${prTitle}\n\nChange-Id: ${gerritChangeID}\n`
    );
  } catch (err) {
    logger.error(
      { err },
      `Can't set pull-request-title ${prTitle} as commit-msg for change ${gerritChangeID}/${number}`
    );
  }
}

async function updatePullRequestBody(
  changeId: number,
  prBody: string
): Promise<void> {
  const prBodyExists = await checkForExistingMessage(
    changeId,
    prBody,
    TAG_PULL_REQUEST_BODY
  );
  if (!prBodyExists) {
    await client.addMessage(changeId, prBody, TAG_PULL_REQUEST_BODY);
  }
}

async function checkForExistingMessage(
  changeId: number,
  newMessage: string,
  msgType: string | null
): Promise<boolean> {
  const newMsg = newMessage.trim(); //the last \n was removed from gerrit after the comment was added...
  const messages = await client.getMessages(changeId);
  return (
    messages.find(
      (existingMsg) =>
        (msgType === null || msgType === existingMsg.tag) &&
        existingMsg.message.includes(newMsg)
    ) !== undefined
  );
}

export async function getBranchPr(branchName: string): Promise<Pr | null> {
  const change = (await findOwnPr({ branchName, state: 'open' })).pop();
  if (change) {
    return mapGerritChangeToPr(change);
  }
  return null;
}

export function getPrList(): Promise<Pr[]> {
  return findOwnPr({ branchName: '' }).then((res) =>
    res.map((change) => mapGerritChangeToPr(change))
  );
}

export async function mergePr(config: MergePRConfig): Promise<boolean> {
  logger.info(
    `mergePr(${config.id}, ${config.branchName!}, ${config.strategy!})`
  );
  try {
    const change = await client.submitChange(config.id);
    return change.status === 'MERGED';
  } catch (err) {
    if (err.statusCode === 409) {
      logger.warn(
        { err },
        "Can't submit the change, because the submit rule doesn't allow it."
      );
      return false;
    }
    throw err;
  }
}

/**
 * BranchStatus for Gerrit: TODO: what should we check here? How can this work with: automergeType: "branch"
 * @param branchName
 */
export async function getBranchStatus(
  branchName: string
): Promise<BranchStatus> {
  logger.debug(`getBranchStatus(${branchName})`);
  const changes = await findOwnPr({ state: 'open', branchName }, true);
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
  context: string | null | undefined
): Promise<BranchStatus | null> {
  const { labelName } = mapBranchStateContextToLabel(context);
  if (labelName) {
    const change = (await findOwnPr({ branchName, state: 'open' }, true)).pop();
    if (change) {
      const labelRes = change.labels?.[labelName];
      if (labelRes) {
        if (labelRes.approved) {
          return 'green';
        }
        if (labelRes.rejected) {
          return 'red';
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
  branchStatusConfig: BranchStatusConfig
): Promise<void> {
  const { labelName, label } = mapBranchStateContextToLabel(
    branchStatusConfig.context
  );
  const labelValue =
    label && mapBranchStatusToLabel(branchStatusConfig.state, label);
  if (labelName && labelValue) {
    const pr = await getBranchPr(branchStatusConfig.branchName);
    if (pr === null) {
      return Promise.resolve();
    }
    await client.setLabel(pr.number, labelName, labelValue);
  }
  return Promise.resolve();
}

function mapBranchStateContextToLabel(context: string | null | undefined): {
  labelName?: string;
  label?: GerritLabelTypeInfo;
} {
  let labelName;
  switch (context) {
    case 'renovate/stability-days':
      labelName = config.labelMappings?.stabilityDaysLabel;
      break;
    case 'renovate/merge-confidence':
      labelName = config.labelMappings?.mergeConfidenceLabel;
      break;
  }
  if (labelName && config.labels[labelName]) {
    return {
      labelName,
      label: config.labels[labelName],
    };
  }
  return {};
}

export function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string
): Promise<string | null> {
  const repo = repoName ?? config.repository ?? 'All-Projects';
  const branch = branchOrTag ?? config.head ?? 'HEAD';
  return client.getFile(repo, branch, fileName);
}

export async function getJsonFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string
): Promise<any | null> {
  const raw = (await getRawFile(fileName, repoName, branchOrTag)) as string;
  return JSON5.parse(raw);
}

export function getRepoForceRebase(): Promise<boolean> {
  return Promise.resolve(false);
}

export async function addReviewers(
  number: number,
  reviewers: string[]
): Promise<void> {
  for (const reviewer of reviewers) {
    await client.addReviewer(number, reviewer);
  }
}

/**
 * add "CC" (only one possible)
 */
export async function addAssignees(
  number: number,
  assignees: string[]
): Promise<void> {
  if (assignees.length) {
    await client.addAssignee(number, assignees[0]);
  }
}

export async function ensureComment(
  ensureComment: EnsureCommentConfig
): Promise<boolean> {
  logger.debug(
    `ensureComment(${ensureComment.number}, ${ensureComment.topic!}, ${
      ensureComment.content
    })`
  );
  const commentExists = await checkForExistingMessage(
    ensureComment.number,
    ensureComment.content,
    ensureComment.topic
  );
  if (commentExists) {
    return true;
  }
  await client.addMessage(
    ensureComment.number,
    ensureComment.content,
    ensureComment.topic ?? undefined
  );
  return true;
}

export function massageMarkdown(prBody: string): string {
  //TODO: do more Gerrit specific replacements?
  return smartTruncate(smartLinks(prBody), 16384) //TODO: check the real gerrit limit (max. chars)
    .replace(regEx(/Pull Request(s)?/g), 'Change-Request$1')
    .replace(regEx(/\bPR(s)?\b/g), 'Change-Request$1')
    .replace(regEx(/<\/?summary>/g), '**')
    .replace(regEx(/<\/?details>/g), '')
    .replace(regEx(/&#8203;/g), '') //remove zero-width-space not supported in gerrit-markdown
    .replace(
      'close this Change-Request unmerged.',
      'abandon or down vote this Change-Request with -2.'
    )
    .replace('Branch creation', 'Change creation')
    .replace(
      'Close this Change-Request',
      'Down-vote this Change-Request with -2'
    )
    .replace(
      'you tick the rebase/retry checkbox',
      'add "rebase!" at the beginning of the commit message.'
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
    | EnsureCommentRemovalConfigByContent
): Promise<void> {
  return Promise.resolve();
}

export function ensureIssueClosing(title: string): Promise<void> {
  return Promise.resolve();
}

export function ensureIssue(
  issueConfig: EnsureIssueConfig
): Promise<EnsureIssueResult | null> {
  return Promise.resolve(null);
}

export function findIssue(title: string): Promise<Issue | null> {
  return Promise.resolve(null);
}

export function getIssueList(): Promise<Issue[]> {
  return Promise.resolve([]);
}

export function getVulnerabilityAlerts(): Promise<VulnerabilityAlert[]> {
  return Promise.resolve([]);
}
