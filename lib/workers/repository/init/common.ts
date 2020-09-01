export type RepoConfigError = {
  validationError: string;
  validationMessage: string;
};

export type RepoFileConfig = {
  fileName?: string;
  config?: any;
  error?: RepoConfigError;
};
