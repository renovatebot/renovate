import { z } from 'zod';
import { DockerDatasource } from '../../../datasource/docker';
import type { PackageDependency } from '../../types';
import { ExtensionTagFragment, StringFragment } from './fragments';

export const ociExtensionPrefix = 'oci';

const pullTag = 'pull';

export const ociExtensionTags = ['pull'];

export const RuleToDockerPackageDep = ExtensionTagFragment.extend({
  extension: z.literal(ociExtensionPrefix),
  tag: z.literal(pullTag),
  children: z.object({
    name: StringFragment,
    image: StringFragment,
    tag: StringFragment.optional(),
    digest: StringFragment.optional(),
  }),
}).transform(
  ({
    rawString,
    children: { name, image, tag, digest },
  }): PackageDependency => ({
    datasource: DockerDatasource.id,
    depType: 'oci_pull',
    depName: name.value,
    packageName: image.value,
    currentValue: tag?.value,
    currentDigest: digest?.value,
    // Provide a replace string so the auto replacer can replace both the tag
    // and digest if applicable.
    replaceString: rawString,
  }),
);
