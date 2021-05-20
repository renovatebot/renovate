import { TerragruntDependencyTypes } from './common';

export const keyValueExtractionRegex = /^\s*source\s+=\s+"(?<value>[^"]+)"\s*$/;

export function getTerragruntDependencyType(
  value: string
): TerragruntDependencyTypes {
  switch (value) {
    case 'terraform': {
      return TerragruntDependencyTypes.terragrunt;
    }
    default: {
      return TerragruntDependencyTypes.unknown;
    }
  }
}

export function checkFileContainsDependency(
  content: string,
  checkList: string[]
): boolean {
  return checkList.some((check) => content.includes(check));
}
