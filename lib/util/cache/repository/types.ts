import type {
  RepositoryCacheConfig,
  RepositoryCacheType,
} from '../../../config/types';
import type { PackageFile } from '../../../modules/manager/types';
import type { RepoInitConfig } from '../../../workers/repository/init/types';

export interface BaseBranchCache {
  sha: string; // branch commit sha
  configHash: string; // object hash of config
  extractionFingerprints: Record<string, string | undefined>; // matching manager fingerprints
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

export interface PrCache {
  fingerprint: string;
  /**
   * last PR modified ISO timestamp
   */
  lastEdited: string;
}

export interface BranchCache {
  /**
   * Whether this branch has automerge enabled
   */
  automerge: boolean;
  /**
   * Name of base branch
   */
  baseBranch: string;
  /**
   * The base branch's most recent commit SHA
   */
  baseBranchSha: string | null;
  /**
   * Hash of the manager fingerprints and the filtered update branch config
   */
  branchFingerprint?: string;
  /**
   * Branch name
   */
  branchName: string;
  /**
   * Whether the update branch is behind base branh
   */
  isBehindBase?: boolean;
  /**
   * Whether the update branch is in conflict with base branch
   */
  isConflicted?: boolean;
  /**
   * Whether a person not listed in gitIgnoredAuthors updated the branch.
   */
  isModified?: boolean;
  /**
   *
   */
  pristine?: boolean;
  /**
   * Pr number of PR created from this branch
   */
  prNo: number | null;
  /**
   * The branch's most recent commit SHA
   */
  sha: string | null;
  /**
   * Details on the dependency upgrades that have been applied in this branch
   */
  upgrades: BranchUpgradeCache[];
  /**
   * Object that has PR info
   */
  prCache?: PrCache | null;
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
  prComments?: Record<number, Record<string, string>>;
}

export interface RepoCache {
  load(): Promise<void>;
  save(): Promise<void>;
  getData(): RepoCacheData;
  isModified(): boolean | undefined;
}

export interface RepoCacheConfig {
  repository?: string;
  repositoryCache?: RepositoryCacheConfig;
  repositoryCacheType?: RepositoryCacheType;
  repoFingerprint: string;
}
