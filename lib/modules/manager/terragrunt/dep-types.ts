import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
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
] as const satisfies readonly DepTypeMetadata[];

export type TerragruntDepType = (typeof knownDepTypes)[number]['depType'];
