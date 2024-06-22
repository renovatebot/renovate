import { z } from 'zod';
import { DockerDatasource } from '../../../datasource/docker';
import { id as dockerVersioning } from '../../../versioning/docker';
import type { PackageDependency } from '../../types';

export const dockerRules = ['container_pull', '_container_pull'] as const;

export const DockerTarget = z
  .object({
    rule: z.enum(dockerRules),
    name: z.string(),
    tag: z.string(),
    digest: z.string(),
    repository: z.string(),
    registry: z.string(),
  })
  .transform(
    ({
      rule,
      name,
      repository,
      tag,
      digest,
      registry,
    }): PackageDependency[] => [
      {
        datasource: DockerDatasource.id,
        versioning: dockerVersioning,
        depType: rule,
        depName: name,
        packageName: repository,
        currentValue: tag,
        currentDigest: digest,
        registryUrls: [registry],
      },
    ],
  );
