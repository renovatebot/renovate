import { z } from 'zod';
import { getSourceUrl as getGithubSourceUrl } from '../../../util/github/url';
import { looseArray } from '../../../util/schema';

export const DenoApiTag = z.object({
  kind: z.string(),
  value: z.string(),
});

export const DenoAPIModuleResponse = z.object({
  tags: looseArray(DenoApiTag).transform((tags) => {
    const record: Record<string, string> = {};
    for (const { kind, value } of tags) {
      record[kind] = value;
    }
    return record;
  }),
  versions: z.array(z.string()),
});

export const DenoAPIUploadOptions = z.object({
  ref: z.string(),
  type: z.union([z.literal('github'), z.unknown()]),
  repository: z.string(),
  subdir: z.string().optional(),
});

export const DenoAPIModuleVersionResponse = z
  .object({
    upload_options: DenoAPIUploadOptions,
    uploaded_at: z.string(),
    version: z.string(),
  })
  .transform(({ version, uploaded_at: releaseTimestamp, upload_options }) => {
    let sourceUrl: string | undefined = undefined;
    const { type, repository, ref: gitRef } = upload_options;
    if (type === 'github') {
      sourceUrl = getGithubSourceUrl(repository);
    }
    return { version, gitRef, releaseTimestamp, sourceUrl };
  });
