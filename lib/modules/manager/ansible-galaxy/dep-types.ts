import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'galaxy-collection',
    description: 'Ansible Galaxy collection',
  },
  {
    depType: 'role',
    description: 'Ansible role',
  },
] as const satisfies readonly DepTypeMetadata[];
