import { logger } from '../../../logger';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { RustNightlyDatasource } from '../../datasource/rust-nightly';
import * as stableVersioning from '../../versioning/rust-toolchain';
import * as nightlyVersioning from '../../versioning/rust-toolchain-nightly';
import type { PackageFileContent } from '../types';
import { RustToolchain } from './schema';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`rust-toolchain.extractPackageFile(${packageFile})`);

  // Try TOML parsing first
  const parsedResult = RustToolchain.safeParse(content);
  if (parsedResult.success) {
    const { channel } = parsedResult.data.toolchain;
    return createDependency(channel, packageFile);
  }

  // For .toml files, TOML parsing must succeed
  if (packageFile.endsWith('.toml')) {
    logger.warn(
      { err: parsedResult.error, packageFile },
      'Failed to parse rust-toolchain.toml file',
    );
    return null;
  }

  // Fall back to legacy format for files without .toml extension
  logger.debug({ packageFile }, 'TOML parsing failed, trying legacy format');
  return createDependency(content, packageFile);
}

function createDependency(
  channel: string,
  packageFile: string,
): PackageFileContent | null {
  if (stableVersioning.api.isValid(channel)) {
    const dep = {
      depName: 'rust',
      depType: 'toolchain',
      packageName: 'rust-lang/rust',
      currentValue: channel,
      datasource: GithubReleasesDatasource.id,
      versioning: stableVersioning.id,
    };

    return { deps: [dep] };
  }

  if (nightlyVersioning.api.isValid(channel)) {
    const dep = {
      depName: 'rust-nightly',
      depType: 'toolchain',
      currentValue: channel,
      datasource: RustNightlyDatasource.id,
      versioning: nightlyVersioning.id,
    };

    return { deps: [dep] };
  }

  logger.warn(
    { channel, packageFile },
    'Unsupported rust-toolchain channel value',
  );
  return null;
}
