import type {
  RepositoryCacheConfig,
  RepositoryCacheType,
  UpdateType,
} from '../../../config/types';
import type { PackageFile } from '../../../modules/manager/types';
import type { RepoInitConfig } from '../../../workers/repository/init/types';
import type { PrBlockedBy } from '../../../workers/types';

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
  depType?: string;
  displayPending?: unknown;
  fixedVersion?: string;
  currentVersion?: string;
  packageName?: string;
  newDigest?: string;
  newValue?: string;
  newVersion?: string;
  sourceUrl?: string;
  packageFile?: string;
  remediationNotPossible?: unknown;
  updateType?: UpdateType;
}

export interface OnboardingBranchCache {
  defaultBranchSha: string;
  onboardingBranchSha: string;
  isConflicted: boolean;
  isModified: boolean;
  configFileName?: string;
  configFileParsed?: string;
}

export interface ReconfigureBranchCache {
  reconfigureBranchSha: string;
  isConfigValid: boolean;
}

export interface PrCache {
  /**
   * Fingerprint of the PR body
   */
  fingerprint?: string; // Defunct
  bodyFingerprint: string; // Actively used
  /**
   * last PR modified ISO timestamp
   */
  lastEdited: string;
}

export interface BranchCache {
  /**
   * Whether this branch has automerge enabled
   */
  automerge?: boolean;
  /**
   * Name of base branch
   */
  baseBranch?: string;
  /**
   * The base branch's most recent commit SHA
   */
  baseBranchSha?: string | null;
  /**
   * Hash of the manager fingerprints and the filtered update branch config
   */
  branchFingerprint?: string; // Defunct
  commitFingerprint?: string; // Actively used
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
  sha?: string | null;
  /**
   * Details on the dependency upgrades that have been applied in this branch
   */
  upgrades: BranchUpgradeCache[];
  /**
   * Object that has PR info
   */
  prCache?: PrCache | null;

  /**
   * Dependency dashboard information
   */
  prBlockedBy?: PrBlockedBy;
  prTitle?: string;
  result?: string;
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
  onboardingBranchCache?: OnboardingBranchCache;
  reconfigureBranchCache?: ReconfigureBranchCache;
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
