import { logger } from '../../../logger/index.ts';
import type { Nullish } from '../../../types/index.ts';
import { trimLeadingSlash } from '../../../util/url.ts';
import type { JavaVendor, PackageConfig } from './types.ts';

// Api page size limit 50
export const pageSize = 50;

export const defaultRegistryUrl = 'https://api.adoptium.net/';

export const datasource = 'java-version';

export function parsePackage(packageName: string): PackageConfig {
  const u = new URL(packageName, defaultRegistryUrl);
  const pathname = trimLeadingSlash(u.pathname);
  const vendor = getVendor(pathname);
  const useSystem = u.searchParams.get('system') === 'true';
  const useGraalvmDefaults = vendor === 'oracle-graalvm' && !useSystem;
  return {
    vendor,
    imageType: getImageType(pathname),
    architecture:
      u.searchParams.get('architecture') ??
      (useGraalvmDefaults
        ? 'x86_64'
        : getSystemArchitecture(useSystem, vendor)),
    os:
      u.searchParams.get('os') ??
      (useGraalvmDefaults ? 'linux' : getSystemOs(useSystem, vendor)),
    releaseType: parseReleaseType(u.searchParams.get('release-type')),
  };
}

function getVendor(name: string): JavaVendor {
  if (name.includes('oracle-graalvm')) {
    return 'oracle-graalvm';
  }
  return 'adoptium'; // Default for backwards compatibility
}

function parseReleaseType(value: string | null): PackageConfig['releaseType'] {
  return value === 'ga' || value === 'ea' ? value : undefined;
}

function getImageType(name: string): string {
  if (name.includes('-jre') || name === 'java-jre') {
    return 'jre';
  }
  return 'jdk';
}

function getSystemArchitecture(
  useSystem: boolean,
  vendor: JavaVendor,
): Nullish<string> {
  if (!useSystem) {
    return null;
  }

  return vendor === 'oracle-graalvm'
    ? getGraalvmArchitecture()
    : getAdoptiumArchitecture();
}

function getGraalvmArchitecture(): Nullish<string> {
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
        { arch: process.arch, vendor: 'oracle-graalvm' },
        'Unknown system architecture for GraalVM, defaulting to null',
      );
      return null;
  }
}

function getAdoptiumArchitecture(): Nullish<string> {
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
        { arch: process.arch, vendor: 'adoptium' },
        'Unknown system architecture for Adoptium, defaulting to null',
      );
      return null;
  }
}

function getSystemOs(useSystem: boolean, vendor: JavaVendor): Nullish<string> {
  if (!useSystem) {
    return null;
  }

  return vendor === 'oracle-graalvm' ? getGraalvmOs() : getAdoptiumOs();
}

function getGraalvmOs(): Nullish<string> {
  switch (process.platform) {
    case 'darwin':
      return 'macosx';
    case 'win32':
      return 'windows';
    case 'linux':
      return 'linux';
    default:
      logger.warn(
        { os: process.platform, vendor: 'oracle-graalvm' },
        'Unknown system OS for GraalVM, defaulting to null',
      );
      return null;
  }
}

function getAdoptiumOs(): Nullish<string> {
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
        { os: process.platform, vendor: 'adoptium' },
        'Unknown system OS for Adoptium, defaulting to null',
      );
      return null;
  }
}
