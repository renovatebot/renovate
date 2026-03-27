import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'galaxy-collection',
    description: 'Ansible Galaxy collection',
  },
  {
    depType: 'role',
    description: 'Ansible role',
  },
] as const;

export type AnsibleGalaxyDepType = (typeof knownDepTypes)[number]['depType'];
