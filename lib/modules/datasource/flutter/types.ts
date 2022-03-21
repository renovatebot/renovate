export interface FlutterRelease {
  base_url: string;
  current_release: {
    beta: string;
    dev: string;
    stable: string;
  };
  releases: {
    hash: string;
    channel: string;
    version: string;
    dart_sdk_version: string;
    dart_sdk_arch: string;
    release_date: string;
    archive: string;
    sha256: string;
  }[];
}
