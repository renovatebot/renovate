export interface ChecksumData {
  sha256?: string;
  sha512?: string;
  b2?: string;
  md5?: string;
}

export interface SourceData {
  url: string;
  version?: string;
  repo?: string;
  owner?: string;
  datasource?: string;
}
