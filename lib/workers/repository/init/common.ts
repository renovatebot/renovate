import { RenovateConfig } from '../../../config';

export type RepoConfigError = {
  validationError: string;
  validationMessage: string;
};

export interface RepoInitConfig {
  defaultBranchSha?: string;
  configFileName?: string;
  configFileParsed?: any;
  configFileError?: RepoConfigError;
  resolvedConfig?: RenovateConfig;
}
