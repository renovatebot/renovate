export interface Release {
  name: string;
  chart: string;
  version: string;
  strategicMergePatches?: unknown;
  jsonPatches?: unknown;
  transformers?: unknown;
}

interface Repository {
  name: string;
  url: string;
  oci?: boolean;
}

export interface Doc {
  releases?: Release[];
  repositories?: Repository[];
}
