import type { GetPkgReleasesConfig } from './types';

export function isGetPkgReleasesConfig(
  input: unknown
): input is GetPkgReleasesConfig {
  return (
    (input as GetPkgReleasesConfig).datasource !== undefined &&
    (input as GetPkgReleasesConfig).depName !== undefined
  );
}
