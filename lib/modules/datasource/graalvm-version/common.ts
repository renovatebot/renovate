import { logger } from '../../../logger';
import type { Nullish } from '../../../types';
import { trimLeadingSlash } from '../../../util/url';
import type { PackageConfig } from './types';

export const defaultRegistryUrl = 'https://mise-java.jdx.dev/';

export const datasource = 'graalvm-version';

export function parsePackage(packageName: string): PackageConfig {
  const u = new URL(packageName, defaultRegistryUrl);
  const useSystem = u.searchParams.get('system') === 'true';

  return {
    vendor: getVendor(trimLeadingSlash(u.pathname)),
    imageType: getImageType(trimLeadingSlash(u.pathname)),
    architecture:
      u.searchParams.get('architecture') ?? getSystemArchitecture(useSystem),
    os: u.searchParams.get('os') ?? getSystemOs(useSystem),
    releaseType: u.searchParams.get('releaseType') ?? 'ga',
  };
}

function getVendor(name: string): string {
  // Extract vendor from packageName like 'oracle-graalvm-jdk' or 'graalvm-jdk'
  // Default to 'oracle-graalvm' to match mise prefix
  if (name.includes('oracle-graalvm')) {
    return 'oracle-graalvm';
  }
  // Future expansion: support 'graalvm' or 'mandrel' if needed
  return 'oracle-graalvm';
}

function getImageType(name: string): string {
  // Extract JDK vs JRE from packageName
  if (name.includes('-jre')) {
    return 'jre';
  }
  return 'jdk';
}

function getSystemArchitecture(useSystem: boolean): Nullish<string> {
  if (!useSystem) {
    return null;
  }

  // Map Node.js process.arch to mise-java API architecture values
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
        { arch: process.arch },
        'Unknown system architecture for GraalVM, defaulting to null',
      );
      return null;
  }
}

function getSystemOs(useSystem: boolean): Nullish<string> {
  if (!useSystem) {
    return null;
  }

  // Map Node.js process.platform to mise-java API OS values
  switch (process.platform) {
    case 'darwin':
      return 'macosx';
    case 'win32':
      return 'windows';
    case 'linux':
      return 'linux';
    default:
      logger.warn(
        { os: process.platform },
        'Unknown system OS for GraalVM, defaulting to null',
      );
      return null;
  }
}
