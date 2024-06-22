import { regEx } from '../../../util/regex';

export const keyValueExtractionRegex = regEx(
  /^\s*(?<key>[^\s]+):\s+"?(?<value>[^"\s]+)"?\s*$/,
);
// looks for `apiVersion: argoproj.io/` with optional quoting of the value
export const fileTestRegex = regEx(/\s*apiVersion:\s*'?"?argoproj.io\//);
