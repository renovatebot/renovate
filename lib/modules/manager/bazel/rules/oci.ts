import { z } from 'zod/v3';
import { DockerDatasource } from '../../../datasource/docker/index.ts';
import { id as dockerVersioning } from '../../../versioning/docker/index.ts';
import type { PackageDependency } from '../../types.ts';

export const ociRules = ['oci_pull', '_oci_pull'] as const;

export const OciTarget = z
  .object({
    rule: z.enum(ociRules),
    name: z.string(),
    image: z.string(),
    tag: z.string().optional(),
    digest: z.string().optional(),
  })
  .transform(({ rule, name, image, tag, digest }): PackageDependency[] => [
    {
      datasource: DockerDatasource.id,
      versioning: dockerVersioning,
      depType: rule,
      depName: name,
      packageName: image,
      currentValue: tag,
      currentDigest: digest,
    },
  ]);
