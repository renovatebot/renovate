import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { type Http, HttpError } from '../../../util/http/index.ts';
import type { Release, ReleaseResult } from '../types.ts';
import { miseJavaRegistryUrl } from './common.ts';
import { MiseJavaRelease } from './schema.ts';
import type { PackageConfig } from './types.ts';

function getMiseOs(os: string | null): string | null {
  if (os === 'mac') {
    return 'macosx';
  }
  if (os) {
    return os;
  }
  switch (process.platform) {
    case 'darwin':
      return 'macosx';
    case 'win32':
    case 'linux':
      return process.platform === 'win32' ? 'windows' : 'linux';
    default:
      return null;
  }
}

function getMiseArchitecture(architecture: string | null): string | null {
  if (architecture === 'x64') {
    return 'x86_64';
  }
  if (architecture === 'x86') {
    return 'i686';
  }
  if (architecture) {
    return architecture;
  }
  switch (process.arch) {
    case 'x64':
      return 'x86_64';
    case 'ia32':
      return 'i686';
    case 'arm64':
      return 'aarch64';
    case 'arm':
      return 'arm32';
    default:
      return null;
  }
}

export function getOpenjdkMetadataUrl(pkgConfig: PackageConfig): string | null {
  const os = getMiseOs(pkgConfig.os);
  const architecture = getMiseArchitecture(pkgConfig.architecture);
  if (!os || !architecture) {
    return null;
  }
  const releaseType = pkgConfig.releaseType ?? 'ga';
  return `${miseJavaRegistryUrl}jvm/${releaseType}/${os}/${architecture}.json`;
}

export async function getOpenjdkReleases(
  http: Http,
  pkgConfig: PackageConfig,
): Promise<ReleaseResult | null> {
  const url = getOpenjdkMetadataUrl(pkgConfig);
  if (!url) {
    return null;
  }
  logger.trace({ pkgConfig, url }, 'fetching OpenJDK releases');

  try {
    const response = await http.getJson(url, MiseJavaRelease.array());
    const releases: Release[] = response.body
      .filter(
        (release) =>
          release.vendor === 'openjdk' && release.image_type === 'jdk',
      )
      .map(({ version }) => ({ version }));
    return releases.length
      ? { homepage: 'https://jdk.java.net/', releases }
      : null;
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.response?.statusCode === 404) {
        return null;
      }
      throw new ExternalHostError(err);
    }
    throw err;
  }
}
