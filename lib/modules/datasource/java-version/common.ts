import { logger } from '../../../logger';
import type { Nullish } from '../../../types';
import { trimLeadingSlash } from '../../../util/url';
import type { PackageConfig } from './types';

// Api page size limit 50
export const pageSize = 50;

export const defaultRegistryUrl = 'https://api.adoptium.net/';

export const datasource = 'java-version';

export function parsePackage(packageName: string): PackageConfig {
  const u = new URL(packageName, defaultRegistryUrl);
  const useSystem = u.searchParams.get('system') === 'true';
  return {
    imageType: getImageType(trimLeadingSlash(u.pathname)),
    architecture:
      u.searchParams.get('architecture') ?? getSystemArchitecture(useSystem),
    os: u.searchParams.get('os') ?? getSystemOs(useSystem),
  };
}

function getImageType(name: string): string {
  switch (name) {
    case 'java-jre':
      return 'jre';
    default:
      return 'jdk';
  }
}

function getSystemArchitecture(useSystem: boolean): Nullish<string> {
  if (!useSystem) {
    return null;
  }
  switch (process.arch) {
    case 'ia32':
      return 'x86';
    case 'arm64':
      return 'aarch64';

    case 'arm':
    case 'riscv64':
    case 's390x':
    case 'x64':
      return process.arch;
    default:
      logger.warn(
        { arch: process.arch },
        'Unknown system architecture, defaulting to null',
      );
      return null;
  }
}

function getSystemOs(useSystem: boolean): Nullish<string> {
  if (!useSystem) {
    return null;
  }
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
        { os: process.platform },
        'Unknown system OS, defaulting to null',
      );
      return null;
  }
}
