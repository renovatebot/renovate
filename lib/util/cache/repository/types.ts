import type { PackageFile } from '../../../manager/types';
import type { RepoInitConfig } from '../../../workers/repository/init/types';

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
  lookupName?: string;
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

export interface Cache {
  branches?: BranchCache[];
  repository?: string;
  revision?: number;
  init?: RepoInitConfig;
  scan?: Record<string, BaseBranchCache>;
}
