import { isNonEmptyString, isString } from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { getParentDir } from '../../../util/fs/index.ts';
import { newlineRegex } from '../../../util/regex.ts';
import { RustVersionDatasource } from '../../datasource/rust-version/index.ts';
import * as rustVersioning from '../../versioning/rust-release-channel/index.ts';
import { parse } from '../../versioning/rust-release-channel/parse.ts';
import type {
  PackageDependency,
  PackageFileContent,
  SharedConstraintsScope,
} from '../types.ts';
import { RustToolchain } from './schema.ts';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`rust-toolchain.extractPackageFile(${packageFile})`);

  // Try TOML parsing first
  const parsedResult = RustToolchain.safeParse(content);
  if (parsedResult.success) {
    const { channel, path } = parsedResult.data.toolchain;
    if (isNonEmptyString(channel)) {
      return createPackageFileContent(channel, packageFile);
    }
    if (isNonEmptyString(path)) {
      logger.debug(
        `rust-toolchain.toml file at ${packageFile} uses a local path toolchain, which cannot be updated`,
      );
      return {
        deps: [{ ...baseDependency(), skipReason: 'path-dependency' }],
        sharedConstraintsScope: getSharedConstraintsScope(null, packageFile),
      };
    }
    logger.debug(
      `rust-toolchain.toml file at ${packageFile} has no toolchain channel or path specified`,
    );
    return {
      deps: [{ ...baseDependency(), skipReason: 'unspecified-version' }],
      sharedConstraintsScope: getSharedConstraintsScope(null, packageFile),
    };
  }

  // For .toml files, TOML parsing must succeed
  if (packageFile.endsWith('.toml')) {
    logger.debug(
      { err: parsedResult.error, packageFile },
      'Failed to parse rust-toolchain.toml file',
    );
    return null;
  }

  // Fall back to legacy format for files without .toml extension
  logger.trace({ packageFile }, 'TOML parsing failed, trying legacy format');

  const lines = content
    .split(newlineRegex)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length !== 1) {
    logger.debug(
      { packageFile },
      'rust-toolchain file is empty or contains multiple lines',
    );
    return null;
  }

  return createPackageFileContent(lines[0], packageFile);
}

function createPackageFileContent(
  channel: string,
  packageFile: string,
): PackageFileContent {
  return {
    deps: [createDependency(channel)],
    sharedConstraintsScope: getSharedConstraintsScope(
      getConstraintValue(channel),
      packageFile,
    ),
  };
}

/**
 * Returns the toolchain channel as a constraint if it is a Rust version like `1.100.0` or `1.100`, else `null`, as other managers cannot use a channel like `stable` or `nightly`.
 */
function getConstraintValue(channel: string): string | null {
  const toolchain = parse(channel);
  if (!toolchain || isString(toolchain.channel)) {
    return null;
  }
  // a pre-release, a date or a host like `1.100.0-x86_64-unknown-linux-gnu` is no version Containerbase installs
  const { channel: version, date, host } = toolchain;
  return !version.prerelease && !date && !host ? channel : null;
}

/**
 * Shares the Rust version of a toolchain file, or `null` for a toolchain which is no Rust version, so that the toolchain file of a parent directory does not apply, like with `rustup`.
 */
function getSharedConstraintsScope(
  version: string | null,
  packageFile: string,
): SharedConstraintsScope {
  return {
    directory: getParentDir(packageFile),
    // rustup prefers the legacy file over the TOML one in the same directory
    precedence: upath.basename(packageFile) === 'rust-toolchain' ? 1 : 0,
    constraints: { rust: { depName: 'rust', value: version } },
  };
}

function baseDependency(): PackageDependency {
  return {
    depName: 'rust',
    depType: 'toolchain',
    datasource: RustVersionDatasource.id,
  };
}

function createDependency(channel: string): PackageDependency {
  const dep: PackageDependency = {
    ...baseDependency(),
    currentValue: channel,
  };

  if (!rustVersioning.api.isValid(channel)) {
    logger.debug(`Unsupported rust-toolchain channel value "${channel}"`);
    dep.skipReason = 'invalid-version';
  }

  return dep;
}
