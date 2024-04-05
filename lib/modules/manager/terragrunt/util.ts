import { regEx } from '../../../util/regex';
import type { TerragruntDependencyTypes } from './common';

export const keyValueExtractionRegex = regEx(
  /^\s*source\s+=\s+"(?<value>[^"]+)"\s*$/,
);

export function getTerragruntDependencyType(
  value: string,
): TerragruntDependencyTypes {
  switch (value) {
    case 'terraform': {
      return 'terraform';
    }
    default: {
      return 'unknown';
    }
  }
}

export function checkFileContainsDependency(
  content: string,
  checkList: string[],
): boolean {
  return checkList.some((check) => content.includes(check));
}
