/**
 * A package file contains multiple package descriptions which are each separated by an completely empty line.
 * A package description contains meta data properties in the form of
 *
 * PropertyName: value
 */
export interface PackageDescription {
  Package?: string; // Package
  Version?: string; // Version
  Homepage?: string; // Homepage
}

export interface DebLanguageConfig extends Record<string, unknown> {
  deb: {
    /**
     * This is the default binary architecture which is part of the Packages URI
     * e.g. http://ftp.debian.org/debian/dists/stable/non-free/binary-amd64/
     *
     * You can specify a custom binary arch for a given repository URL like this:
     * https://ftp.debian.org/debian?suite=stable&components=main&binaryArch=amd64
     *
     * In Debian, non binary Packages are located in "binary-all" so set this to
     * "all" in this case.
     */
    defaultBinaryArch: string;
  };
}
