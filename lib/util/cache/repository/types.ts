import type {
  RepositoryCacheConfig,
  RepositoryCacheType,
} from '../../../config/types';
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
  /**
   *Whether this branch has automerge enabled
   */
  automerge: boolean;
  /**
   * Hash of the manager fingerprints and the update branch config
   */
  branchFingerprint?: string;
  /**
   * Branch name
   */
  branchName: string;
  /**
   * Whether a person not listed in gitIgnoredAuthors updated the branch.
   */
  isModified: boolean;
  /**
   * Parent commit of branch sha
   */
  parentSha: string | null;
  /**
   * Pr nunber of PR created from this branch
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
