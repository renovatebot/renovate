import { logger } from '../../../logger';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(content: string): PackageFileContent {
  logger.trace('rust.extractPackageFile()');
  const dep: PackageDependency = {
    depName: 'rust',
    packageName: 'rust-lang/rust',
    currentValue: content.trim(),
    datasource: GithubReleasesDatasource.id,
  };
  return {
    deps: [dep],
    // Format described in https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file
    // Examples: 'channel = "1.82.1"', 'channel = "1.82"'
    matchStrings: ['channel\\s*=\\s*"(?<currentValue>\\d+\\.\\d+(\\.\\d+)?)"'],
  };
}
