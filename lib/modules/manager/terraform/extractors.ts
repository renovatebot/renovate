import type { DependencyExtractor } from './base';
import { ModuleExtractor } from './extractors/others/modules';
import { ProvidersExtractor } from './extractors/others/providers';
import { GenericDockerImageRef } from './extractors/resources/generic-docker-image-ref';
import { HelmReleaseExtractor } from './extractors/resources/helm-release';
import { TerraformWorkspaceExtractor } from './extractors/resources/terraform-workspace';
import { RequiredProviderExtractor } from './extractors/terraform-block/required-provider';
import { TerraformVersionExtractor } from './extractors/terraform-block/terraform-version';

const resourceExtractors: DependencyExtractor[] = [];

export default resourceExtractors;

resourceExtractors.push(new HelmReleaseExtractor());
resourceExtractors.push(new GenericDockerImageRef());
resourceExtractors.push(new TerraformWorkspaceExtractor());
resourceExtractors.push(new RequiredProviderExtractor());
resourceExtractors.push(new TerraformVersionExtractor());
resourceExtractors.push(new ProvidersExtractor());
resourceExtractors.push(new ModuleExtractor());
