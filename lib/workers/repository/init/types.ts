import type {
  RenovateConfig,
  RepoGlobalConfig,
} from '../../../config/types.ts';

/**
 * Internal handoff config between global and repository init stages.
 * Carries the repositories[] object-entry config separately so preset
 * resolution happens in the correct order.
 *
 * Also extends `RepoGlobalConfig` directly to carry fields like `allowedCommands`,
 * `binarySource`, and `dryRun` that `RenovateConfig` does not include.
 */
export interface RepositoryWorkerConfig
  extends RenovateConfig, RepoGlobalConfig {
  repositoryEntryConfig?: RenovateConfig;
}

export interface RepoConfigError {
  validationError: string;
  validationMessage: string;
}

export interface RepoFileConfig {
  configFileName?: string;
  configFileParsed?: any;
  configFileParseError?: RepoConfigError;
}

export interface RepoInitConfig {
  defaultBranchSha?: string;
  repoConfig?: RepoFileConfig;
}
