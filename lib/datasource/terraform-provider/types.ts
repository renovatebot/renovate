export interface VersionDetailResponse {
  name: string;
  version: string;
  builds: TerraformBuild[];
}

export interface TerraformBuild {
  name: string;
  version: string;
  os: string;
  arch: string;
  filename: string;
  url: string;
}

export interface TerraformProvider {
  namespace: string;
  name: string;
  provider: string;
  source?: string;
  versions: string[];
  version: string;
  published_at: string;
}

export interface TerraformProviderReleaseBackend {
  [key: string]: {
    name: string;
    versions: VersionsReleaseBackend;
  };
}

export interface VersionsReleaseBackend {
  [key: string]: VersionDetailResponse;
}
