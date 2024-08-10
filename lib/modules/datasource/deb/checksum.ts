import crypto from 'crypto';
import { createCacheReadStream } from '../../../util/fs';
import { escapeRegExp, regEx } from '../../../util/regex';

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
  const lines = inReleaseContent.split('\n');
  const regex = regEx(
    `([a-f0-9]{64})\\s+\\d+\\s+${escapeRegExp(packagePath)}$`,
  );

  for (const line of lines) {
    const match = line.match(regex);
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
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createCacheReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (error) => reject(error));
  });
}
