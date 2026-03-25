import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'collector',
    description: 'The OpenTelemetry Collector version itself',
  },
  {
    depType: 'connectors',
    description: 'Connector component module',
  },
  {
    depType: 'exports',
    description: 'Exporter component module',
  },
  {
    depType: 'extensions',
    description: 'Extension component module',
  },
  {
    depType: 'processors',
    description: 'Processor component module',
  },
  {
    depType: 'providers',
    description: 'Provider component module',
  },
  {
    depType: 'receivers',
    description: 'Receiver component module',
  },
];

export type OcbDepType = (typeof knownDepTypes)[number]['depType'];
