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
     * This is part of the download URL, e.g. http://ftp.debian.org/debian/dists/stable/non-free/binary-amd64/ defaults to amd64
     */
    binaryArch: string;

    /**
     * This specifies the download directory into which the packages file should be downloaded.
     * This should be a folder on the "host" of renovate, e.g. the docker image.
     * The folder will be created automatically if it doesn't exist.
     */
    downloadDirectory: string;

    /**
     * This specifies the directory where the extracted packages files are stored.
     * This should be a folder on the "host" of renovate, e.g. the docker image.
     * The folder will be created automatically if it doesn't exist.
     */
    extractionDirectory: string;
  };
}
