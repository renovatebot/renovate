import { isHttpUrl, joinUrlParts } from '../../../util/url';
import type {
  ServiceDiscoveryEndpointType,
  ServiceDiscoveryResult,
} from './types';

export function createSDBackendURL(
  registryURL: string,
  sdType: ServiceDiscoveryEndpointType,
  sdResult: ServiceDiscoveryResult,
  subPath: string,
): string {
  const sdEndpoint = sdResult[sdType] ?? '';
  const fullPath = joinUrlParts(sdEndpoint, subPath);
  if (isHttpUrl(fullPath)) {
    return fullPath;
  }
  return joinUrlParts(registryURL, fullPath);
}
