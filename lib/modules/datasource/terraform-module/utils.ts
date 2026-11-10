import { regEx } from '../../../util/regex.ts';
import { coerceString } from '../../../util/string.ts';
import { isHttpUrl, joinUrlParts } from '../../../util/url.ts';
import type {
  ServiceDiscoveryEndpointType,
  ServiceDiscoveryResponse,
} from './schema.ts';
import type { RegistryRepository } from './types.ts';

export function createSDBackendURL(
  registryURL: string,
  sdType: ServiceDiscoveryEndpointType,
  sdResult: ServiceDiscoveryResponse,
  subPath: string,
): string {
  const sdEndpoint = sdResult[sdType] ?? '';
  const fullPath = joinUrlParts(sdEndpoint, subPath);
  if (isHttpUrl(fullPath)) {
    return fullPath;
  }
  return joinUrlParts(registryURL, fullPath);
}

export function getRegistryRepository(
  packageName: string,
  registryUrl: string | undefined,
): RegistryRepository {
  let registry: string;
  const split = packageName.split('/');
  if (split.length > 3 && split[0].includes('.')) {
    registry = split.shift()!;
  } else {
    registry = coerceString(registryUrl);
  }
  if (!regEx(/^https?:\/\//).test(registry)) {
    registry = `https://${registry}`;
  }
  const repository = split.join('/');
  return {
    registry,
    repository,
  };
}
