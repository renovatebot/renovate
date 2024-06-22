import type { DependencyExtractor } from './base';
import { ModuleExtractor } from './extractors/others/modules';
import { ProvidersExtractor } from './extractors/others/providers';
import { GenericDockerImageRefExtractor } from './extractors/resources/generic-docker-image-ref';
import { HelmReleaseExtractor } from './extractors/resources/helm-release';
import { TerraformWorkspaceExtractor } from './extractors/resources/terraform-workspace';
import { RequiredProviderExtractor } from './extractors/terraform-block/required-provider';
import { TerraformVersionExtractor } from './extractors/terraform-block/terraform-version';

export const resourceExtractors: DependencyExtractor[] = [
  new HelmReleaseExtractor(),
  new GenericDockerImageRefExtractor(),
  new TerraformWorkspaceExtractor(),
  new RequiredProviderExtractor(),
  new TerraformVersionExtractor(),
  new ProvidersExtractor(),
  new ModuleExtractor(),
];
