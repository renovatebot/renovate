import { logger } from '../../../logger/index.ts';
import type { Nullish } from '../../../types/index.ts';
import { trimLeadingSlash } from '../../../util/url.ts';
import type { PackageConfig } from './types.ts';

// Api page size limit 50
export const pageSize = 50;

export const defaultRegistryUrl = 'https://api.adoptium.net/';

export const datasource = 'java-version';

export function parsePackage(packageName: string): PackageConfig {
  const u = new URL(packageName, defaultRegistryUrl);
  const pathname = trimLeadingSlash(u.pathname);
  const vendor = getVendor(pathname);
  const useSystem = u.searchParams.get('system') === 'true';
  return {
    vendor,
    imageType: getImageType(pathname),
    architecture:
      u.searchParams.get('architecture') ??
      getSystemArchitecture(useSystem, vendor),
    os: u.searchParams.get('os') ?? getSystemOs(useSystem, vendor),
    releaseType: u.searchParams.get('release-type') ?? undefined,
  };
}

function getVendor(name: string): 'adoptium' | 'oracle-graalvm' {
  if (name.includes('oracle-graalvm')) {
    return 'oracle-graalvm';
  }
  return 'adoptium'; // Default for backwards compatibility
}

function getImageType(name: string): string {
  if (name.includes('-jre') || name === 'java-jre') {
    return 'jre';
  }
  return 'jdk';
}

function getSystemArchitecture(
  useSystem: boolean,
  vendor: 'adoptium' | 'oracle-graalvm',
): Nullish<string> {
  if (!useSystem) {
    return null;
  }

  if (vendor === 'oracle-graalvm') {
    // GraalVM arch mapping
    switch (process.arch) {
      case 'ia32':
        return 'i686';
      case 'arm64':
        return 'aarch64';
      case 'arm':
        return 'arm32';
      case 'x64':
        return 'x86_64';
      default:
        logger.warn(
          { arch: process.arch, vendor },
          'Unknown system architecture for GraalVM, defaulting to null',
        );
        return null;
    }
  }

  // Adoptium arch mapping
  switch (process.arch) {
    case 'ia32':
      return 'x86';
    case 'arm64':
      return 'aarch64';
    case 'x64':
      return 'x64';
    case 'arm':
    case 'riscv64':
    case 's390x':
      return process.arch;
    default:
      logger.warn(
        { arch: process.arch, vendor },
        'Unknown system architecture for Adoptium, defaulting to null',
      );
      return null;
  }
}

function getSystemOs(
  useSystem: boolean,
  vendor: 'adoptium' | 'oracle-graalvm',
): Nullish<string> {
  if (!useSystem) {
    return null;
  }

  if (vendor === 'oracle-graalvm') {
    // GraalVM OS mapping
    switch (process.platform) {
      case 'darwin':
        return 'macosx';
      case 'win32':
        return 'windows';
      case 'linux':
        return 'linux';
      default:
        logger.warn(
          { os: process.platform, vendor },
          'Unknown system OS for GraalVM, defaulting to null',
        );
        return null;
    }
  }

  // Adoptium OS mapping
  switch (process.platform) {
    case 'darwin':
      return 'mac';
    case 'win32':
      return 'windows';
    case 'aix':
    case 'linux':
      return process.platform;
    default:
      logger.warn(
        { os: process.platform, vendor },
        'Unknown system OS for Adoptium, defaulting to null',
      );
      return null;
  }
}
