import { joinUrlParts } from '../../../util/url';

export function buildRegistryUrl(
  pkgServer: string,
  registryUUID: string,
  registryState: string = '',
): string {
  return joinUrlParts(pkgServer, 'registry', registryUUID, registryState);
}

export const PKG_SERVER_REQUEST_HEADERS = {
  // Tell Julia package servers that this is a bot/CI process.
  // This helps Julia package servers recognize traffic from bots and human users.
  'Julia-CI-Variables': 'CI=t;RENOVATE=t',
};

// This host will redirect to a suitable, geographically close, mirror
export const defaultPkgServer = 'https://pkg.julialang.org';

export const generalRegistryUUID = '23338594-aafe-5451-b93e-139f81909106';

export const juliaPkgServerDatasourceId = 'julia-pkg-server';

export const defaultRegistryUrl = buildRegistryUrl(
  defaultPkgServer,
  generalRegistryUUID,
);
