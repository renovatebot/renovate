import type { PackageFile } from '../../../modules/manager/types';
import type { RepoInitConfig } from '../../../workers/repository/init/types';
import type { ExtractResult } from '../../../workers/repository/process/extract-update';
import type { GitConflictsCache } from '../../git/types';

export interface BaseBranchCache {
  sha: string; // branch commit sha
  configHash: string; // object hash of config
  packageFiles: Record<string, PackageFile[]>; // extract result
}

export interface BranchUpgradeCache {
  currentDigest?: string;
  currentValue?: string;
  datasource?: string;
  depName?: string;
  fixedVersion?: string;
  currentVersion?: string;
  packageName?: string;
  newDigest?: string;
  newValue?: string;
  newVersion?: string;
  sourceUrl?: string;
}

export interface BranchCache {
  automerge: boolean;
  branchName: string;
  isModified: boolean;
  prNo: number | null;
  sha: string | null;
  parentSha: string | null;
  upgrades: BranchUpgradeCache[];
}

export interface OnboardingBranchCache {
  isOnboarded: boolean;
  parentSha?: string;
  sha: string;
  extractedDependencies?: ExtractResult;
}

export interface RepoCacheData {
  configFileName?: string;
  semanticCommits?: 'enabled' | 'disabled';
  branches?: BranchCache[];
  init?: RepoInitConfig;
  scan?: Record<string, BaseBranchCache>;
  lastPlatformAutomergeFailure?: string;
  platform?: {
    github?: Record<string, unknown>;
  };
  gitConflicts?: GitConflictsCache;
  prComments?: Record<number, Record<string, string>>;
  onboardingBranch?: OnboardingBranchCache;
}

export interface RepoCacheRecord {
  repository: string;
  revision: number;
  payload: string;
  hash: string;
}

export interface RepoCache {
  load(): Promise<void>;
  save(): Promise<void>;
  getData(): RepoCacheData;
}
