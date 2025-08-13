import { z } from 'zod';
import { DockerDatasource } from '../../../datasource/docker';
import type { PackageDependency } from '../../types';
import { RepoRuleFunctionCallSchema, StringFragmentSchema } from './fragments';

export const rulesImgLoadPaths = ['@rules_img//img:pull.bzl'] as const;

export const RulesImgPullToDockerPackageDep = RepoRuleFunctionCallSchema.extend(
  {
    loadPath: z.enum(rulesImgLoadPaths),
    originalFunctionName: z.literal('pull'),
    children: z.object({
      name: StringFragmentSchema,
      digest: StringFragmentSchema,
      registry: StringFragmentSchema,
      repository: StringFragmentSchema,
      tag: StringFragmentSchema.optional(),
    }),
  },
).transform(
  ({
    rawString,
    functionName,
    children: { name, registry, repository, digest, tag },
  }): PackageDependency => ({
    datasource: DockerDatasource.id,
    depType: 'rules_img_pull',
    depName: name.value,
    packageName: `${registry.value}/${repository.value}`,
    currentValue: tag?.value,
    currentDigest: digest.value,
    // Provide a replace string so the auto replacer can replace both the tag
    // and digest if applicable.
    replaceString: rawString,
  }),
);
