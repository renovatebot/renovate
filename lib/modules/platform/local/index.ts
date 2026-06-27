import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import type { BranchStatus } from '../../../types/index.ts';
import { rawExec } from '../../../util/exec/common.ts';
import type {
  Issue,
  PlatformParams,
  PlatformResult,
  Pr,
  RepoResult,
} from '../types.ts';

export const id = 'local';
export const experimental = true;

export function initPlatform(params: PlatformParams): Promise<PlatformResult> {
  // Default to `lookup`, but allow opting in to `extract` or `full`.
  // `extract` stops after dependency extraction.
  // `full` additionally computes the file changes Renovate would make and
  // applies them to the working directory (so the result can be inspected),
  // but never commits, pushes, or opens a PR.
  // Other values (such as `null`, which would imply committing changes) fall
  // back to `lookup`.
  const dryRun =
    params.dryRun === 'extract' || params.dryRun === 'full'
      ? params.dryRun
      : 'lookup';
  return Promise.resolve({
    dryRun,
    endpoint: 'local',
    persistRepoData: true,
    requireConfig: 'optional',
  });
}

export function getRepos(): Promise<string[]> {
  return Promise.resolve([]);
}

/**
 * When running in `dryRun=full`, Renovate writes the updated package files to
 * the working directory so the proposed changes can be inspected. Because the
 * local platform operates on the user's current directory, refuse to run if a
 * git work tree is present and dirty, so that every change Renovate makes stays
 * revertable via `git checkout .`. When the directory is not a git repository
 * we cannot offer that safety net, so warn instead.
 */
async function ensureRevertableWorkTree(): Promise<void> {
  if (GlobalConfig.get('dryRun') !== 'full') {
    return;
  }
  const cwd = GlobalConfig.get('localDir');
  let status: string;
  try {
    status = (await rawExec('git status --porcelain', { cwd })).stdout;
  } catch {
    logger.warn(
      'Running `--platform=local --dry-run=full` outside a git repository. Renovate will modify files in the current directory and these changes cannot be reverted automatically.',
    );
    return;
  }
  if (status.trim()) {
    throw new Error(
      'The git work tree has uncommitted changes. Commit or stash them before running `--platform=local --dry-run=full`, so that the changes Renovate makes can be reverted with `git checkout .`.',
    );
  }
}

export async function initRepo(): Promise<RepoResult> {
  await ensureRevertableWorkTree();
  return {
    defaultBranch: '',
    isFork: false,
    repoFingerprint: '',
  };
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

/**
 * Unsed, no Dashboard
 */
export function maxBodyLength(): number {
  return Infinity;
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
