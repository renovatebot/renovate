import { isObject } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

interface LockfileFormat {
  packages?: Record<
    string,
    { version?: string; vcsRevision?: string; commit?: string }
  >;
}

interface LockfileConfig {
  filename: string;
  commitField: 'vcsRevision' | 'commit';
}

const SUPPORTED_LOCKFILES: LockfileConfig[] = [
  { filename: 'nimble.lock', commitField: 'vcsRevision' },
  { filename: 'atlas.lock', commitField: 'commit' },
];

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`nimble.updateArtifacts(${packageFileName})`);

  if (!updatedDeps || updatedDeps.length === 0) {
    return null;
  }

  const results: UpdateArtifactsResult[] = [];
  const versionPrefixRegex = regEx('^[><=!~^&]*v?\\s*');

  for (const { filename, commitField } of SUPPORTED_LOCKFILES) {
    const lockPath = getSiblingFileName(packageFileName, filename);
    const lockContent = await readLocalFile(lockPath, 'utf8');

    if (lockContent) {
      try {
        const parsed = JSON.parse(lockContent) as unknown;
        if (isObject(parsed) && isObject((parsed as LockfileFormat).packages)) {
          const lock = parsed as LockfileFormat;
          let changed = false;
          for (const dep of updatedDeps) {
            const depName = dep.depName;
            const newVersion = dep.newValue ?? dep.newVersion;
            if (depName && newVersion && lock.packages?.[depName]) {
              const pkgEntry = lock.packages[depName];
              pkgEntry.version = newVersion.replace(versionPrefixRegex, '');
              if (dep.newDigest) {
                pkgEntry[commitField] = dep.newDigest;
              }
              changed = true;
            }
          }
          if (changed) {
            results.push({
              file: {
                type: 'addition',
                path: lockPath,
                contents: `${JSON.stringify(lock, null, 2)}\n`,
              },
            });
          }
        }
      } catch (err) {
        logger.warn({ err, filename }, 'Failed to parse or update lockfile');
      }
    }
  }

  return results.length > 0 ? results : null;
}
