export interface GetRegistryUrlVarsResult {
  haveCredentials: boolean;
  environmentVars: {
    PIP_INDEX_URL?: string;
    PIP_EXTRA_INDEX_URL?: string;
  };
}
