export interface ChecksumEntry {
  value: string;
  suffix?: string; // e.g., '_x86_64', '_aarch64', or undefined for plain checksums
}

export interface ChecksumData {
  sha256?: string | ChecksumEntry[];
  sha512?: string | ChecksumEntry[];
  b2?: string | ChecksumEntry[];
  md5?: string | ChecksumEntry[];
}

export interface SourceData {
  url: string;
  version?: string;
  repo?: string;
  owner?: string;
  datasource?: string;
  packageName?: string;
  registryUrl?: string;
}
