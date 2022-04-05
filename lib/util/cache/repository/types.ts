import type { PackageFile } from '../../../modules/manager/types';
import type {
  GhRestPr,
  ListCache,
} from '../../../modules/platform/github/types';
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
  isModified: boolean;
  prNo: number | null;
  sha: string | null;
  parentSha: string | null;
  upgrades: BranchUpgradeCache[];
}

export interface GithubGraphqlPageCache {
  pageLastResizedAt: string;
  pageSize: number;
}

export interface Cache {
  configFileName?: string;
  semanticCommits?: 'enabled' | 'disabled';
  branches?: BranchCache[];
  repository?: string;
  revision?: number;
  init?: RepoInitConfig;
  scan?: Record<string, BaseBranchCache>;
  lastPlatformAutomergeFailure?: string;
  platform?: {
    github?: {
      graphqlPageCache?: Record<string, GithubGraphqlPageCache>;
      prCache?: ListCache<GhRestPr>;
    };
  };
  gitConflicts?: GitConflictsCache;
  prComments?: Record<number, Record<string, string>>;
}
