import { newlineRegex, regEx } from '../../../util/regex';
import { AzureBicepResourceDatasource } from '../../datasource/azure-bicep-resource';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';

const RESOURCE_REGEX = regEx(
  /resource\s+[A-Za-z0-9_]+\s+'(?<depName>.+)@(?<currentValue>.+)'/
);

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig
): Promise<PackageFileContent | null> {
  const deps: PackageDependency[] = [];

  for (const line of content.split(newlineRegex)) {
    const trimmedLine = line?.trim();
    if (!trimmedLine || trimmedLine.startsWith('//')) {
      continue;
    }

    const match = RESOURCE_REGEX.exec(trimmedLine);

    if (!match?.groups) {
      continue;
    }

    const { depName, currentValue } = match.groups;

    deps.push({
      datasource: AzureBicepResourceDatasource.id,
      versioning: 'azure-rest-api',
      depName,
      currentValue,
      autoReplaceStringTemplate: "'{{depName}}@{{newValue}}'",
      replaceString: match[0],
    });
  }

  return Promise.resolve({ deps });
}
