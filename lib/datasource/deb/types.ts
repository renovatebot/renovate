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
     * This specifies the download directory into which the packages file should be downloaded relative to cacheDir.
     * The folder will be created automatically if it doesn't exist.
     */
    downloadDirectory: string;

    /**
     * This specifies the directory where the extracted packages files are stored relative to cacheDir.
     * The folder will be created automatically if it doesn't exist.
     */
    extractionDirectory: string;
  };
}
