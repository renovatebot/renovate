export interface FlutterCurrentRelease {
  beta: string;
  dev: string;
  stable: string;
}

export interface FlutterRelease {
  hash: string;
  channel: 'stable' | 'beta' | 'dev';
  version: string;
  dart_sdk_version: string;
  dart_sdk_arch: string;
  release_date: string;
  archive: string;
  sha256: string;
}

export interface FlutterResponse {
  base_url: string;
  current_release: FlutterCurrentRelease;
  releases: FlutterRelease[];
}
