// Increment this whenever there could be incompatibilities between old and new cache structure
import upath from 'upath';

export const CACHE_REVISION = 13;

export function getLocalCacheFileName(
  platform: string,
  repository: string,
): string {
  const repoCachePath = 'renovate/repository/';
  const fileName = `${repository}.json`;
  return upath.join(repoCachePath, platform, fileName);
}
