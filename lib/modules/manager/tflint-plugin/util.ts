import { regEx } from '../../../util/regex';

export const keyValueExtractionRegex = regEx(
  /^\s*(?<key>[^\s]+)\s+=\s+"(?<value>[^"]+)"\s*$/
);
export const resourceTypeExtractionRegex = regEx(
  /^\s*resource\s+"(?<type>[^\s]+)"\s+"(?<name>[^"]+)"\s*{/
);

export function checkFileContainsPlugins(content: string): boolean {
  const checkList = ['plugin '];
  return checkList.some((check) => content.includes(check));
}
