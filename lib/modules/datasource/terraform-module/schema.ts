import { z } from 'zod/v3';

export const ServiceDiscoveryResponse = z.object({
  'modules.v1': z.string().optional(),
  'providers.v1': z.string().optional(),
});

export type ServiceDiscoveryResult = z.infer<typeof ServiceDiscoveryResponse>;
export type ServiceDiscoveryEndpointType = keyof ServiceDiscoveryResult;
