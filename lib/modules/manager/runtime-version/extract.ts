import { regEx } from '../../../util/regex';
import { DockerDatasource } from '../../datasource/docker';
import type { PackageDependency, PackageFileContent } from '../types';

export const pythonRuntimeRegex = regEx(
  '^python-(?<version>\\d+\\.\\d+\\.\\d+)$',
);

export function extractPackageFile(content: string): PackageFileContent | null {
  const regexResult = pythonRuntimeRegex.exec(content);
  const runtimeVersion = regexResult?.groups?.version;

  if (runtimeVersion) {
    const dep: PackageDependency = {
      depName: 'python',
      currentValue: runtimeVersion,
      datasource: DockerDatasource.id,
    };

    return { deps: [dep] };
  }

  return null;
}
