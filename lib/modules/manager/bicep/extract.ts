import { newlineRegex, regEx } from '../../../util/regex';
import { AzureBicepTypesDatasource } from '../../datasource/azure-bicep-types';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';

const RESOURCE_REGEX = regEx(
  /resource\s+[A-Za-z0-9_]+\s+'(?<name>.*)@(?<version>.*)'/,
  'g'
);

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig
): Promise<PackageFileContent | null> {
  const packageDependencies: PackageDependency[] = [];

  for (const line of content.split(newlineRegex)) {
    const trimmedLine = line?.trim();
    if (!trimmedLine || trimmedLine.startsWith('//')) {
      continue;
    }

    const matches = RESOURCE_REGEX.exec(trimmedLine);

    if (!matches?.groups) {
      continue;
    }

    const { name, version } = matches.groups;

    packageDependencies.push({
      depName: name,
      datasource: AzureBicepTypesDatasource.id,
      currentValue: version,
    });
  }

  return Promise.resolve({
    deps: [],
  });
}
