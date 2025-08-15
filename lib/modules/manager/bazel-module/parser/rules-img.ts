import { z } from 'zod';
import { DockerDatasource } from '../../../datasource/docker';
import type { PackageDependency } from '../../types';
import { RepoRuleCallFragment, StringFragment } from './fragments';

export const RulesImgPullToDockerPackageDep = RepoRuleCallFragment.extend({
  rule: z.literal('pull'),
  module: z.string().regex(/^@rules_img/),
  children: z.object({
    name: StringFragment,
    repository: StringFragment,
    registry: StringFragment.optional(),
    tag: StringFragment.optional(),
    digest: StringFragment.optional(),
  }),
}).transform(
  ({
    rawString,
    children: { name, repository, registry, tag, digest },
  }): PackageDependency => {
    // Construct the full package name from registry and repository
    let packageName: string;
    if (registry?.value) {
      // If registry is explicitly provided, use it
      packageName = `${registry.value}/${repository.value}`;
    } else {
      // If no registry, use repository as-is (it might already include the registry)
      packageName = repository.value;
    }

    const result: PackageDependency = {
      datasource: DockerDatasource.id,
      depType: 'rules_img_pull',
      depName: name.value,
      packageName,
      replaceString: rawString,
    };

    if (tag?.value) {
      result.currentValue = tag.value;
    }

    if (digest?.value) {
      result.currentDigest = digest.value;
    }

    return result;
  },
);
