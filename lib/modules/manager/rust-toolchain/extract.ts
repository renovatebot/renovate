import { logger } from '../../../logger';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as stableVersioning from '../../versioning/rust-toolchain';
import type { PackageFileContent } from '../types';
import { RustToolchain } from './schema';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`rust-toolchain.extractPackageFile(${packageFile})`);

  const parsedResult = RustToolchain.safeParse(content);
  if (parsedResult.success) {
    const { channel } = parsedResult.data.toolchain;
    return createDependency(channel, packageFile);
  }

  logger.warn(
    { err: parsedResult.error, packageFile },
    'Failed to parse rust-toolchain.toml file',
  );
  return null;
}

function createDependency(
  channel: string,
  packageFile: string,
): PackageFileContent | null {
  if (!stableVersioning.api.isValid(channel)) {
    logger.warn(
      { channel, packageFile },
      'Unsupported rust-toolchain channel value',
    );
    return null;
  }

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
