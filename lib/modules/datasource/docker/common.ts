import is from '@sindresorhus/is';
import type { HttpResponse } from '../../../util/http/types';

export const sourceLabels: string[] = [
  'org.opencontainers.image.source',
  'org.label-schema.vcs-url',
];

export const gitRefLabel = 'org.opencontainers.image.revision';

const JFROG_ARTIFACTORY_RES_HEADER = 'x-jfrog-version';

export function isArtifactoryServer<T = unknown>(
  res: HttpResponse<T> | undefined
): boolean {
  return is.string(res?.headers[JFROG_ARTIFACTORY_RES_HEADER]);
}
