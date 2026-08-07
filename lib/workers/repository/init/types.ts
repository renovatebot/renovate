import type {
  GlobalToolSettingsOptions,
  RenovateConfig,
  RepoGlobalConfig,
  RepoToolSettingsOptions,
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
  // `RenovateConfig` and `RepoGlobalConfig` declare `toolSettings` with
  // different (repo-only vs global-only) shapes; this combines both since
  // this handoff config can carry either.
  toolSettings?: GlobalToolSettingsOptions & RepoToolSettingsOptions;
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
