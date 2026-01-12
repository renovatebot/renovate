import { z } from 'zod';
import { DockerDatasource } from '../../../datasource/docker';
import type { PackageDependency } from '../../types';
import { ExtensionTagFragment, StringFragment } from './fragments';

export const imgExtensionPrefix = 'images';

const pullTag = 'pull';

export const imgExtensionTags = ['pull'];

export const ImgExtensionToDockerPackageDep = ExtensionTagFragment.extend({
  extension: z.literal(imgExtensionPrefix),
  tag: z.literal(pullTag),
  children: z.object({
    name: StringFragment.optional(),
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
    // Construct the package name from registry and repository
    let packageName = repository.value;
    if (registry?.value) {
      packageName = `${registry.value}/${repository.value}`;
    }

    const result: PackageDependency = {
      datasource: DockerDatasource.id,
      depType: 'img_pull',
      // If name is not specified, use repository as the identifier
      depName: name?.value ?? repository.value,
      packageName,
      currentValue: tag?.value,
      currentDigest: digest?.value,
      // Provide a replace string so the auto replacer can replace both the tag
      // and digest if applicable.
      replaceString: rawString,
    };

    if (registry?.value) {
      result.registryUrls = [`https://${registry.value}`];
    }

    return result;
  },
);
