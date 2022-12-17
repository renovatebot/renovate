export interface RegistryRepository {
  registry: string;
  repository: string;
}

export interface TerraformRelease {
  namespace: string;
  name: string;
  provider: string;
  source?: string;
  versions: string[];
  version: string;
  published_at: string;
}

/**
 * API docs https://www.terraform.io/internals/module-registry-protocol
 */
export interface TerraformModuleVersions {
  modules: TerraformModuleVersionsModules[];
}

export interface TerraformModuleVersionsModules {
  versions: TerraformModuleVersionsModuleVersion[];
}

export interface TerraformModuleVersionsModuleVersion {
  version: string;
}

export interface ServiceDiscoveryResult {
  'modules.v1'?: string;
  'providers.v1'?: string;
}

export type ServiceDiscoveryEndpointType = 'modules.v1' | 'providers.v1';
