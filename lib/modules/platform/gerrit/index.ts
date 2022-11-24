import { atob } from 'buffer';
import JSON5 from 'json5';
import { REPOSITORY_ARCHIVED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { VulnerabilityAlert } from '../../../types';
import { BranchStatus } from '../../../types';
import * as git from '../../../util/git';
import type { CommitFilesConfig, CommitSha } from '../../../util/git/types';
import { GerritHttp, setBaseUrl } from '../../../util/http/gerrit';
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
import type {
  GerritAccountInfo,
  GerritBranchInfo,
  GerritChange,
  GerritChangeMessageInfo,
  GerritFindPRConfig,
  GerritProjectInfo,
} from './types';
import { TAG_PULL_REQUEST_BODY } from './types';
import {
  extractSourceBranch,
  getGerritRepoUrl,
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
  approveAvailable: boolean;
} = {
  approveAvailable: true,
};

let gerritUsername = '';

const gerritHttp = new GerritHttp();

export function setConfig(newConfig: typeof config): void {
  config = { ...newConfig };
}

export function initPlatform({
  endpoint,
  username,
  password,
}: PlatformParams): Promise<PlatformResult> {
  logger.info(`initPlatform(${endpoint!}, ${username!})`);
  if (!endpoint) {
    throw new Error('Init: You must configure a Gerrit Server endpoint');
  }
  if (!(username && password)) {
    throw new Error(
      'Init: You must configure a Gerrit Server username/password'
    );
  }
  gerritUsername = username;
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
  const res = await gerritHttp.getJson<string[]>(
    'a/projects/?type=CODE&state=ACTIVE',
    {}
  );
  return Promise.resolve(Object.keys(res.body));
}

/**
 * Clone repository to local directory and install the gerrit-commit hook
 * @param config
 */
export async function initRepo({
  repository,
  endpoint,
  gitUrl,
}: RepoParams): Promise<RepoResult> {
  logger.info(`initRepo(${repository}, ${endpoint!}, ${gitUrl!})`);
  const projectInfo = await gerritHttp.getJson<GerritProjectInfo>(
    `a/projects/${encodeURIComponent(repository)}`
  );
  if (projectInfo.body.state !== 'ACTIVE') {
    throw new Error(REPOSITORY_ARCHIVED);
  }
  const branchInfo = await gerritHttp.getJson<GerritBranchInfo>(
    `a/projects/${encodeURIComponent(repository)}/branches/HEAD`
  );
  config = {
    repository,
    head: branchInfo.body.revision,
    config: projectInfo.body,
    approveAvailable: projectInfo.body.labels
      ? projectInfo.body.labels['Code-Review'] !== undefined
      : false,
  };
  const baseUrl = endpoint ?? defaults.endpoint!;
  const url = getGerritRepoUrl(repository, baseUrl);

  // Initialize Git storage
  await git.initRepo({ url });
  await git.syncGit(); //if not called the hook can be removed later...

  // Install Gerrit-Commit-Hook
  const commitHookData = await gerritHttp.get('tools/hooks/commit-msg');
  await git.installHook('commit-msg', commitHookData.body);

  //abandon "open" and "rejected" changes at startup
  const rejectedChanges = await findOwnPr({
    branchName: '',
    state: 'open',
    label: '-2',
  });
  for (const change of rejectedChanges) {
    await abandonChange(change._number);
  }

  //create local and fake-origin branches for each existing change
  const openChanges = await findOwnPr({ branchName: '', state: 'open' });
  for (const change of openChanges) {
    const branchName = extractSourceBranch(change);
    if (branchName === undefined) {
      continue;
    }
    const currentGerritPatchset = change.revisions![change.current_revision!];
    const remoteRefSpec = `${currentGerritPatchset.ref}`;
    const localRefSpec = `refs/heads/${branchName}`;
    await git.fetchRevSpec(`${remoteRefSpec}:${localRefSpec}`);
    //TODO/HACK: we fetch the current changeset with the name "origin/" as prefix too. then most util/git/* cmds should work as expected (like isBranchConflicted, isBranchModified)...
    await git.fetchRevSpec(`${remoteRefSpec}:refs/heads/origin/${branchName}`);
    await git.registerBranch(
      branchName,
      currentGerritPatchset.uploader.username !== gerritUsername
    );
  }

  const repoConfig: RepoResult = {
    defaultBranch: config.head!,
    isFork: false, //TODO: wozu dient das?
    repoFingerprint: repoFingerprint('', url), //TODO: understand the semantic? what cache could be stale/wrong?
  };
  return repoConfig;
}

/**
 * in Gerrit: "Searching Changes"
 *  /changes/?q=$QUERY
 *  QUERY="owner:self+status:$STATE"
 */
async function findOwnPr(
  findPRConfig: GerritFindPRConfig,
  refreshCache?: boolean
): Promise<GerritChange[]> {
  const filterTag =
    findPRConfig.branchName === ''
      ? undefined
      : `hashtag:sourceBranch-${findPRConfig.branchName}`;
  const filterTargetBranch =
    findPRConfig.targetBranch && `branch:${findPRConfig.targetBranch}`;
  const filterState = mapPrStateToGerritFilter(findPRConfig.state);
  const reviewLabel =
    findPRConfig.label && `label:Code-Review=${findPRConfig.label}`;
  const filter = [
    'owner:self',
    'project:' + config.repository!,
    filterState,
    filterTag,
    filterTargetBranch,
    reviewLabel,
  ];
  const requestDetails = [
    'SUBMITTABLE',
    'CHECK',
    'MESSAGES',
    'DETAILED_ACCOUNTS',
    'LABELS',
    'CURRENT_ACTIONS',
    'CURRENT_REVISION', //get RevisionInfo::ref to fetch
  ];
  const changes = await gerritHttp.getJson<GerritChange[]>(
    `a/changes/?q=` +
      filter.filter((s) => typeof s !== 'undefined').join('+') +
      requestDetails.map((det) => '&o=' + det).join(''),
    { useCache: !refreshCache }
  );
  logger.info(`findOwnPr(${filter.join(', ')}) => ${changes.body.length}`);
  return changes.body;
}

export async function findPr(
  findPRConfig: FindPRConfig,
  refreshCache?: boolean
): Promise<Pr | null> {
  const change = await findOwnPr(findPRConfig, refreshCache).then((res) =>
    res.pop()
  );
  return change ? mapGerritChangeToPr(change) : null;
}

export async function getPr(number: number): Promise<Pr | null> {
  try {
    const changes = await gerritHttp.getJson<GerritChange>(
      `a/changes/${number}`
    );
    return Promise.resolve(mapGerritChangeToPr(changes.body));
  } catch (err) {
    if (err.statusCode === 404) {
      return Promise.resolve(null);
    }
    throw err;
  }
}

export async function updatePr(prConfig: UpdatePrConfig): Promise<void> {
  logger.info(`updatePr(${prConfig.number}, ${prConfig.prTitle})`);
  const change = await gerritHttp
    .getJson<GerritChange>(`a/changes/${prConfig.number}`)
    .then((r) => r.body);
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
  if (prConfig.platformOptions?.gerritAutoApprove && config.approveAvailable) {
    await approveChange(prConfig.number);
  }
  if (prConfig.state && prConfig.state === 'closed') {
    await abandonChange(prConfig.number);
  }
}

//Abandon Change
async function abandonChange(changeNumber: number): Promise<void> {
  await gerritHttp.postJson(`a/changes/${changeNumber}/abandon`);
}

export async function createPr(prConfig: CreatePRConfig): Promise<Pr | null> {
  logger.info(
    `createPr(${prConfig.sourceBranch}, ${prConfig.prTitle}, ${
      prConfig.labels?.toString() ?? ''
    })`
  );
  const pr = await findOwnPr(
    {
      branchName: prConfig.sourceBranch,
      targetBranch: prConfig.targetBranch,
      state: 'open',
    },
    true
  ).then((res) => res.pop());
  if (pr) {
    await updatePullRequestBody(pr._number, prConfig.prBody);
    if (
      prConfig.platformOptions?.gerritAutoApprove &&
      config.approveAvailable
    ) {
      await approveChange(pr._number);
    }
    return getPr(pr._number);
  } else {
    // TODO: Problem: what happened?
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
    await gerritHttp.putJson(`a/changes/${number}/message`, {
      body: {
        message: `${prTitle}\n\nChange-Id: ${gerritChangeID}\n`,
      },
    });
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
    await gerritHttp.postJson(
      `a/changes/${changeId}/revisions/current/review`,
      { body: { message: prBody, tag: TAG_PULL_REQUEST_BODY } }
    );
  }
}

async function checkForExistingMessage(
  changeId: number,
  newMessage: string,
  msgType: string | null
): Promise<boolean> {
  const newMsg = newMessage.trim(); //TODO HACK: the last \n was removed from gerrit after the comment was added?!?
  const messages = await gerritHttp.getJson<GerritChangeMessageInfo[]>(
    `a/changes/${changeId}/messages`,
    { useCache: false }
  );
  return (
    messages.body.find(
      (existingMsg) =>
        (msgType === null || msgType === existingMsg.tag) &&
        existingMsg.message.includes(newMsg)
    ) !== undefined
  );
}

//TODO: we should only give +2 if "automerge was enabled and the code-review label is available"
// AND renovate was the uploader of this revision!!!
async function approveChange(changeId: number): Promise<void> {
  const isApproved = await checkForCodeReviewLabel(changeId, 'approved');
  if (!isApproved) {
    await gerritHttp.postJson(
      `a/changes/${changeId}/revisions/current/review`,
      { body: { labels: { 'Code-Review': +2 } } }
    );
  }
}

/**
 * check if the Label "Code-Review" not exists or is not approved
 * @param changeId
 * @param labelResult
 */
async function checkForCodeReviewLabel(
  changeId: number,
  labelResult: 'approved' | 'rejected'
): Promise<boolean> {
  const change = await gerritHttp.getJson<GerritChange>(
    `a/changes/${changeId}/detail`,
    { useCache: false }
  );
  const reviewLabels = change?.body.labels && change.body.labels['Code-Review'];
  return reviewLabels === undefined || reviewLabels[labelResult] !== undefined;
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
    const change = await gerritHttp.postJson<GerritChange>(
      `a/changes/${config.id}/submit`
    );
    return change.body.status === 'MERGED';
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
  logger.info(`getBranchStatus(${branchName})`);
  const changes = await findOwnPr({ state: 'open', branchName }, true);
  if (changes.length > 0) {
    const allSubmittable =
      changes.filter((change) => change.submittable === true).length ===
      changes.length;
    if (allSubmittable) {
      return BranchStatus.green;
    }
    const hasProblems =
      changes.filter((change) => change.problems.length > 0).length > 0;
    if (hasProblems) {
      return BranchStatus.red;
    }
  }
  return BranchStatus.yellow; //TODO: after create a new change it's not visible thru rest-api for some time..(eventual consistency)
}

/**
 * @param branchName
 * @param context renovate/stability-days || ...
 * TODO: what can we do here? Read/Store the setStability/setConfidence information as comment/message with special tag?
 */
export function getBranchStatusCheck(
  branchName: string,
  context: string | null | undefined
): Promise<BranchStatus | null> {
  return getBranchStatus(branchName);
}

/**
 * context === "renovate/stability-days" + state === "green"
 * @param branchStatusConfig
 * TODO: what can we do here? See getBranchStatusCheck
 */
export function setBranchStatus(
  branchStatusConfig: BranchStatusConfig
): Promise<void> {
  return Promise.resolve();
}

//TODO: where to get the presets? Branch? Parent-Project? try both...?
export async function getRawFile(
  fileName: string,
  repoName?: string,
  branchOrTag?: string
): Promise<string | null> {
  const repo = repoName ?? config.repository ?? 'All-Projects';
  const branch = branchOrTag ?? config.head ?? 'HEAD';
  const base64Content = await gerritHttp.get(
    `a/projects/${encodeURIComponent(
      repo
    )}/branches/${branch}/files/${encodeURIComponent(fileName)}/content`
  );
  return Promise.resolve(atob(base64Content.body));
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
  return Promise.resolve(true);
}

export async function addReviewers(
  number: number,
  reviewers: string[]
): Promise<void> {
  for (const reviewer of reviewers) {
    await gerritHttp.postJson(`a/changes/${number}/reviewers`, {
      body: { reviewer },
    });
  }
}

/**
 * add "CC" (only one possible)
 */
export async function addAssignees(
  number: number,
  assignees: string[]
): Promise<void> {
  await gerritHttp.putJson<GerritAccountInfo>(`a/changes/${number}/assignee`, {
    body: { assignee: assignees[0] },
  });
}

export async function ensureComment(
  ensureComment: EnsureCommentConfig
): Promise<boolean> {
  logger.info(
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
  await gerritHttp.postJson(
    `a/changes/${ensureComment.number}/revisions/current/review`,
    {
      body: {
        message: ensureComment.content,
        tag: ensureComment.topic,
      },
    }
  );
  return true;
}

export function massageMarkdown(prBody: string): string {
  //TODO: convert to Gerrit-Markdown?
  return smartTruncate(smartLinks(prBody), 16384);
}

/**
 * IMPORTANT: This acts as a wrapper to allow reuse of existing change-id in the commit message.
 * @param commit
 */
export async function commitFiles(
  commit: CommitFilesConfig
): Promise<CommitSha | null> {
  logger.info(`commitFiles(${commit.branchName}, ${commit.platformCommit!})`);
  //gerrit-commit, try to find existing open change to reuse the gerrit Change-Id
  const existingChange = await findOwnPr({
    targetBranch: commit.targetBranch,
    branchName: commit.branchName,
    state: 'open',
  });
  const change = existingChange.pop();
  let hasChanges = true;
  if (change) {
    const origMsg =
      typeof commit.message === 'string' ? [commit.message] : commit.message;
    commit.message = [...origMsg, `Change-Id: ${change.change_id}`];
  }
  const commitResult = await git.prepareCommit(commit);
  if (commitResult) {
    const { commitSha } = commitResult;
    if (change?.revisions && change.current_revision) {
      const fetchRefSpec = change.revisions[change.current_revision].ref;
      await git.fetchRevSpec(fetchRefSpec); //fetch current ChangeSet for git diff
      hasChanges = await git.hasDiff('HEAD', 'FETCH_HEAD'); //avoid empty patchsets
    }
    if (hasChanges || commit.force) {
      const pushResult = await git.pushCommit({
        sourceRef: commit.branchName,
        targetRef: `refs/for/${commit.targetBranch!}%t=sourceBranch-${
          commit.branchName
        }`,
        files: commit.files,
      });
      if (pushResult) {
        //TODO: check why this was done by original commitAndPush method..
        await git.registerBranch(commit.branchName, false, commitSha);
        if (change && config.approveAvailable && wasApprovedByMe(change)) {
          //change was the old change before commit/push. we need to approve again only if it was previously approved from renovate only
          await approveChange(change._number);
        }
        return commitSha;
      }
    }
    return commitSha;
  } else {
    //empty commit, no changes in this Gerrit-Change
    return null;
  }
}

function wasApprovedByMe(change: GerritChange): boolean | undefined {
  return (
    change.labels?.['Code-Review'].approved &&
    change.labels['Code-Review'].approved.username === gerritUsername
  );
}

export function deleteLabel(number: number, label: string): Promise<void> {
  //if (pr.labels?.includes(config.rebaseLabel!)) {...
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
