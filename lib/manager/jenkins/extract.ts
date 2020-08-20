import * as datasourceJenkins from '../../datasource/jenkins-plugins';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { isSkipComment } from '../../util/ignore';
import * as dockerVersioning from '../../versioning/docker';
import { PackageDependency, PackageFile } from '../common';

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('jenkins.extractPackageFile()');
  const deps: PackageDependency[] = [];
  const regex = /^\s*(?<depName>[\d\w-]+):(?<currentValue>[^#\s]+)[#\s]*(?<comment>.*)$/;

  for (const line of content.split('\n')) {
    const match = regex.exec(line);

    if (match) {
      const { depName, currentValue, comment } = match.groups;
      const dep: PackageDependency = {
        datasource: datasourceJenkins.id,
        versioning: dockerVersioning.id,
        depName,
        currentValue,
      };

      if (isSkipComment(comment)) {
        dep.skipReason = SkipReason.Ignored;
      }
      deps.push(dep);
    }
  }

  return { deps };
}
