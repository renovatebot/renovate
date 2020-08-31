export type RepoConfigError = {
  validationError: string;
  validationMessage: string;
};

export type RepoConfig = {
  fileName?: string;
  config?: any;
  error?: RepoConfigError;
};
