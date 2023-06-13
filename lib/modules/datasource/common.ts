import is from '@sindresorhus/is';
import type { HttpResponse } from '../../util/http/types';
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

const JFROG_ARTIFACTORY_RES_HEADER = 'x-jfrog-version';

export function isArtifactoryServer<T = unknown>(
  res: HttpResponse<T> | undefined
): boolean {
  return is.string(res?.headers[JFROG_ARTIFACTORY_RES_HEADER]);
}
