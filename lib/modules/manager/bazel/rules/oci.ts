import { z } from 'zod';
import { DockerDatasource } from '../../../datasource/docker';
import { id as dockerVersioning } from '../../../versioning/docker';
import type { PackageDependency } from '../../types';

export const ociRules = ['oci_pull'] as const;

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
