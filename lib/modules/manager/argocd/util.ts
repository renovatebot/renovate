import { regEx } from '../../../util/regex.ts';

// looks for `apiVersion: argoproj.io/` with optional quoting of the value
export const fileTestRegex = regEx(/\s*apiVersion:\s*'?"?argoproj.io\//);
