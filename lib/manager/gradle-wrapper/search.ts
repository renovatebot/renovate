export const DISTRIBUTION_URL_REGEX = /^(?<assignment>distributionUrl\s*=\s*)\S*-(?<version>(\d|\.)+)-(?<type>bin|all)\.zip\s*$/;
export const DISTRIBUTION_CHECKSUM_REGEX = /^(?<assignment>distributionSha256Sum\s*=\s*)(?<checksum>(\w){64}).*$/;
export const DOWNLOAD_URL_REGEX = /^(?<http>http)\S*-(?<version>(\d|\.)+)-(?<type>bin|all)\.zip\s*$/;
export const VERSION_REGEX = /-(?<version>(\d|\.)+)-/;
