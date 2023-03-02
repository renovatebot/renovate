import type { ProgrammingLanguage } from '../../../constants/programming-language';
import { regEx } from '../../../util/regex';
import { AzureBicepTypesDatasource } from '../../datasource/azure-bicep-types';
import type { ExtractConfig, PackageFileContent } from '../types';

const RESOURCE_REGEX = regEx(
  /resource\s+[A-Za-z0-9_]+\s+'(?<resourceType>.*)@(?<version>.*)'/gm
);

export const language: ProgrammingLanguage = 'bicep';

export const defaultConfig = {
  fileMatch: ['\\.bicep$'],
};

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig
): Promise<PackageFileContent | null> {
  // TODO
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const matches = RESOURCE_REGEX.exec(content);

  return Promise.resolve({
    deps: [],
  });
}

export const supportedDatasources = [AzureBicepTypesDatasource.id];
