import type { DependencyExtractor } from './base.ts';
import { ModuleExtractor } from './extractors/others/modules.ts';
import { ProvidersExtractor } from './extractors/others/providers.ts';
import { GenericDockerImageRefExtractor } from './extractors/resources/generic-docker-image-ref.ts';
import { HelmReleaseExtractor } from './extractors/resources/helm-release.ts';
import { TerraformWorkspaceExtractor } from './extractors/resources/terraform-workspace.ts';
import { RequiredProviderExtractor } from './extractors/terraform-block/required-provider.ts';
import { TerraformVersionExtractor } from './extractors/terraform-block/terraform-version.ts';

export const resourceExtractors: DependencyExtractor[] = [
  new HelmReleaseExtractor(),
  new GenericDockerImageRefExtractor(),
  new TerraformWorkspaceExtractor(),
  new RequiredProviderExtractor(),
  new TerraformVersionExtractor(),
  new ProvidersExtractor(),
  new ModuleExtractor(),
];
