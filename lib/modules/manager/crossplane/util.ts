import { regEx } from '../../../util/regex';

// looks for `apiVersion: pkg.crossplane.io/` with optional quoting of the value
export const fileTestRegex = regEx(/\s*apiVersion:\s*'?"?pkg.crossplane.io\//);
