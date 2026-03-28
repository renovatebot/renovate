import type z from 'zod/v3';
import type { TerraformDefinitionFileJSON } from './schema.ts';

export type TerraformDefinitionFile = z.infer<
  typeof TerraformDefinitionFileJSON
>;

export interface TerraformBlock {
  required_providers?: TerraformRequiredProviderBlock[];
  required_version?: string;
}

export type TerraformRequiredProviderBlock = Record<
  string,
  TerraformRequiredProvider | string
>;

export interface TerraformRequiredProvider {
  source?: string;
  version?: string;
}

export interface TerraformModule {
  source?: string;
  version?: string;
}

export interface TerraformResources {
  helm_release?: Record<string, TerraformHelmRelease>;
  tfe_workspace?: Record<string, TerraformWorkspace>;
  [s: string]: unknown; // generic docker resources
}

export interface TerraformProvider {
  alias?: string;
  version?: string;
}

export interface TerraformHelmRelease {
  version?: string;
  repository?: string;
  chart?: string;
}

export interface TerraformWorkspace {
  terraform_version?: string;
}
