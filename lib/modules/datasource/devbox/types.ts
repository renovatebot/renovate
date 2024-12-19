export interface DevboxRelease {
  version: string;
  last_updated: string;
}

export interface DevboxResponse {
  name: string;
  summary: string;
  homepage_url: string;
  license: string;
  releases: DevboxRelease[];
}
