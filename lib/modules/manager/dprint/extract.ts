import { isNonEmptyArray } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { DprintConfig } from './schema.ts';

// `npm:<name>[@<version>][/<path>][@<checksum>]`
const npmPluginRegEx = regEx(
  /^npm:(?<name>@?[^@/]+(?:\/[^@/]+)?)(?:@(?<version>[^@/]+))?(?:\/(?<path>[^@]*))?(?:@(?<checksum>\w+))?$/,
);

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace(`dprint.extractPackageFile(${packageFile})`);
  const config = DprintConfig.safeParse(content);
  if (!config.success) {
    logger.debug({ packageFile, err: config.error }, 'Invalid dprint config');
    return null;
  }

  const deps: PackageDependency[] = [];

  for (const plugin of config.data.plugins ?? []) {
    if (!plugin.startsWith('npm:')) {
      // URL-based plugins are not supported
      continue;
    }
    const groups = npmPluginRegEx.exec(plugin)?.groups;
    const name = groups?.name;
    if (!name || !groups) {
      logger.debug({ packageFile, plugin }, 'Failed to parse dprint plugin');
      continue;
    }
    const { version, checksum } = groups;
    const dep: PackageDependency = {
      depName: name,
      depType: 'plugin',
    };
    if (version) {
      dep.datasource = NpmDatasource.id;
      dep.currentValue = version;
      if (checksum) {
        // Renovate cannot compute the tarball checksum for the new version
        dep.skipReason = 'unsupported';
      }
    } else {
      // unversioned specifiers resolve from node_modules; npm manages the version
      dep.skipReason = 'unspecified-version';
    }
    deps.push(dep);
  }

  return isNonEmptyArray(deps) ? { deps } : null;
}
