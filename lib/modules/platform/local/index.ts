import type { BranchStatus } from '../../../types';
import type {
  Issue,
  PlatformParams,
  PlatformResult,
  Pr,
  RepoResult,
} from '../types';

export const id = 'local';

export function initPlatform(params: PlatformParams): Promise<PlatformResult> {
  return Promise.resolve({
    dryRun: 'lookup',
    endpoint: 'local',
    persistRepoData: true,
    requireConfig: 'optional',
  });
}

export function getRepos(): Promise<string[]> {
  return Promise.resolve([]);
}

export function initRepo(): Promise<RepoResult> {
  return Promise.resolve({
    defaultBranch: '',
    isFork: false,
    repoFingerprint: '',
  });
}

export function getRepoForceRebase(): Promise<boolean> {
  return Promise.resolve(false);
}

export function findIssue(): Promise<null> {
  return Promise.resolve(null);
}

export function getIssueList(): Promise<Issue[]> {
  return Promise.resolve([]);
}

export function getRawFile(): Promise<string | null> {
  return Promise.resolve(null);
}

export function getJsonFile(): Promise<Record<string, unknown> | null> {
  return Promise.resolve(null);
}

export function getPrList(): Promise<Pr[]> {
  return Promise.resolve([]);
}

export function ensureIssueClosing(): Promise<void> {
  return Promise.resolve();
}

export function ensureIssue(): Promise<null> {
  return Promise.resolve(null);
}

export function massageMarkdown(input: string): string {
  return input;
}

export function updatePr(): Promise<void> {
  return Promise.resolve();
}

export function mergePr(): Promise<boolean> {
  return Promise.resolve(false);
}

export function addReviewers(): Promise<void> {
  return Promise.resolve();
}

export function addAssignees(): Promise<void> {
  return Promise.resolve();
}

export function createPr(): Promise<null> {
  return Promise.resolve(null);
}

export function deleteLabel(): Promise<void> {
  return Promise.resolve();
}

export function setBranchStatus(): Promise<void> {
  return Promise.resolve();
}

export function getBranchStatus(): Promise<BranchStatus> {
  return Promise.resolve('red');
}

export function getBranchStatusCheck(): Promise<null> {
  return Promise.resolve(null);
}

export function ensureCommentRemoval(): Promise<void> {
  return Promise.resolve();
}

export function ensureComment(): Promise<boolean> {
  return Promise.resolve(false);
}

export function getPr(): Promise<null> {
  return Promise.resolve(null);
}

export function findPr(): Promise<null> {
  return Promise.resolve(null);
}

export function getBranchPr(): Promise<null> {
  return Promise.resolve(null);
}
