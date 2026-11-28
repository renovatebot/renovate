import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { PuppetForgeDatasource } from '../../datasource/puppet-forge/index.ts';
import * as npmVersioning from '../../versioning/npm/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { PuppetModuleMetadata } from './schema.ts';

// A module is referenced as either `author/module` or `author-module`.
const moduleNameRegex = regEx(/^[a-zA-Z0-9_]+[/-][a-zA-Z0-9_-]+$/);

function normalizeModuleName(name: string): string {
  return name.includes('/') ? name : name.replace('-', '/');
}

export function extractMetadataJson(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const res = PuppetModuleMetadata.safeParse(content);
  if (!res.success) {
    logger.debug(
      { packageFile, err: res.error },
      'Failed to parse Puppet module metadata.json',
    );
    return null;
  }

  const deps: PackageDependency[] = [];
  for (const { name, version_requirement } of res.data.dependencies) {
    if (!moduleNameRegex.test(name)) {
      deps.push({ depName: name, skipReason: 'invalid-name' });
      continue;
    }

    const dep: PackageDependency = {
      // keep the name as written so that auto-replace can locate it
      depName: name,
      depType: 'dependencies',
      packageName: normalizeModuleName(name),
      datasource: PuppetForgeDatasource.id,
      versioning: npmVersioning.id,
    };

    if (version_requirement) {
      dep.currentValue = version_requirement;
    } else {
      dep.skipReason = 'unspecified-version';
    }

    deps.push(dep);
  }

  return deps.length ? { deps } : null;
}
