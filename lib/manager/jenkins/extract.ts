import * as datasourceJenkins from '../../datasource/jenkins-plugins';
import { logger } from '../../logger';
import * as dockerVersioning from '../../versioning/docker';
import { PackageDependency, PackageFile } from '../common';

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('jenkins.extractPackageFile()');
  const deps: PackageDependency[] = [];
  const regex = /^\s*(?<depName>[\d\w-]+):(?<currentValue>[^#\s]+).*$/;

  for (const line of content.split('\n')) {
    const match = regex.exec(line);

    if (match) {
      const { depName, currentValue } = match.groups;
      const dep: PackageDependency = {
        datasource: datasourceJenkins.id,
        versioning: dockerVersioning.id,
        depName,
        currentValue,
      };

      deps.push(dep);
    }
  }

  return { deps };
}
