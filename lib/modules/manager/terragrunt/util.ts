import { regEx } from '../../../util/regex.ts';

export const keyValueExtractionRegex = regEx(
  /^\s*source\s+=\s+"(?<value>[^"]+)"/,
);
