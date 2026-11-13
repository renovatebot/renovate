import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { JuliaManifest } from './schema.ts';

/**
 * Returns the version of each package in the manifest, by package UUID.
 */
export async function getLockedVersions(
  manifestFile: string,
): Promise<Map<string, string> | null> {
  const content = await readLocalFile(manifestFile, 'utf8');
  if (!content) {
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
    for (const { uuid, version } of entries) {
      if (version) {
        versions.set(uuid.toLowerCase(), version);
      }
    }
  }
  return versions;
}
