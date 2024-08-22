import { createCacheReadStream } from '../../../util/fs';
import { hashStream } from '../../../util/hash';
import { escapeRegExp, newlineRegex, regEx } from '../../../util/regex';

/**
 * Parses the SHA256 checksum for a specified package path from the InRelease content.
 *
 * @param inReleaseContent - content of the InRelease file
 * @param packagePath - path of the package file (e.g., 'contrib/binary-amd64/Packages.gz')
 * @returns The SHA256 checksum if found, otherwise undefined
 */
export function parseChecksumsFromInRelease(
  inReleaseContent: string,
  packagePath: string,
): string | null {
  const lines = inReleaseContent.split(newlineRegex);
  const regex = regEx(
    `([a-f0-9]{64})\\s+\\d+\\s+${escapeRegExp(packagePath)}$`,
  );

  for (const line of lines) {
    const match = regex.exec(line);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Computes the SHA256 checksum of a specified file.
 *
 * @param filePath - path of the file
 * @returns resolves to the SHA256 checksum
 */
export function computeFileChecksum(filePath: string): Promise<string> {
  const stream = createCacheReadStream(filePath);
  return hashStream(stream, 'sha256');
}
