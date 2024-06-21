export interface NixhubRelease {
  version: string;
  last_updated: string;
}

export interface NixhubResponse {
  name: string;
  summary: string;
  homepage_url: string;
  license: string;
  releases: NixhubRelease[];
}
