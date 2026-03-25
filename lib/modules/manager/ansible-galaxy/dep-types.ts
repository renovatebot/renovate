import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'galaxy-collection',
    description:
      'Ansible Galaxy collection from `requirements.yml` or `galaxy.yml`',
  },
  {
    depType: 'role',
    description: 'Ansible role from `requirements.yml`',
  },
] as const;

export type AnsibleGalaxyDepType = (typeof knownDepTypes)[number]['depType'];
