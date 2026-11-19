import { createCacheReadStream } from '../../../util/fs/index.ts';
import { hashStream } from '../../../util/hash.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import type { Checksum, ChecksumAlgorithm } from './types.ts';

const sectionNames: Record<string, ChecksumAlgorithm> = {
  SHA512: 'sha512',
  SHA256: 'sha256',
};

// strongest algorithm first
const algorithmPriority: ChecksumAlgorithm[] = ['sha512', 'sha256'];

const sectionRegex = regEx(/^(?<name>[\w-]+):\s*$/);

/**
 * Parses the checksum for a specified package path from the InRelease content.
 * Uses the SHA512 section if it lists the path, otherwise the SHA256 section.
 *
 * @param inReleaseContent - content of the InRelease file
 * @param packagePath - path of the package file (e.g., 'contrib/binary-amd64/Packages.gz')
 * @returns The checksum with its algorithm if found, otherwise null
 */
export function parseChecksumsFromInRelease(
  inReleaseContent: string,
  packagePath: string,
): Checksum | null {
  const entryRegex = regEx(
    `^\\s+(?<hash>\\S+)\\s+\\d+\\s+${RegExp.escape(packagePath)}$`,
  );
  const found: Partial<Record<ChecksumAlgorithm, string>> = {};
  let algorithm: ChecksumAlgorithm | undefined;

  for (const line of inReleaseContent.split(newlineRegex)) {
    const section = sectionRegex.exec(line);
    if (section) {
      algorithm = sectionNames[section.groups!.name];
      continue;
    }

    const hash = algorithm && entryRegex.exec(line)?.groups?.hash;
    if (algorithm && hash) {
      found[algorithm] ??= hash;
    }
  }

  const best = algorithmPriority.find((a) => found[a]);
  return best ? { algorithm: best, hash: found[best]! } : null;
}

/**
 * Computes the checksum of a specified file with the given algorithm.
 *
 * @param filePath - path of the file
 * @param algorithm - hash algorithm to use
 * @returns resolves to the checksum
 */
export function computeFileChecksum(
  filePath: string,
  algorithm: ChecksumAlgorithm = 'sha256',
): Promise<string> {
  const stream = createCacheReadStream(filePath);
  return hashStream(stream, algorithm);
}
