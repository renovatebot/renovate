export interface VersionDetailResponse {
  name: string;
  version: string;
  builds: TerraformBuild[];
  shasums: string;
}

export interface TerraformBuild {
  name: string;
  version: string;
  os: string;
  arch: string;
  filename: string;
  url: string;
  shasums_url: string | null;
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

/**
 * API Docs https://www.terraform.io/internals/provider-registry-protocol
 */
export interface TerraformProviderVersions {
  versions: TerraformProviderVersionsVersion[];
}

export interface TerraformProviderVersionsVersion {
  version: string;
}

export interface TerraformProviderReleaseBackend {
  name: string;
  versions: VersionsReleaseBackend;
}

export type VersionsReleaseBackend = Record<string, VersionDetailResponse>;

export interface TerraformRegistryVersions {
  id: string;
  versions: {
    version: string;
    platforms: {
      os: string;
      arch: string;
    }[];
  }[];
}

export interface TerraformRegistryBuildResponse {
  os: string;
  arch: string;
  filename: string;
  download_url: string;
  shasum: string | null;
}

/**
 * API Docs https://developer.hashicorp.com/terraform/registry/api-docs (only for registry.terraform.io)
 */
export interface TerraformCloudRegistryProviderVersion {
  source: string;
  name: string;
  tag: string;
}
