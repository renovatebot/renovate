import { join } from 'upath';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { coerceString } from '../../../util/string';
import { parseUrl } from '../../../util/url';
import type { PackageDependency, PackageFileContent } from '../types';
import type { Dependency, JsonnetFile } from './types';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace({ packageFile }, 'jsonnet-bundler.extractPackageFile()');

  if (packageFile.match(/vendor\//)) {
    return null;
  }

  const deps: PackageDependency[] = [];
  let jsonnetFile: JsonnetFile;
  try {
    jsonnetFile = JSON.parse(content) as JsonnetFile;
  } catch (err) {
    logger.debug({ packageFile }, `Invalid JSON`);
    return null;
  }

  for (const dependency of coerceArray(jsonnetFile.dependencies)) {
    const dep = extractDependency(dependency);
    if (dep) {
      deps.push(dep);
    }
  }

  if (!deps.length) {
    return null;
  }

  return { deps };
}

function extractDependency(dependency: Dependency): PackageDependency | null {
  if (!dependency.source.git) {
    return null;
  }

  const gitRemote = parseUrl(dependency.source.git.remote);
  if (!gitRemote) {
    logger.debug({ dependency }, 'Invalid Git remote URL');
    return null;
  }

  const depName = join(
    gitRemote.host,
    gitRemote.pathname.replace(/\.git$/, ''),
    coerceString(dependency.source.git.subdir),
  );

  return {
    depName,
    packageName: dependency.source.git.remote,
    currentValue: dependency.version,
    managerData: { subdir: dependency.source.git.subdir },
  };
}
