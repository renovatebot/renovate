import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { JuliaManifest } from './schema.ts';

/**
 * Returns the version of each package in the manifest that comes from a
 * registry, by package UUID.
 */
export async function getLockedVersions(
  manifestFile: string,
): Promise<Map<string, string> | null> {
  const content = await readLocalFile(manifestFile, 'utf8');
  if (!content) {
    logger.debug({ manifestFile }, 'Failed to read Julia manifest');
    return null;
  }

  const parsed = JuliaManifest.safeParse(content);
  if (!parsed.success) {
    logger.debug(
      { manifestFile, err: parsed.error },
      'Failed to parse Julia manifest',
    );
    return null;
  }

  const versions = new Map<string, string>();
  for (const entries of Object.values(parsed.data)) {
    for (const { uuid, version, path, 'repo-url': repoUrl } of entries) {
      // A package from `Pkg.develop` or `Pkg.add(url=...)` has the version of
      // its checkout, not a version in a registry.
      if (version && !path && !repoUrl) {
        versions.set(uuid.toLowerCase(), version);
      }
    }
  }
  return versions;
}
