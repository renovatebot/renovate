import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'docker',
    description: 'A Docker image used in a Drone CI pipeline step or service',
  },
];

export type DroneciDepType = (typeof knownDepTypes)[number]['depType'];
