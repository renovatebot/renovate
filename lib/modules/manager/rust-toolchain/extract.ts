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
  logger.trace({ packageFile }, 'TOML parsing failed, trying legacy format');

  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    logger.warn({ packageFile }, 'rust-toolchain file is empty');
    return null;
  }

  if (lines.length > 1) {
    logger.warn({ packageFile }, 'rust-toolchain file contains multiple lines');
    return null;
  }

  return createDependency(lines[0], packageFile);
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
