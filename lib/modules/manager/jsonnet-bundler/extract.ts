import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import type { PackageDependency, PackageFile } from '../types';
import type { Dependency, JsonnetFile } from './types';

const gitUrl = regEx(
  /(ssh:\/\/git@|https:\/\/)([\w.]+)\/([\w:/\-~]*)\/(?<depName>[\w:/-]+)(\.git)?/
);

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

  const match = gitUrl.exec(dependency.source.git.remote);

  return {
    depName:
      dependency.name ?? match?.groups?.depName ?? dependency.source.git.remote,
    packageName: dependency.source.git.remote,
    currentValue: dependency.version,
    managerData: { subdir: dependency.source.git.subdir },
  };
}
