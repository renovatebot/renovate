import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'github',
    description: 'Terragrunt module sourced from a GitHub repository',
  },
  {
    depType: 'gitTags',
    description: 'Terragrunt module sourced from a generic Git repository',
  },
  {
    depType: 'terragrunt',
    description: 'Terragrunt module sourced from a Terraform Module registry',
  },
];

export type TerragruntDepType = (typeof knownDepTypes)[number]['depType'];
