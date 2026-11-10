import type { WithDefaults } from '../../../config/defaults.ts';
import type {
  RenovateConfigFile,
  RepoDefaultedConfigKey,
  RepoGlobalConfig,
} from '../../../config/types.ts';

/**
 * Internal handoff config between global and repository init stages.
 * Carries the repositories[] object-entry config separately so preset
 * resolution happens in the correct order.
 *
 * Also extends `RepoGlobalConfig` directly to carry fields like `allowedCommands`,
 * `binarySource`, and `dryRun` that `RenovateConfigFile` does not include.
 */
export interface RepositoryWorkerConfig
  extends RenovateConfigFile, RepoGlobalConfig {
  repositoryEntryConfig?: RenovateConfigFile;
}

/**
 * The {@link RepositoryWorkerConfig} which `getRepositoryConfig()` gives the repository worker, which keeps the defaults that `parseConfigs()` gave the global config.
 */
export type ResolvedRepositoryWorkerConfig = WithDefaults<
  RepositoryWorkerConfig,
  RepoDefaultedConfigKey
>;

export interface RepoConfigError {
  validationError: string;
  validationMessage: string;
}

export interface RepoFileConfig {
  configFileName?: string;
  configFileParsed?: RenovateConfigFile;
  configFileParseError?: RepoConfigError;
}

export interface RepoInitConfig {
  defaultBranchSha?: string;
  repoConfig?: RepoFileConfig;
}
