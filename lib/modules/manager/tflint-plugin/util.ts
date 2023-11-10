import { regEx } from '../../../util/regex';

export const keyValueExtractionRegex = regEx(
  /^\s*(?<key>[^\s]+)\s+=\s+"(?<value>[^"]+)"\s*$/,
);

export function checkFileContainsPlugins(content: string): boolean {
  const checkList = ['plugin '];
  return checkList.some((check) => content.includes(check));
}
