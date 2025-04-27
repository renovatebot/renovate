import { z } from 'zod';
import { DockerDatasource } from '../../../datasource/docker';
import type { PackageDependency } from '../../types';
import { ExtensionTagFragmentSchema, StringFragmentSchema } from './fragments';

export const ociExtensionPrefix = 'oci';

const pullTag = 'pull';

export const ociExtensionTags = ['pull'];

export const RuleToDockerPackageDep = ExtensionTagFragmentSchema.extend({
  extension: z.literal(ociExtensionPrefix),
  tag: z.literal(pullTag),
  children: z.object({
    name: StringFragmentSchema,
    image: StringFragmentSchema,
    tag: StringFragmentSchema.optional(),
    digest: StringFragmentSchema.optional(),
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
