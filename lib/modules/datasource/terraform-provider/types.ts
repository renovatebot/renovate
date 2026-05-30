// Types are now defined in schema.ts and derived via z.infer<>.
// This file is kept for backward-compatibility but no longer contains
// standalone interfaces.
export type {
  TerraformBuild,
  TerraformProviderReleaseBackend,
  TerraformProviderVersions,
  TerraformRegistryBuildResponse,
  TerraformRegistryVersions,
  VersionDetailResponse,
} from './schema.ts';
