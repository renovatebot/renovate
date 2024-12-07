export interface AzurePipelinesJSON {
  value?: AzurePipelinesTask[];
}

export interface AzurePipelinesTask {
  name: string;
  deprecated?: boolean;
  version: AzurePipelinesTaskVersion;
}

export interface AzurePipelinesTaskVersion {
  major: number;
  minor: number;
  patch: number;
}
