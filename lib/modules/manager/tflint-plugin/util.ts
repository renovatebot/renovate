import { regEx } from '../../../util/regex.ts';

export const keyValueExtractionRegex = regEx(
  /^\s*(?<key>[^\s]+)\s+=\s+"(?<value>[^"]+)"\s*$/,
);

export const contentCheckList = ['plugin '];
