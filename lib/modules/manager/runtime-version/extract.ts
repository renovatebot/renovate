import { regEx } from '../../../util/regex.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

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
