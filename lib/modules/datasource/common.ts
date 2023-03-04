import is from '@sindresorhus/is';
import type { GetPkgReleasesConfig } from './types';

export function isGetPkgReleasesConfig(
  input: unknown
): input is GetPkgReleasesConfig {
  return (
    is.nonEmptyStringAndNotWhitespace(
      (input as GetPkgReleasesConfig).datasource
    ) &&
    is.nonEmptyStringAndNotWhitespace(
      (input as GetPkgReleasesConfig).packageName
    )
  );
}
