import { query as q } from 'good-enough-parser';
import { z } from 'zod';
import { DockerDatasource } from '../../../datasource/docker';
import type { PackageDependency } from '../../types';
import type { Ctx } from '../context';
import { RecordFragmentSchema, StringFragmentSchema } from '../fragments';
import { kvParams } from './common';

export const RuleToDockerPackageDep = RecordFragmentSchema.extend({
  children: z.object({
    rule: StringFragmentSchema.extend({
      value: z.literal('oci_pull'),
    }),
    name: StringFragmentSchema,
    image: StringFragmentSchema,
    tag: StringFragmentSchema.optional(),
    digest: StringFragmentSchema.optional(),
  }),
}).transform(
  ({ children: { rule, name, image, tag, digest } }): PackageDependency => ({
    datasource: DockerDatasource.id,
    depType: rule.value,
    depName: name.value,
    packageName: image.value,
    currentValue: tag?.value,
    currentDigest: digest?.value,
  }),
);

export const ociRules = q
  .sym<Ctx>('oci')
  .op('.')
  .sym('pull', (ctx, token) => ctx.startRule('oci_pull'))
  .join(
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: kvParams,
      postHandler: (ctx) => ctx.endRule(),
    }),
  );
