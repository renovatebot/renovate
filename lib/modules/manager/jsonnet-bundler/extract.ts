import { posix } from 'path';
import { URL } from 'url';

import { logger } from '../../../logger';
import type { PackageDependency, PackageFile } from '../types';
import type { Dependency, JsonnetFile } from './types';

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFile | null {
  logger.trace({ packageFile }, 'jsonnet-bundler.extractPackageFile()');

  if (packageFile.match(/vendor\//)) {
    return null;
  }

  const deps: PackageDependency[] = [];
  let jsonnetFile: JsonnetFile;
  try {
    jsonnetFile = JSON.parse(content) as JsonnetFile;
  } catch (err) {
    logger.debug({ packageFile }, 'Invalid JSON');
    return null;
  }

  for (const dependency of jsonnetFile.dependencies ?? []) {
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

  const gitRemote = new URL(dependency.source.git.remote);

  const depName = posix.join(
    gitRemote.host,
    gitRemote.pathname.replace(/\.git$/, ''),
    dependency.source.git.subdir
  );

  return {
    depName,
    packageName: dependency.source.git.remote,
    currentValue: dependency.version,
    managerData: { subdir: dependency.source.git.subdir },
  };
}
