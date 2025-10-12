import { logger } from '../../../logger/index.ts';
import { RustVersionDatasource } from '../../datasource/rust-version/index.ts';
import * as rustVersioning from '../../versioning/rust-release-channel/index.ts';
import type { PackageFileContent } from '../types.ts';
import { RustToolchain } from './schema.ts';

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
  if (!rustVersioning.api.isValid(channel)) {
    logger.warn(
      { channel, packageFile },
      'Unsupported rust-toolchain channel value',
    );
    return null;
  }

  const dep = {
    depName: 'rust',
    depType: 'toolchain',
    currentValue: channel,
    datasource: RustVersionDatasource.id,
  };

  return { deps: [dep] };
}
