export type RepoConfigError = {
  validationError: string;
  validationMessage: string;
};

export interface RepoFileConfig {
  fileName?: string;
  config?: any;
  error?: RepoConfigError;
}
