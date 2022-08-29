import type { PackageFile } from '../../../modules/manager/types';
import type { RepoInitConfig } from '../../../workers/repository/init/types';
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
  baseBranch: string | undefined;
  isModified: boolean;
  prNo: number | null;
  sha: string | null;
  parentSha: string | null;
  upgrades: BranchUpgradeCache[];
  branchFingerprint?: string;
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
  modified?: boolean; // undefined until RepoCache.save() is called
}

export interface RepoCacheRecordV10 extends RepoCacheData {
  repository?: string;
  revision?: number;
}

export interface RepoCacheRecordV11 {
  repository: string;
  revision: number;
  data: RepoCacheData;
}

export interface RepoCacheRecordV12 {
  repository: string;
  revision: number;
  payload: string;
  hash: string;
}

export type RepoCacheRecord = RepoCacheRecordV12;

export interface RepoCache {
  load(): Promise<void>;
  save(): Promise<void>;
  getData(): RepoCacheData;
}
