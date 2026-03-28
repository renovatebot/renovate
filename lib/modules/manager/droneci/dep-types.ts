import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'docker',
    description: 'A Docker image used in a Drone CI pipeline step or service',
  },
] as const satisfies readonly DepTypeMetadata[];

export type DroneciDepType = (typeof knownDepTypes)[number]['depType'];
