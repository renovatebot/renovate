export interface BaseProjectResult {
  versions_url: string;
  deprecated: boolean;
}

export interface BaseProjectResultV2 extends BaseProjectResult {
  latest_version: {
    version: string;
  };
}

export interface BaseProjectResultV3 extends BaseProjectResult {
  highest_version: {
    version: string;
  };
}

export interface VersionsProjectResult {
  results: Versions[];
  // new in v3, replaces results
  data?: Versions[];
}

export interface VersionsDetailResult {
  download_url: string;
  artifact: {
    filename: string;
    size: bigint;
    sha256: string;
  };
  metadata: {
    homepage: string;
    tags: Record<string, string>;
    dependencies: Record<string, string>;
    repository: string;
  };
}

interface Versions {
  version: string;
  href: string;
}
